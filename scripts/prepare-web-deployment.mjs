import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateMaterialSignature } from './file-signature-utils.mjs'
import { pinReleaseSecurityHeaders } from './security-headers.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageMetadata = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const dist = resolve(root, 'dist')
const sourceFiles = resolve(root, '../package/content-package/files')
const indexedAssets = JSON.parse(readFileSync(resolve(dist, 'content/assets-index.json'), 'utf8'))
const indexedPaths = new Set(indexedAssets.map((asset) => asset.path.normalize('NFC').toLocaleLowerCase('pl')))
const releaseRoot = resolve(root, 'release')
const target = resolve(releaseRoot, 'kadrowka-web')
if (target !== resolve(root, 'release/kadrowka-web')) throw new Error(`Nieoczekiwana ścieżka wdrożenia: ${target}`)
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Brak buildu. Najpierw wykonaj pnpm build.')
if (!existsSync(sourceFiles)) throw new Error('Brak rozpakowanych materiałów. Wykonaj pnpm content:files.')

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) throw new Error(`Dowiazanie symboliczne nie moze trafic do wydania: ${path}`)
    return stat.isDirectory() ? walk(path) : [path]
  })
}

const targetFiles = resolve(target, 'content/files')
const seen = new Set()
const sourceMaterials = []
const invalidFiles = []
let copiedFiles = 0
let copiedBytes = 0
let excludedSnapshots = 0
let unicodeDuplicates = 0
for (const source of walk(sourceFiles)) {
  const sourceRelative = relative(sourceFiles, source)
  if (/\.aspx$/i.test(sourceRelative)) { excludedSnapshots += 1; continue }
  const normalizedRelative = sourceRelative.normalize('NFC')
  const key = `files/${normalizedRelative.replaceAll('\\', '/')}`.toLocaleLowerCase('pl')
  if (statSync(source).size > 128 * 1024 * 1024) {
    invalidFiles.push(`Plik przekracza limit 128 MB: ${sourceRelative}`)
    continue
  }
  try { validateMaterialSignature(source) } catch (error) {
    invalidFiles.push(`${sourceRelative}: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }
  if (!indexedPaths.has(key)) { invalidFiles.push(`Material nie wystepuje w indeksie: ${sourceRelative}`); continue }
  if (seen.has(key)) { unicodeDuplicates += 1; invalidFiles.push(`Kolizja nazw plikow: ${sourceRelative}`); continue }
  seen.add(key)
  sourceMaterials.push({ source, normalizedRelative })
}
if (sourceMaterials.reduce((sum, item) => sum + statSync(item.source).size, 0) > 2 * 1024 ** 3) {
  invalidFiles.push('Suma materialow przekracza 2 GB.')
}
for (const key of indexedPaths) if (!seen.has(key)) invalidFiles.push(`Brak materialu z indeksu: ${key}`)
if (invalidFiles.length) {
  throw new Error(`Paczka zawiera ${invalidFiles.length} nieprawidlowych materialow:\n${invalidFiles.slice(0, 20).join('\n')}`)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(dist, target, { recursive: true })
pinReleaseSecurityHeaders(target, JSON.parse(readFileSync(resolve(target, 'runtime-config.json'), 'utf8')))

for (const { source, normalizedRelative } of sourceMaterials) {
  const destination = resolve(targetFiles, normalizedRelative)
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
  copiedFiles += 1
  copiedBytes += statSync(source).size
}

const leakedSnapshots = walk(target).filter((path) => /\.aspx$/i.test(path))
if (leakedSnapshots.length) throw new Error(`Paczka zawiera niedozwolone pliki ASPX: ${leakedSnapshots.length}`)
const manifest = JSON.parse(readFileSync(resolve(dist, 'content/manifest.json'), 'utf8'))
writeFileSync(resolve(target, 'deployment-manifest.json'), `${JSON.stringify({
  appVersion: packageMetadata.version,
  packageVersion: manifest.version,
  generatedAt: new Date().toISOString(),
  materialFiles: copiedFiles,
  materialBytes: copiedBytes,
  excludedSharePointSnapshots: excludedSnapshots,
  skippedUnicodeDuplicates: unicodeDuplicates,
  quarantinedFiles: 0,
}, null, 2)}\n`, 'utf8')
console.log(`Paczka wdrożeniowa gotowa: ${target}`)
console.log(`Materiały: ${copiedFiles}; ${(copiedBytes / 1024 ** 2).toFixed(2)} MB; pominięte ASPX: ${excludedSnapshots}; błędne pliki: 0; duplikaty Unicode: ${unicodeDuplicates}.`)
