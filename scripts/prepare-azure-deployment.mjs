import { createHash } from 'node:crypto'
import { createReadStream, copyFileSync, cpSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { parseMaterialCatalog } from '../src/content/materialCatalog.ts'
import { parseRuntimeConfig } from '../src/config/runtimeConfig.ts'
import { pinReleaseSecurityHeaders } from './security-headers.mjs'

const root = resolve(import.meta.dirname, '..')
const releaseRoot = resolve(root, 'release')
const fullRelease = resolve(releaseRoot, 'kadrowka-web')
const appRoot = resolve(releaseRoot, 'kadrowka-azure-app')
const blobRoot = resolve(releaseRoot, 'kadrowka-azure-content')
const manifestPath = resolve(releaseRoot, 'kadrowka-azure-manifest.json')
const account = process.env.KADROWKA_AZURE_STORAGE_ACCOUNT ?? ''
const container = process.env.KADROWKA_AZURE_CONTAINER ?? ''
const environment = process.env.KADROWKA_AZURE_ENVIRONMENT ?? ''

for (const target of [appRoot, blobRoot]) {
  if (dirname(target) !== releaseRoot) throw new Error(`Nieprawidłowa ścieżka wydania: ${target}`)
}
if (!['development', 'production'].includes(environment)) throw new Error('Podaj KADROWKA_AZURE_ENVIRONMENT=development lub production.')
if (!existsSync(resolve(fullRelease, 'index.html'))) throw new Error('Brak pełnej paczki. Najpierw wykonaj pnpm deploy:prepare.')

const localCatalog = parseMaterialCatalog(JSON.parse(readFileSync(resolve(fullRelease, 'content/materials-catalog.json'), 'utf8')))
const contentManifest = JSON.parse(readFileSync(resolve(fullRelease, 'content/manifest.json'), 'utf8'))
const contentVersion = contentManifest.version
if (contentVersion !== localCatalog.contentVersion) throw new Error('Katalog materiałów i treści aplikacji mają różne wersje.')
const publishedAt = new Date(contentManifest.publishedAt)
if (Number.isNaN(publishedAt.getTime())) throw new Error('Manifest treści nie ma poprawnej daty publikacji.')
const fingerprint = createHash('sha256').update(JSON.stringify({ contentVersion, materials: localCatalog.materials })).digest('hex')
const releaseId = `content-${fingerprint.slice(0, 24)}`
const publicBaseUrl = `https://${account}.blob.core.windows.net/${container}`
const runtimeConfig = parseRuntimeConfig({
  schemaVersion: 1,
  environment,
  adminPanelEnabled: false,
  azure: {
    enabled: true,
    tenantId: '',
    clientId: '',
    storageAccountName: account,
    containerName: container,
    publicBaseUrl,
    catalogReleaseId: releaseId,
  },
})
const catalog = parseMaterialCatalog({
  ...localCatalog,
  generatedAt: publishedAt.toISOString(),
  releaseId,
  materials: localCatalog.materials.map((material) => {
    if (!material.storagePath.startsWith('files/')) throw new Error(`Niekanoniczna ścieżka: ${material.storagePath}`)
    return { ...material, storagePath: `releases/${releaseId}/${material.storagePath}` }
  }),
})

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

// Validate every source before replacing either staging directory.
const files = []
const contentRoot = resolve(fullRelease, 'content')
for (const material of localCatalog.materials) {
  const source = resolve(contentRoot, material.storagePath)
  const pathWithinContent = relative(contentRoot, source)
  if (pathWithinContent.startsWith('..') || pathWithinContent.startsWith(sep) || !existsSync(source)) {
    throw new Error(`Brak lub niedozwolona ścieżka materiału: ${material.storagePath}`)
  }
  if (statSync(source).size !== material.size || await sha256(source) !== material.sha256) {
    throw new Error(`Niezgodny rozmiar lub SHA-256 materiału: ${material.storagePath}`)
  }
  files.push({ source, path: material.storagePath })
}

for (const target of [appRoot, blobRoot]) rmSync(target, { recursive: true, force: true })
const excludedFiles = resolve(fullRelease, 'content/files')
cpSync(fullRelease, appRoot, {
  recursive: true,
  filter: (path) => path !== excludedFiles && !path.startsWith(`${excludedFiles}${sep}`),
})
writeFileSync(resolve(appRoot, 'runtime-config.json'), `${JSON.stringify(runtimeConfig, null, 2)}\n`)
pinReleaseSecurityHeaders(appRoot, runtimeConfig)
if (existsSync(resolve(appRoot, 'content/files'))) throw new Error('Materiały nie mogą trafić do Static Web Apps.')

let appBytes = 0
let appFiles = 0
function countAppFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) countAppFiles(path)
    else { appFiles += 1; appBytes += statSync(path).size }
  }
}
for (const file of files) {
  const target = resolve(blobRoot, 'releases', releaseId, file.path)
  mkdirSync(dirname(target), { recursive: true })
  try { linkSync(file.source, target) } catch { copyFileSync(file.source, target) }
}
const catalogPath = resolve(blobRoot, 'catalog', `${releaseId}.json`)
mkdirSync(dirname(catalogPath), { recursive: true })
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)

writeFileSync(resolve(appRoot, 'deployment-manifest.json'), `${JSON.stringify({
  appVersion: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version,
  packageVersion: contentVersion,
  materialSource: 'azure',
  materialReleaseId: releaseId,
  materialFiles: files.length,
  materialBytes: catalog.totalBytes,
}, null, 2)}\n`)
countAppFiles(appRoot)
if (appBytes > 250 * 1024 * 1024) throw new Error(`Paczka aplikacji przekracza limit Azure Static Web Apps Free: ${appBytes} B.`)

const result = {
  schemaVersion: 1,
  environment,
  storageAccountName: account,
  containerName: container,
  releaseId,
  contentVersion,
  fingerprint,
  appFiles,
  appBytes,
  materialFiles: files.length,
  materialBytes: catalog.totalBytes,
  catalogPath: `catalog/${releaseId}.json`,
}
writeFileSync(manifestPath, `${JSON.stringify(result, null, 2)}\n`)
console.log(`Azure Static Web Apps: ${appRoot} (${appFiles} plików, ${(appBytes / 1024 ** 2).toFixed(2)} MB).`)
console.log(`Azure Blob: ${blobRoot} (${files.length} unikalnych materiałów, ${(catalog.totalBytes / 1024 ** 2).toFixed(2)} MB).`)
console.log(`Katalog: ${result.catalogPath}; wydanie: ${releaseId}.`)
