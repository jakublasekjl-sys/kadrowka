import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser'
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob'
import type { MaterialCatalog, MaterialCatalogPointer, RuntimeConfig } from '../types/content'
import type { PreparedRelease } from './materialImport'
import { parseMaterialCatalog, parseMaterialCatalogPointer } from '../content/materialCatalog'

const storageScopes = ['https://storage.azure.com/user_impersonation']

interface AzureError {
  statusCode?: number
  code?: string
}

function isNotFound(error: unknown) {
  const azureError = error as AzureError
  return azureError?.statusCode === 404 || azureError?.code === 'BlobNotFound'
}

function jsonBlob(value: unknown) {
  return new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
}

export interface PublishProgress {
  phase: 'files' | 'catalog' | 'pointer'
  completed: number
  total: number
  current?: string
}

export class AzureContentAdmin {
  private readonly application: PublicClientApplication
  private readonly config: RuntimeConfig['azure']
  private initialized = false

  constructor(config: RuntimeConfig['azure']) {
    this.config = config
    this.application = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin + '/admin',
        postLogoutRedirectUri: window.location.origin + '/admin',
      },
      cache: { cacheLocation: 'memoryStorage' },
    })
  }

  async initialize() {
    if (this.initialized) return
    await this.application.initialize()
    const accounts = this.application.getAllAccounts()
    if (!this.application.getActiveAccount() && accounts[0]) this.application.setActiveAccount(accounts[0])
    this.initialized = true
  }

  account() {
    return this.application.getActiveAccount()
  }

  async signIn(): Promise<AccountInfo> {
    await this.initialize()
    const result = await this.application.loginPopup({ scopes: storageScopes, prompt: 'select_account' })
    if (!result.account) throw new Error('Logowanie nie zwróciło konta administratora.')
    this.application.setActiveAccount(result.account)
    return result.account
  }

  async signOut() {
    await this.initialize()
    const account = this.application.getActiveAccount()
    if (account) await this.application.logoutPopup({ account })
  }

  private async accessToken() {
    await this.initialize()
    const account = this.application.getActiveAccount()
    if (!account) throw new Error('Zaloguj się kontem administratora.')
    try {
      return await this.application.acquireTokenSilent({ account, scopes: storageScopes })
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error
      return this.application.acquireTokenPopup({ account, scopes: storageScopes })
    }
  }

  private async container(): Promise<ContainerClient> {
    const credential = {
      getToken: async () => {
        const response = await this.accessToken()
        return {
          token: response.accessToken,
          expiresOnTimestamp: response.expiresOn?.getTime() ?? Date.now() + 45 * 60 * 1000,
        }
      },
    }
    const service = new BlobServiceClient(
      `https://${this.config.storageAccountName}.blob.core.windows.net`,
      credential,
    )
    return service.getContainerClient(this.config.containerName)
  }

  async currentPointer(): Promise<{ pointer: MaterialCatalogPointer | null; etag?: string }> {
    const container = await this.container()
    try {
      const response = await container.getBlobClient('catalog/current.json').download()
      const body = await response.blobBody
      if (!body) throw new Error('Pusty wskaźnik aktywnego wydania.')
      return { pointer: parseMaterialCatalogPointer(JSON.parse(await body.text())), etag: response.etag }
    } catch (error) {
      if (isNotFound(error)) return { pointer: null }
      throw error
    }
  }

  async catalog(releaseId: string): Promise<MaterialCatalog> {
    const container = await this.container()
    const response = await container.getBlobClient(`catalog/${releaseId}.json`).download()
    const body = await response.blobBody
    if (!body) throw new Error('Katalog wydania jest pusty.')
    return parseMaterialCatalog(JSON.parse(await body.text()))
  }

  async publish(release: PreparedRelease, onProgress?: (progress: PublishProgress) => void) {
    if (!release.initialMigrationComplete) {
      throw new Error('Pierwsza publikacja wymaga wskazania wszystkich materiałów z lokalnego katalogu.')
    }
    const catalog = parseMaterialCatalog(release.catalog)
    if (release.uploads.some((upload) => !catalog.materials.some((material) =>
      material.id === upload.materialId
      && material.storagePath === upload.storagePath
      && material.sha256 === upload.sha256
      && material.mimeType === upload.mimeType
      && material.size === upload.file.size))) {
      throw new Error('Pliki do przesłania nie odpowiadają zatwierdzonemu katalogowi wydania.')
    }
    const container = await this.container()
    const before = await this.currentPointer()
    for (let index = 0; index < release.uploads.length; index += 1) {
      const upload = release.uploads[index]
      onProgress?.({ phase: 'files', completed: index, total: release.uploads.length, current: upload.file.name })
      const blob = container.getBlockBlobClient(upload.storagePath)
      await blob.uploadBrowserData(upload.file, {
        blockSize: 4 * 1024 * 1024,
        concurrency: 3,
        conditions: { ifNoneMatch: '*' },
        blobHTTPHeaders: {
          blobContentType: upload.mimeType,
          blobContentDisposition: upload.mimeType.startsWith('image/') || upload.mimeType === 'application/pdf' ? 'inline' : 'attachment',
          blobCacheControl: 'public, max-age=31536000, immutable',
        },
        metadata: {
          materialid: upload.materialId,
          releaseid: release.catalog.releaseId,
          sha256: upload.sha256,
        },
      })
      const properties = await blob.getProperties()
      if (properties.contentLength !== upload.file.size || properties.metadata?.sha256 !== upload.sha256 || properties.contentType !== upload.mimeType) {
        throw new Error(`Kontrola przesłanego pliku nie powiodła się: ${upload.file.name}`)
      }
      onProgress?.({ phase: 'files', completed: index + 1, total: release.uploads.length, current: upload.file.name })
    }

    onProgress?.({ phase: 'catalog', completed: 0, total: 1 })
    const catalogPath = `catalog/${release.catalog.releaseId}.json`
    await container.getBlockBlobClient(catalogPath).uploadBrowserData(jsonBlob(release.catalog), {
      blobHTTPHeaders: { blobContentType: 'application/json;charset=utf-8', blobCacheControl: 'public, max-age=31536000, immutable' },
      conditions: { ifNoneMatch: '*' },
    })
    const publishedCatalog = await this.catalog(release.catalog.releaseId)
    if (publishedCatalog.releaseId !== release.catalog.releaseId || publishedCatalog.materialCount !== release.catalog.materialCount) {
      throw new Error('Kontrola opublikowanego katalogu nie powiodła się.')
    }
    onProgress?.({ phase: 'catalog', completed: 1, total: 1 })

    const pointer: MaterialCatalogPointer = {
      schemaVersion: 1,
      releaseId: release.catalog.releaseId,
      catalogPath,
      publishedAt: new Date().toISOString(),
      previousReleaseId: before.pointer?.releaseId,
    }
    onProgress?.({ phase: 'pointer', completed: 0, total: 1 })
    await container.getBlockBlobClient('catalog/current.json').uploadBrowserData(jsonBlob(pointer), {
      blobHTTPHeaders: { blobContentType: 'application/json;charset=utf-8', blobCacheControl: 'no-store, max-age=0' },
      conditions: before.etag ? { ifMatch: before.etag } : { ifNoneMatch: '*' },
    })
    onProgress?.({ phase: 'pointer', completed: 1, total: 1 })
    return pointer
  }

  async rollback() {
    const container = await this.container()
    const before = await this.currentPointer()
    const previousReleaseId = before.pointer?.previousReleaseId
    if (!before.pointer || !before.etag || !previousReleaseId) throw new Error('Brak poprzedniego wydania do przywrócenia.')
    await this.catalog(previousReleaseId)
    const pointer: MaterialCatalogPointer = {
      schemaVersion: 1,
      releaseId: previousReleaseId,
      catalogPath: `catalog/${previousReleaseId}.json`,
      publishedAt: new Date().toISOString(),
      previousReleaseId: before.pointer.releaseId,
    }
    await container.getBlockBlobClient('catalog/current.json').uploadBrowserData(jsonBlob(pointer), {
      blobHTTPHeaders: { blobContentType: 'application/json;charset=utf-8', blobCacheControl: 'no-store, max-age=0' },
      conditions: { ifMatch: before.etag },
    })
    return pointer
  }
}
