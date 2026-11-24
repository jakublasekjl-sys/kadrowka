import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(projectRoot, '..')
const contentRoot = process.env.KADROWKA_CONTENT_ROOT
  ? resolve(process.env.KADROWKA_CONTENT_ROOT)
  : resolve(projectRoot, 'public/content')
const filesRoot = resolve(workspaceRoot, 'package/content-package/files')

const mimeTypes = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
}
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])

function json(path) {
  return JSON.parse(readFileSync(resolve(contentRoot, path), 'utf8'))
}

function key(value) {
  return String(value).normalize('NFC').toLocaleLowerCase('pl')
}

function hashFile(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}

function cleanTitle(path) {
  return basename(path, extname(path))
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const assets = json('assets-index.json')
const manifest = json('manifest.json')
const modules = json('modules.json')
const pages = json('pages.json')
const documents = json('documents.json')
const tools = json('tools-catalog.json')
const home = json('home.json')
const curatedPages = json('curated-pages.json')
const search = json('search/search-index.json')
const assetPaths = new Set(assets.map((asset) => key(asset.path)))
const referenceData = new Map()

function addReference(path, context, object) {
  if (typeof path !== 'string' || !assetPaths.has(key(path))) return
  const item = referenceData.get(key(path)) ?? { placements: [], titles: [], metadata: [] }
  if (context?.kind && context?.targetId) {
    item.placements.push({ kind: context.kind, targetId: context.targetId, section: context.section })
  }
  if (typeof object?.title === 'string' && object.title.trim()) item.titles.push(object.title.trim())
  if (object && typeof object === 'object') {
    item.metadata.push({
      category: typeof object.category === 'string' ? object.category : undefined,
      audiences: Array.isArray(object.audiences) ? object.audiences : undefined,
      usageModes: Array.isArray(object.usageModes) ? object.usageModes : undefined,
      levels: Array.isArray(object.levels) ? object.levels : undefined,
      description: typeof object.description === 'string' ? object.description : undefined,
    })
  }
  referenceData.set(key(path), item)
}

function walk(value, context) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) walk(item, context)
    return
  }
  addReference(value.path, context, value)
  addReference(value.src, context, value)
  for (const child of Object.values(value)) walk(child, context)
}

for (const module of modules) walk(module, { kind: 'module', targetId: module.id, section: 'materials' })
for (const page of pages) walk(page, { kind: 'page', targetId: page.id, section: 'content' })
for (const document of documents) walk(document, { kind: 'document', targetId: document.id ?? document.favoriteId ?? key(document.title ?? 'document'), section: 'catalog' })
for (const tool of tools) walk(tool, { kind: 'tool', targetId: tool.id ?? key(tool.title ?? 'tool'), section: 'catalog' })
walk(home, null)
walk(curatedPages, null)
walk(search, null)

const grouped = new Map()
for (let index = 0; index < assets.length; index += 1) {
  const asset = assets[index]
  const relativePath = asset.path.replace(/^files\//, '')
  const physicalPath = resolve(filesRoot, relativePath)
  if (!physicalPath.startsWith(filesRoot + sep) || !existsSync(physicalPath)) {
    throw new Error(`Brak pliku do zbudowania katalogu: ${asset.path}`)
  }
  const sha256 = await hashFile(physicalPath)
  const reference = referenceData.get(key(asset.path)) ?? { placements: [], titles: [], metadata: [] }
  const current = grouped.get(sha256) ?? {
    id: `material-${sha256.slice(0, 24)}`,
    title: reference.titles[0] ?? cleanTitle(asset.path),
    legacyPaths: [],
    storagePath: asset.path,
    sha256,
    size: asset.size,
    mimeType: mimeTypes[extname(asset.path).toLocaleLowerCase('en')] ?? 'application/octet-stream',
    assetKind: imageExtensions.has(extname(asset.path).toLocaleLowerCase('en')) ? 'image' : 'document',
    moduleIds: [],
    placements: [],
    metadata: reference.metadata.find((item) => Object.values(item).some(Boolean)),
  }
  current.legacyPaths.push(asset.path.normalize('NFC'))
  if (asset.moduleId) current.moduleIds.push(asset.moduleId)
  current.placements.push(...reference.placements)
  if (!current.title && reference.titles[0]) current.title = reference.titles[0]
  grouped.set(sha256, current)
  if ((index + 1) % 100 === 0) console.log(`Katalog materiałów: skróty ${index + 1}/${assets.length}.`)
}

function uniqueBy(values, selector) {
  const seen = new Set()
  return values.filter((item) => {
    const value = selector(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const materials = [...grouped.values()]
  .map((material) => ({
    ...material,
    legacyPaths: uniqueBy(material.legacyPaths, key).sort((left, right) => left.localeCompare(right, 'pl')),
    moduleIds: [...new Set(material.moduleIds)].sort((left, right) => left.localeCompare(right, 'pl')),
    placements: uniqueBy(material.placements, (item) => `${item.kind}|${item.targetId}|${item.section ?? ''}`)
      .sort((left, right) => `${left.kind}|${left.targetId}`.localeCompare(`${right.kind}|${right.targetId}`, 'pl')),
    metadata: material.metadata && Object.values(material.metadata).some(Boolean) ? material.metadata : undefined,
  }))
  .sort((left, right) => left.title.localeCompare(right.title, 'pl'))

const releaseSuffix = String(manifest.version).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'content'
const catalog = {
  schemaVersion: 1,
  releaseId: `local-${releaseSuffix}`.slice(0, 120),
  generatedAt: new Date().toISOString(),
  contentVersion: String(manifest.version),
  materialCount: materials.length,
  totalBytes: materials.reduce((sum, material) => sum + material.size, 0),
  materials,
}

writeFileSync(resolve(contentRoot, 'materials-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`Katalog materiałów gotowy: ${catalog.materialCount} unikalnych zasobów, ${assets.length} ścieżek źródłowych.`)
