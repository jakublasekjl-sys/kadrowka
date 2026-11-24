import type { ContentModule, MaterialCatalog, MaterialCatalogRecord, MaterialPlacement } from '../types/content'
import { safeContentPath } from '../security/safeLinks.ts'

export type ImportStatus = 'new' | 'replace' | 'unchanged' | 'duplicate' | 'invalid'

export interface ImportedMaterialFile {
  file: File
  relativePath: string
  legacyPath: string
  title: string
  sha256: string
  mimeType: string
  assetKind: 'document' | 'image'
  status: ImportStatus
  existingMaterialId?: string
  moduleIds: string[]
  errors: string[]
}

export interface ReleaseUpload {
  file: File
  storagePath: string
  materialId: string
  sha256: string
  mimeType: string
}

export interface PreparedRelease {
  catalog: MaterialCatalog
  uploads: ReleaseUpload[]
  selectedFiles: number
  initialMigrationComplete: boolean
}

const allowedExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'docx', 'xlsx', 'pptx', 'ppsx'])
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
}
const maxFiles = 5000
const maxFileBytes = 128 * 1024 * 1024
const maxBatchBytes = 2 * 1024 ** 3

function pathKey(path: string) {
  return path.normalize('NFC').toLocaleLowerCase('pl')
}

function extension(path: string) {
  return path.split('.').at(-1)?.toLocaleLowerCase('en') ?? ''
}

function safeRelativePath(value: string) {
  const candidate = value.trim().replaceAll('\\', '/').normalize('NFC').replace(/^\/+/, '')
  return candidate.length <= 1000 && safeContentPath(`files/${candidate}`) ? candidate : ''
}

function cleanTitle(path: string) {
  const fileName = path.split('/').at(-1) ?? path
  return fileName.replace(/\.[^.]+$/, '').replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').trim()
}

function normalizeSelectedPath(file: File, moduleIds: Set<string>) {
  const candidate = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
  const safe = safeRelativePath(candidate)
  if (!safe) return ''
  const segments = safe.split('/')
  if (segments[0]?.toLocaleLowerCase('pl') === 'files') segments.shift()
  else if (segments.length > 1 && !moduleIds.has(segments[0]) && moduleIds.has(segments[1])) segments.shift()
  return safeRelativePath(segments.join('/'))
}

function bytesStartWith(bytes: Uint8Array, values: number[]) {
  return values.every((value, index) => bytes[index] === value)
}

