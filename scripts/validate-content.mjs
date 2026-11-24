import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathKey, readZipCatalog } from './content-package-utils.mjs'
import { assertSafeArchive, safeContentPath, safeExternalUrl } from './security-utils.mjs'
import { allowedMaterialExtensions, validateMaterialSignature } from './file-signature-utils.mjs'
import { sourceImageRepairs } from './source-image-repairs.mjs'
import { sourcePackageZip } from './source-package.mjs'
import { extname } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(projectRoot, '..')
const contentRoot = process.env.KADROWKA_CONTENT_ROOT
  ? resolve(process.env.KADROWKA_CONTENT_ROOT)
  : resolve(projectRoot, 'public/content')
const zipPath = sourcePackageZip

function json(path) {
  return JSON.parse(readFileSync(resolve(contentRoot, path), 'utf8'))
}

function collectObjects(value, output = []) {
  if (!value || typeof value !== 'object') return output
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output)
    return output
  }
  output.push(value)
  for (const child of Object.values(value)) collectObjects(child, output)
  return output
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function normalizeForValidation(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLocaleLowerCase('pl')
}

if (!existsSync(zipPath)) throw new Error(`Brak paczki treści: ${zipPath}`)

const manifest = json('manifest.json')
const modules = json('modules.json')
const pages = json('pages.json')
const search = json('search/search-index.json')
const documents = json('documents.json')
const tools = json('tools-catalog.json')
const routeAliases = new Map([
  ['wydzielona-strona-ssi', 'system-stopni-instruktorskich-w-zhp'],
  ['proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-inf-zwrotna', 'proces-pracy-z-kadra-3-podsumowanie-pracy-rozmowa-inf-zwrotna'],
])
const zipEntries = readZipCatalog(zipPath)
assertSafeArchive(zipEntries)
const archiveAssets = zipEntries
  .filter((entry) => entry.path.startsWith('files/'))
  .map((entry) => {
    const folder = entry.path.split('/')[1]
    const moduleId = modules.some((module) => module.id === folder) ? folder : undefined
    return { ...entry, moduleId }
  })
