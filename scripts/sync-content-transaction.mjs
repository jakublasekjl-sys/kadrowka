import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'public/content')
const staging = resolve(root, '.content-sync-staging')
const rollback = resolve(root, '.content-sync-rollback')

function removeChecked(path, expected) {
  if (path !== expected || dirname(path) !== root) throw new Error(`Nieoczekiwana sciezka robocza: ${path}`)
  rmSync(path, { recursive: true, force: true })
}

function versionAt(directory) {
  try { return JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')).version ?? '' } catch { return '' }
}

function run(script) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', script)], {
    cwd: root,
    env: { ...process.env, KADROWKA_CONTENT_ROOT: staging },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${script} zakonczyl sie kodem ${result.status}.`)
}

removeChecked(staging, resolve(root, '.content-sync-staging'))
try {
  for (const script of [
    'sync-content-core.mjs',
    'normalize-content-paths.mjs',
    'enrich-sharepoint-content.mjs',
    'build-tools-catalog.mjs',
    'validate-content.mjs',
    'build-materials-catalog.mjs',
  ]) run(script)

  if (process.env.KADROWKA_TEST_SYNC_FAILURE === '1') throw new Error('Kontrolowana awaria testowa przed publikacja.')

  const previousVersion = versionAt(target)
  const nextVersion = versionAt(staging)
  if (!nextVersion) throw new Error('Nowa paczka nie ma prawidlowego manifestu.')
  writeFileSync(resolve(staging, 'content-sync-state.json'), `${JSON.stringify({
    status: 'complete',
    synchronizedAt: new Date().toISOString(),
    packageVersion: nextVersion,
    previousPackageVersion: previousVersion || null,
    rollbackAvailable: existsSync(target),
  }, null, 2)}\n`, 'utf8')

  removeChecked(rollback, resolve(root, '.content-sync-rollback'))
  if (existsSync(target)) renameSync(target, rollback)
  try {
    renameSync(staging, target)
  } catch (error) {
    if (existsSync(rollback) && !existsSync(target)) renameSync(rollback, target)
    throw error
  }
  console.log(`Synchronizacja zakonczona: ${nextVersion}. Poprzednia paczka: ${previousVersion || 'brak'}.`)
} catch (error) {
  removeChecked(staging, resolve(root, '.content-sync-staging'))
  console.error(`Synchronizacja odrzucona; dotychczasowe tresci pozostaly bez zmian. ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
}
