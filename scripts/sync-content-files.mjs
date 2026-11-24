import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readZipCatalog } from './content-package-utils.mjs'
import { assertSafeArchive } from './security-utils.mjs'
import { applySourceImageRepairs } from './source-image-repairs.mjs'
import { sourcePackageZip } from './source-package.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(projectRoot, '..')
const zipPath = sourcePackageZip
const packageRoot = resolve(workspaceRoot, 'package/content-package')
const target = resolve(packageRoot, 'files')
const staging = resolve(packageRoot, '.content-files-staging')
const backup = resolve(packageRoot, '.content-files-backup')
const marker = resolve(packageRoot, '.kadrowka-content-version')
const expectedTarget = resolve(workspaceRoot, 'package/content-package/files')
if (target !== expectedTarget) throw new Error(`Nieoczekiwana ścieżka plików treści: ${target}`)
if (staging !== resolve(packageRoot, '.content-files-staging') || backup !== resolve(packageRoot, '.content-files-backup')) {
  throw new Error('Nieoczekiwana sciezka robocza plikow tresci.')
}
const currentVersion = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : ''

assertSafeArchive(readZipCatalog(zipPath))
const manifestResult = spawnSync('tar', ['-xOf', zipPath, 'manifest.json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 })
if (manifestResult.error || manifestResult.status !== 0) throw new Error('Nie mozna odczytac manifestu paczki zrodlowej.')
const manifest = JSON.parse(manifestResult.stdout)

if (currentVersion === manifest.version && existsSync(target) && process.env.KADROWKA_FORCE_REEXTRACT !== '1') {
  applySourceImageRepairs(target)
  console.log(`Pliki treści są aktualne (${manifest.version}).`)
  process.exit(0)
}

mkdirSync(packageRoot, { recursive: true })
if (existsSync(backup)) throw new Error(`Pozostala kopia po poprzedniej synchronizacji: ${backup}`)
rmSync(staging, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
try {
  const result = spawnSync('tar', ['-xf', zipPath, '-C', staging, 'files'], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Nie udało się rozpakować plików treści (tar: ${result.status}).`)
  const stagedFiles = resolve(staging, 'files')
  applySourceImageRepairs(stagedFiles)
  if (existsSync(target)) renameSync(target, backup)
  try {
    renameSync(stagedFiles, target)
    writeFileSync(marker, `${manifest.version}\n`, 'utf8')
  } catch (error) {
    if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    if (existsSync(backup)) renameSync(backup, target)
    throw error
  }
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true })
  console.log(`Rozpakowano pliki treści ${manifest.version} do ${target}.`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
