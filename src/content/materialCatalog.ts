import { z } from 'zod'
import { contentPathUrl, safeContentPath, safeExternalUrl } from '../security/safeLinks.ts'
import { readJsonResponse } from '../security/jsonResponse.ts'
import type {
  ContentBundle,
  ContentFile,
  MaterialCatalog,
  MaterialCatalogRecord,
  RuntimeConfig,
} from '../types/content'
import { isAzureRuntimeReady } from '../config/runtimeConfig.ts'

const placementSchema = z.object({
  kind: z.enum(['module', 'page', 'tool', 'document']),
  targetId: z.string().min(1).max(240),
  section: z.string().max(120).optional(),
})

const materialSchema = z.object({
  id: z.string().regex(/^material-[a-f0-9]{16,64}$/),
  title: z.string().min(1).max(500),
  legacyPaths: z.array(z.string().min(1).max(1024)).min(1),
  storagePath: z.string().min(1).max(1400),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative().max(512 * 1024 * 1024),
  mimeType: z.string().min(1).max(160),
  assetKind: z.enum(['document', 'image']),
  moduleIds: z.array(z.string().min(1).max(240)),
  placements: z.array(placementSchema),
  metadata: z.object({
    category: z.string().max(240).optional(),
    audiences: z.array(z.string().max(240)).optional(),
    usageModes: z.array(z.string().max(240)).optional(),
    levels: z.array(z.string().max(240)).optional(),
    description: z.string().max(4000).optional(),
  }).optional(),
})

const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  releaseId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/i),
  generatedAt: z.string().datetime(),
  contentVersion: z.string().min(1).max(120),
  materialCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  materials: z.array(materialSchema).max(5000),
})

const fileTypes: Record<string, { mimeType: string; assetKind: 'document' | 'image' }> = {
  pdf: { mimeType: 'application/pdf', assetKind: 'document' },
  docx: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', assetKind: 'document' },
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', assetKind: 'document' },
  pptx: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', assetKind: 'document' },
  ppsx: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', assetKind: 'document' },
  png: { mimeType: 'image/png', assetKind: 'image' },
  jpg: { mimeType: 'image/jpeg', assetKind: 'image' },
  jpeg: { mimeType: 'image/jpeg', assetKind: 'image' },
  webp: { mimeType: 'image/webp', assetKind: 'image' },
  gif: { mimeType: 'image/gif', assetKind: 'image' },
}

const pointerSchema = z.object({
  schemaVersion: z.literal(1),
  releaseId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/i),
  catalogPath: z.string().regex(/^catalog\/[a-z0-9][a-z0-9._-]{0,119}\.json$/i),
  publishedAt: z.string().datetime(),
  previousReleaseId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/i).optional(),
})

interface ResolverState {
  source: 'local' | 'azure'
  publicBaseUrl: string
  byLegacyPath: Map<string, MaterialCatalogRecord>
}

let resolver: ResolverState | null = null

function pathKey(path: string) {
  return path.normalize('NFC').toLocaleLowerCase('pl')
}

function safeStoragePath(value: string) {
  const candidate = value.trim().normalize('NFC')
  if (candidate.length > 1400) return ''
  const release = /^releases\/([a-z0-9][a-z0-9._-]{0,119})\/(files\/.+)$/i.exec(candidate)
  const materialPath = release ? release[2] : candidate
  return safeContentPath(materialPath) && (release || candidate.startsWith('files/')) ? candidate : ''
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

async function fetchJson(url: string, maxBytes = 12 * 1024 * 1024) {
  const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return readJsonResponse<unknown>(response, maxBytes, url)
}

export function parseMaterialCatalog(value: unknown): MaterialCatalog {
  const catalog = catalogSchema.parse(value)
  if (catalog.materialCount !== catalog.materials.length) throw new Error('Liczba pozycji katalogu jest niespójna.')
  const calculatedBytes = catalog.materials.reduce((sum, item) => sum + item.size, 0)
  if (catalog.totalBytes !== calculatedBytes) throw new Error('Rozmiar katalogu jest niespójny.')
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const material of catalog.materials) {
    if (ids.has(material.id)) throw new Error(`Powtórzony identyfikator materiału: ${material.id}`)
    ids.add(material.id)
    const storagePath = safeStoragePath(material.storagePath)
    if (!storagePath) throw new Error(`Nieprawidłowa ścieżka publikacji: ${material.storagePath}`)
    const sourcePath = storagePath.startsWith('releases/') ? storagePath.split('/').slice(2).join('/') : storagePath
    if (!material.legacyPaths.some((path) => pathKey(path) === pathKey(sourcePath))) {
      throw new Error(`Ścieżka publikacji nie odpowiada materiałowi: ${material.id}`)
    }
    for (const path of material.legacyPaths) {
      const safePath = safeContentPath(path)
      if (!safePath) throw new Error(`Nieprawidłowa ścieżka materiału: ${path}`)
      const type = fileTypes[safePath.split('.').at(-1)?.toLowerCase() ?? '']
      if (!type || type.mimeType !== material.mimeType || type.assetKind !== material.assetKind) {
        throw new Error(`Typ materiału jest niezgodny ze ścieżką: ${path}`)
      }
      const key = pathKey(safePath)
      if (paths.has(key)) throw new Error(`Ścieżka występuje więcej niż raz: ${path}`)
      paths.add(key)
    }
  }
  return catalog
}

