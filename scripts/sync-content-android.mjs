import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sourcePackageZip } from './source-package.mjs'
import { applySourceImageRepairs } from './source-image-repairs.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(projectRoot, '..')
const zipPath = sourcePackageZip
const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'public/content/manifest.json'), 'utf8'))
const publicRoot = resolve(projectRoot, 'android/app/src/main/assets/public')
const target = resolve(publicRoot, 'content/files')
const marker = resolve(publicRoot, '.kadrowka-content-version')
const expectedTarget = resolve(projectRoot, 'android/app/src/main/assets/public/content/files')
if (target !== expectedTarget) throw new Error(`Nieoczekiwana ścieżka zasobów Androida: ${target}`)

if (!existsSync(publicRoot)) throw new Error('Najpierw wykonaj cap sync android.')
const markerVersion = `${manifest.version}|publishable-v2`
const currentVersion = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : ''
if (currentVersion === markerVersion && existsSync(target)) {
  console.log(`Pełna paczka Android jest aktualna (${manifest.version}).`)
  process.exit(0)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(resolve(publicRoot, 'content'), { recursive: true })
const temporaryRoot = resolve(projectRoot, '.content-android-tmp')
rmSync(temporaryRoot, { recursive: true, force: true })
mkdirSync(temporaryRoot, { recursive: true })
const result = spawnSync('tar', ['-xf', zipPath, '-C', temporaryRoot, 'files'], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`Nie udało się przygotować paczki Android (tar: ${result.status}).`)
const extractedFiles = resolve(temporaryRoot, 'files')
applySourceImageRepairs(extractedFiles)
const pending = [extractedFiles]
const seen = new Set()
while (pending.length) {
  const directory = pending.pop()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = resolve(directory, entry.name)
    if (entry.isDirectory()) { pending.push(source); continue }
    const sourceRelative = relative(extractedFiles, source)
    if (/\.aspx$/i.test(sourceRelative)) continue
    const normalizedRelative = sourceRelative.normalize('NFC')
    const key = normalizedRelative.replaceAll('\\', '/').toLocaleLowerCase('pl')
    if (seen.has(key)) continue
    seen.add(key)
    const destination = resolve(target, normalizedRelative)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
    if (!statSync(destination).isFile()) throw new Error(`Nie udało się skopiować ${normalizedRelative}`)
  }
}
rmSync(temporaryRoot, { recursive: true, force: true })
writeFileSync(marker, `${markerVersion}\n`, 'utf8')
console.log(`Dołączono ${manifest.version} do zasobów Androida. Uwaga: wynikowy pakiet będzie bardzo duży.`)