const sourceSnapshots = archiveAssets.filter((entry) => /\.aspx$/i.test(entry.path))
const extractedFilesRoot = resolve(workspaceRoot, 'package/content-package/files')
const quarantinedAssets = []
const repairBySource = new Map(sourceImageRepairs.map((repair) => [pathKey(repair.from), repair]))
const publishableArchiveAssets = archiveAssets.map((entry) => {
  const repair = repairBySource.get(pathKey(entry.path))
  return repair ? { ...entry, path: repair.to } : entry
}).filter((entry) => {
  if (/\.aspx$/i.test(entry.path)) return false
  if (!allowedMaterialExtensions.has(extname(entry.path).toLocaleLowerCase('en'))) {
    quarantinedAssets.push({ entry, reason: 'niedozwolony typ pliku' })
    return false
  }
  const extracted = resolve(extractedFilesRoot, entry.path.replace(/^files\//, ''))
  if (!existsSync(extracted)) return true
  try {
    validateMaterialSignature(extracted)
    return true
  } catch (error) {
    quarantinedAssets.push({ entry, reason: error instanceof Error ? error.message : String(error) })
    return false
  }
})
const duplicateArchivePaths = duplicateValues(publishableArchiveAssets.map((entry) => pathKey(entry.path)))
const uniqueAssets = new Map()
for (const asset of publishableArchiveAssets) {
  const key = pathKey(asset.path)
  if (!uniqueAssets.has(key)) uniqueAssets.set(key, { ...asset, path: asset.path.normalize('NFC') })
}
const assets = [...uniqueAssets.values()].sort((left, right) => left.path.localeCompare(right.path, 'pl'))
const assetKeys = new Set(assets.map((entry) => pathKey(entry.path)))
const objects = collectObjects({ modules, pages, documents, tools })
const localReferences = [...new Set(objects.flatMap((item) => [item.path, item.src])
  .filter((value) => typeof value === 'string' && value.startsWith('files/') && !/\.aspx$/i.test(value)))]
const missingReferences = localReferences.filter((path) => !assetKeys.has(pathKey(path)))
const pageIds = new Set(pages.map((page) => page.id))
const moduleIds = new Set(modules.map((module) => module.id))
const brokenTargets = objects
  .filter((item) => item.targetId && (item.targetKind === 'page' || item.targetKind === 'module'))
  .filter((item) => item.targetKind === 'page'
    ? !pageIds.has(routeAliases.get(item.targetId) ?? item.targetId)
    : !moduleIds.has(item.targetId))
  .map((item) => `${item.targetKind}:${item.targetId}`)
const richTextBlocks = objects.filter((item) => Array.isArray(item.runs) && item.runs.length > 0)
const imageBlocks = objects.filter((item) => item.type === 'image')
const imageActions = imageBlocks.filter((item) => item.action && typeof item.action === 'object')
const invalidUrls = objects
  .map((item) => item.url)
  .filter((url) => typeof url === 'string' && url.trim())
  .filter((url) => !safeExternalUrl(url))
const invalidLocalPaths = objects
  .map((item) => item.path)
  .filter((path) => typeof path === 'string' && path.trim())
  .filter((path) => !safeContentPath(path))
const errors = []
const warnings = []
const notes = []


for (const [label, actual, expected] of [
  ['stron', pages.length, manifest.pagesCount],
  ['modułów', modules.length, manifest.modulesCount],
  ['elementów wyszukiwarki', search.length, manifest.searchItemsCount],
]) {
  if (actual !== expected) errors.push(`Liczba ${label}: ${actual}, manifest: ${expected}.`)
}
const expectedPresentFiles = Number(manifest.filesCount ?? 0)
if (archiveAssets.length !== expectedPresentFiles) {
  errors.push(`Wpisy plików w ZIP: ${archiveAssets.length}, manifest: ${expectedPresentFiles}.`)
}
for (const id of duplicateValues(pages.map((page) => page.id))) errors.push(`Duplikat strony: ${id}.`)
for (const id of duplicateValues(modules.map((module) => module.id))) errors.push(`Duplikat modułu: ${id}.`)
for (const id of duplicateValues(tools.map((tool) => tool.id))) errors.push(`Duplikat narzędzia: ${id}.`)
for (const id of duplicateValues(tools.map((tool) => tool.favoriteId))) errors.push(`Duplikat identyfikatora ulubionego narzędzia: ${id}.`)
for (const target of duplicateValues(brokenTargets)) errors.push(`Nieprawidłowy cel: ${target}.`)
for (const path of missingReferences) errors.push(`Brak pliku wskazanego przez treść: ${path}.`)
for (const url of [...new Set(invalidUrls)]) errors.push(`Nieprawidłowy lub niedozwolony adres URL: ${url}.`)
for (const path of [...new Set(invalidLocalPaths)]) errors.push(`Niebezpieczna ścieżka lokalna: ${path}.`)
for (const tool of tools) {
  const label = tool.title || tool.id || 'bez nazwy'
  if (!tool.path && !tool.url && !(tool.targetKind && tool.targetId)) errors.push(`Narzędzie bez celu: ${label}.`)
  if (!Array.isArray(tool.audiences) || !tool.audiences.length) errors.push(`Narzędzie bez odbiorcy: ${label}.`)
  if (!Array.isArray(tool.usageModes) || !tool.usageModes.length) errors.push(`Narzędzie bez sposobu używania: ${label}.`)
  if (!Array.isArray(tool.levels) || !tool.levels.length) errors.push(`Narzędzie bez poziomu organizacji: ${label}.`)
  if (/broszur|plakat/i.test(normalizeForValidation(tool.title))) errors.push(`Materiał informacyjny w katalogu narzędzi: ${label}.`)
}
if (tools.length < 60) errors.push(`Katalog narzędzi jest niekompletny: ${tools.length} pozycji.`)
if (!richTextBlocks.length) warnings.push('Treści nie zawierają zachowanego formatowania SharePoint.')
const reportedMissingFiles = Number(manifest.missingFilesCount ?? 0)
if (reportedMissingFiles > 0) {
  const sourceMessage = reportedMissingFiles === 1
    ? 'Eksporter źródłowy zachował informację o jednym brakującym zasobie'
    : `Eksporter źródłowy zachował informację o ${reportedMissingFiles} brakujących zasobach`
  const reference = reportedMissingFiles === 1 ? 'niego' : 'nich'
  notes.push(`${sourceMessage}, ale żadna publikowana strona ani narzędzie nie odwołuje się do ${reference}.`)
}
if (duplicateArchivePaths.length) {
  notes.push(`${duplicateArchivePaths.length} plik w ZIP ma zdublowaną nazwę po normalizacji Unicode; publikacja wybiera jedną kopię tej ścieżki.`)
}
if (quarantinedAssets.length) {
  errors.push(`${quarantinedAssets.length} plik ma niezgodny typ lub sygnature: ${quarantinedAssets.map(({ entry }) => entry.path).join(', ')}.`)
}
if (sourceImageRepairs.length) {
  notes.push(`${sourceImageRepairs.length} obraz z paczki zrodlowej ma poprawiona nazwe zgodna z formatem PNG.`)
}
const unassigned = assets.filter((asset) => !asset.moduleId).length
if (unassigned) warnings.push(`${unassigned} plików nie przypisano automatycznie do modułu.`)

const report = {
  generatedAt: new Date().toISOString(),
  packageVersion: manifest.version,
  status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
  errors,
  warnings,
  notes,
  counts: {
    pages: pages.length,
    modules: modules.length,
    searchItems: search.length,
    assets: assets.length,
    archiveAssets: archiveAssets.length,
    excludedSourceSnapshots: sourceSnapshots.length,
    quarantinedAssets: quarantinedAssets.length,
    repairedImages: sourceImageRepairs.length,
    referencedAssets: localReferences.length,
    richTextBlocks: richTextBlocks.length,
    imageBlocks: imageBlocks.length,
    imageActions: imageActions.length,
    tools: tools.length,
    totalAssetBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
  },
}

writeFileSync(resolve(contentRoot, 'assets-index.json'), JSON.stringify(assets, null, 2), 'utf8')
writeFileSync(resolve(contentRoot, 'diagnostics.json'), JSON.stringify(report, null, 2), 'utf8')
console.log(`Kontrola treści: ${report.status}; błędy: ${errors.length}; ostrzeżenia: ${warnings.length}; informacje: ${notes.length}; pliki: ${assets.length}.`)
if (errors.length) {
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
}