export function parseMaterialCatalogPointer(value: unknown) {
  const pointer = pointerSchema.parse(value)
  if (pointer.catalogPath !== `catalog/${pointer.releaseId}.json` || pointer.previousReleaseId === pointer.releaseId) {
    throw new Error('Wskaźnik wydania zawiera niespójne ścieżki.')
  }
  return pointer
}

export function installMaterialResolver(catalog: MaterialCatalog, source: 'local' | 'azure', publicBaseUrl = '') {
  const byLegacyPath = new Map<string, MaterialCatalogRecord>()
  for (const material of catalog.materials) {
    for (const path of material.legacyPaths) byLegacyPath.set(pathKey(path), material)
  }
  resolver = { source, publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''), byLegacyPath }
}

export function resolveMaterialUrl(path?: string) {
  const safePath = safeContentPath(path)
  if (!safePath) return ''
  const activeResolver = resolver
  if (!activeResolver) return contentPathUrl(safePath)
  const material = activeResolver.byLegacyPath.get(pathKey(safePath))
  if (!material || activeResolver.source === 'local') return contentPathUrl(safePath)
  const storagePath = safeStoragePath(material.storagePath)
  const baseUrl = safeExternalUrl(activeResolver.publicBaseUrl)
  if (!storagePath || !baseUrl) return ''
  return `${baseUrl.replace(/\/$/, '')}/${encodePath(storagePath)}`
}

export async function loadActiveMaterialCatalog(localCatalog: MaterialCatalog, config: RuntimeConfig) {
  if (!config.azure.enabled) return { catalog: localCatalog, source: 'local' as const }
  if (!isAzureRuntimeReady(config)) {
    return {
      catalog: localCatalog,
      source: 'local' as const,
      warning: 'Integracja Azure jest włączona, ale konfiguracja nie jest jeszcze kompletna. Użyto lokalnej paczki materiałów.',
    }
  }
  try {
    const baseUrl = config.azure.publicBaseUrl.replace(/\/+$/, '')
    const pointer = parseMaterialCatalogPointer(await fetchJson(`${baseUrl}/catalog/current.json`))
    const catalog = parseMaterialCatalog(await fetchJson(`${baseUrl}/${encodePath(pointer.catalogPath)}`))
    if (catalog.releaseId !== pointer.releaseId) throw new Error('Wskaźnik i katalog dotyczą różnych wydań.')
    return { catalog, source: 'azure' as const }
  } catch (error) {
    return {
      catalog: localCatalog,
      source: 'local' as const,
      warning: `Nie udało się pobrać aktywnego katalogu Azure. Użyto lokalnej paczki. ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function catalogFile(record: MaterialCatalogRecord, path: string): ContentFile {
  return {
    id: record.id,
    favoriteId: record.id,
    title: record.title,
    path,
    fileName: path.split('/').at(-1),
    type: path.split('.').at(-1)?.toLocaleLowerCase('en'),
    kind: 'file',
    category: record.metadata?.category,
    audiences: record.metadata?.audiences,
    usageModes: record.metadata?.usageModes,
    levels: record.metadata?.levels,
    description: record.metadata?.description,
  }
}

export function mergeCatalogPlacements(bundle: Omit<ContentBundle, 'materialCatalog' | 'materialCatalogSource' | 'runtimeConfig'>, catalog: MaterialCatalog) {
  for (const record of catalog.materials) {
    if (record.assetKind !== 'document') continue
    const path = record.legacyPaths[0]
    for (const moduleId of new Set([
      ...record.moduleIds,
      ...record.placements.filter((item) => item.kind === 'module').map((item) => item.targetId),
    ])) {
      const module = bundle.modules.find((item) => item.id === moduleId)
      if (!module) continue
      module.files ??= []
      if (!module.files.some((item) => item.id === record.id || item.path && record.legacyPaths.some((legacy) => pathKey(legacy) === pathKey(item.path!)))) {
        module.files.push(catalogFile(record, path))
      }
    }
    for (const placement of record.placements.filter((item) => item.kind === 'page')) {
      const page = bundle.pages.find((item) => item.id === placement.targetId)
      if (!page) continue
      page.quickLinks ??= []
      if (!page.quickLinks.some((item) => item.path && record.legacyPaths.some((legacy) => pathKey(legacy) === pathKey(item.path!)))) {
        page.quickLinks.push(catalogFile(record, path))
      }
    }
  }
  return bundle
}
