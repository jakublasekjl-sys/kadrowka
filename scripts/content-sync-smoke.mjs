import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const manifest = resolve(root, 'public/content/manifest.json')
const staging = resolve(root, '.content-sync-staging')
const before = readFileSync(manifest)
const result = spawnSync(process.execPath, [resolve(root, 'scripts/sync-content-transaction.mjs')], {
  cwd: root,
  env: { ...process.env, KADROWKA_TEST_SYNC_FAILURE: '1' },
  encoding: 'utf8',
})
assert.ifError(result.error)
assert.notEqual(result.status, 0, 'Kontrolowana awaria synchronizacji nie przerwała procesu.')
assert.deepEqual(readFileSync(manifest), before, 'Nieudana synchronizacja zmieniła aktywną paczkę treści.')
assert.equal(existsSync(staging), false, 'Nieudana synchronizacja pozostawiła niepełny katalog roboczy.')
assert.match(`${result.stdout}\n${result.stderr}`, /dotychczasowe tresci pozostaly bez zmian/i)
console.log('Synchronizacja treści: OK (awaria przed publikacją nie zmienia aktywnej paczki).')