async function validateSignature(file: File, fileExtension: string) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (fileExtension === 'pdf' && new TextDecoder('latin1').decode(bytes).includes('%PDF-')) return ''
  if (fileExtension === 'png' && bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ''
  if (['jpg', 'jpeg'].includes(fileExtension) && bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return ''
  if (fileExtension === 'gif' && ['GIF87a', 'GIF89a'].includes(new TextDecoder('latin1').decode(bytes.slice(0, 6)))) return ''
  if (fileExtension === 'webp') {
    const label = new TextDecoder('latin1').decode(bytes)
    if (label.startsWith('RIFF') && label.slice(8, 12) === 'WEBP') return ''
  }
  if (['docx', 'xlsx', 'pptx', 'ppsx'].includes(fileExtension)
    && (bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytesStartWith(bytes, [0x50, 0x4b, 0x05, 0x06]))) {
    const tailStart = Math.max(0, file.size - 4 * 1024 * 1024)
    const catalog = new TextDecoder('latin1').decode(await file.slice(tailStart).arrayBuffer()).toLocaleLowerCase('en')
    const required = fileExtension === 'docx' ? 'word/document.xml'
      : fileExtension === 'xlsx' ? 'xl/workbook.xml'
        : 'ppt/presentation.xml'
    if (!catalog.includes('[content_types].xml') || !catalog.includes(required)) return 'Dokument Office nie ma oczekiwanej struktury.'
    if (catalog.includes('vbaproject.bin')) return 'Dokument Office zawiera niedozwolone makra.'
    return ''
  }
  return 'Rozszerzenie nie zgadza się z sygnaturą pliku.'
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function inferredModules(relativePath: string, modules: ContentModule[]) {
  const segments = relativePath.split('/').map((item) => pathKey(item))
  return modules
    .filter((module) => segments.includes(pathKey(module.id)) || segments.includes(pathKey(module.title)))
    .map((module) => module.id)
}

export async function analyzeMaterialFiles(
  selected: File[],
  catalog: MaterialCatalog,
  modules: ContentModule[],
  onProgress?: (completed: number, total: number) => void,
) {
  if (!selected.length) return []
  if (selected.length > maxFiles) throw new Error(`Jedna paczka może zawierać najwyżej ${maxFiles} plików.`)
  const totalBytes = selected.reduce((sum, file) => sum + file.size, 0)
  if (totalBytes > maxBatchBytes) throw new Error('Paczka przekracza 2 GB. Podziel ją na mniejsze części.')

  const moduleIds = new Set(modules.map((module) => module.id))
  const byPath = new Map<string, MaterialCatalogRecord>()
  const byHash = new Map(catalog.materials.map((material) => [material.sha256, material]))
  for (const material of catalog.materials) {
    for (const path of material.legacyPaths) byPath.set(pathKey(path), material)
  }
  let next = 0
  let completed = 0
  const results: ImportedMaterialFile[] = new Array(selected.length)
  const workers = Array.from({ length: Math.min(2, selected.length) }, async () => {
    while (next < selected.length) {
      const index = next++
      const file = selected[index]
      const relativePath = normalizeSelectedPath(file, moduleIds)
      const legacyPath = relativePath ? `files/${relativePath}` : ''
      const fileExtension = extension(relativePath || file.name)
      const errors: string[] = []
      if (!relativePath) errors.push('Nieprawidłowa lub niebezpieczna ścieżka pliku.')
      if (!allowedExtensions.has(fileExtension)) errors.push('Niedozwolony typ pliku.')
      if (!file.size) errors.push('Plik jest pusty.')
      if (file.size > maxFileBytes) errors.push('Plik przekracza limit 128 MB.')
      if (!errors.length) {
        const signatureError = await validateSignature(file, fileExtension)
        if (signatureError) errors.push(signatureError)
      }
      const hash = errors.length ? '' : await sha256(file)
      const samePath = legacyPath ? byPath.get(pathKey(legacyPath)) : undefined
      const sameHash = hash ? byHash.get(hash) : undefined
      const status: ImportStatus = errors.length
        ? 'invalid'
        : samePath?.sha256 === hash
          ? 'unchanged'
          : samePath
            ? 'replace'
            : sameHash
              ? 'duplicate'
              : 'new'
      const existing = samePath ?? sameHash
      results[index] = {
        file,
        relativePath,
        legacyPath,
        title: existing?.title ?? cleanTitle(relativePath || file.name),
        sha256: hash,
        mimeType: mimeTypes[fileExtension] ?? 'application/octet-stream',
        assetKind: imageExtensions.has(fileExtension) ? 'image' : 'document',
        status,
        existingMaterialId: existing?.id,
        moduleIds: existing?.moduleIds.length ? existing.moduleIds : inferredModules(relativePath, modules),
        errors,
      }
      completed += 1
      onProgress?.(completed, selected.length)
    }
  })
  await Promise.all(workers)

  const seenSelectedPaths = new Set<string>()
  for (const result of results) {
    const key = pathKey(result.legacyPath)
    if (key && seenSelectedPaths.has(key)) {
      result.status = 'invalid'
      result.errors.push('Ta sama ścieżka występuje w wybranej paczce więcej niż raz.')
    }
    seenSelectedPaths.add(key)
  }
  const selectedPaths = new Set(results.map((item) => pathKey(item.legacyPath)))
  for (const result of results.filter((item) => item.status === 'replace' && item.existingMaterialId)) {
    const existing = catalog.materials.find((item) => item.id === result.existingMaterialId)
    if (!existing || existing.legacyPaths.length < 2) continue
    const selectedAliases = results.filter((item) => item.existingMaterialId === existing.id)
    const allAliasesSelected = existing.legacyPaths.every((path) => selectedPaths.has(pathKey(path)))
    const replacementHashes = new Set(selectedAliases.map((item) => item.sha256))
    if (!allAliasesSelected || replacementHashes.size > 1) {
      result.status = 'invalid'
      result.errors.push('Ten plik współdzieli zawartość z innymi ścieżkami. Podmień wszystkie wskazane kopie tym samym plikiem albo rozdziel zmianę ręcznie.')
    }
  }
  return results
}

function clonedRecord(record: MaterialCatalogRecord): MaterialCatalogRecord {
  return {
    ...record,
    legacyPaths: [...record.legacyPaths],
    moduleIds: [...record.moduleIds],
    placements: record.placements.map((item) => ({ ...item })),
    metadata: record.metadata ? { ...record.metadata } : undefined,
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function uniquePlacements(values: MaterialPlacement[]) {
  const seen = new Set<string>()
  return values.filter((item) => {
    const key = `${item.kind}|${item.targetId}|${item.section ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function prepareRelease(
  existingCatalog: MaterialCatalog,
  files: ImportedMaterialFile[],
  releaseId: string,
  defaultModuleIds: string[],
  source: 'local' | 'azure',
): PreparedRelease {
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(releaseId)) throw new Error('Identyfikator wydania zawiera niedozwolone znaki.')
  if (!files.length) throw new Error('Najpierw wybierz i przeanalizuj pliki.')
  if (files.some((item) => item.status === 'invalid')) throw new Error('Paczka zawiera pliki wymagające poprawy.')
  if (files.some((item) => !safeContentPath(item.legacyPath) || !/^[a-f0-9]{64}$/.test(item.sha256))) {
    throw new Error('Paczka zawiera nieprawidłowe ścieżki lub skróty plików.')
  }

  const records = new Map(existingCatalog.materials.map((record) => [record.id, clonedRecord(record)]))
  const byPath = new Map<string, MaterialCatalogRecord>()
  const byHash = new Map(existingCatalog.materials.map((record) => [record.sha256, record]))
  for (const record of existingCatalog.materials) for (const path of record.legacyPaths) byPath.set(pathKey(path), record)
  const uploads = new Map<string, ReleaseUpload>()
  const selectedExistingIds = new Set<string>()

  for (const item of files) {
    const existing = byPath.get(pathKey(item.legacyPath)) ?? byHash.get(item.sha256)
    const id = existing?.id ?? `material-${item.sha256.slice(0, 24)}`
    if (existing) selectedExistingIds.add(existing.id)
    const record = records.get(id) ?? {
      id,
      title: item.title,
      legacyPaths: [],
      storagePath: `releases/${releaseId}/${item.legacyPath}`,
      sha256: item.sha256,
      size: item.file.size,
      mimeType: item.mimeType,
      assetKind: item.assetKind,
      moduleIds: [],
      placements: [],
    }
    const replaced = item.status === 'replace' || record.sha256 !== item.sha256
    record.title = item.title
    record.legacyPaths = unique([...record.legacyPaths.filter((path) => pathKey(path) !== pathKey(item.legacyPath)), item.legacyPath])
    record.sha256 = item.sha256
    record.size = item.file.size
    record.mimeType = item.mimeType
    record.assetKind = item.assetKind
    record.moduleIds = unique([...record.moduleIds, ...item.moduleIds, ...defaultModuleIds])
    record.placements = uniquePlacements([
      ...record.placements,
      ...record.moduleIds.map((targetId) => ({ kind: 'module' as const, targetId, section: 'materials' })),
    ])
    const mustUpload = source === 'local' || item.status === 'new' || replaced
    if (mustUpload) {
      let upload = uploads.get(id)
      if (!upload) {
        upload = {
        file: item.file,
        storagePath: `releases/${releaseId}/${item.legacyPath}`,
        materialId: record.id,
        sha256: item.sha256,
        mimeType: item.mimeType,
        }
        uploads.set(id, upload)
      }
      record.storagePath = upload.storagePath
    }
    records.set(id, record)
  }

  const materials = [...records.values()].sort((left, right) => left.title.localeCompare(right.title, 'pl'))
  const initialMigrationComplete = source === 'azure'
    || existingCatalog.materials.every((record) => selectedExistingIds.has(record.id))
  return {
    catalog: {
      schemaVersion: 1,
      releaseId,
      generatedAt: new Date().toISOString(),
      contentVersion: existingCatalog.contentVersion,
      materialCount: materials.length,
      totalBytes: materials.reduce((sum, material) => sum + material.size, 0),
      materials,
    },
    uploads: [...uploads.values()],
    selectedFiles: files.length,
    initialMigrationComplete,
  }
}

export function exportPreparedRelease(release: PreparedRelease) {
  const value = {
    ...release,
    uploads: release.uploads.map(({ file, ...item }) => ({ ...item, fileName: file.name, size: file.size })),
  }
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `kadrowka-wydanie-${release.catalog.releaseId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
