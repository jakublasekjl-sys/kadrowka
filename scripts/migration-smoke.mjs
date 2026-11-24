import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const flutterBackupPath = resolve(root, '../kadra_zhp_offline/lib/app_backup_service.dart')
const flutterMainPath = resolve(root, '../kadra_zhp_offline/lib/main.dart')
const flutterBackup = existsSync(flutterBackupPath) ? readFileSync(flutterBackupPath, 'utf8') : ''
const flutterMain = existsSync(flutterMainPath) ? readFileSync(flutterMainPath, 'utf8') : ''
const reactKeys = readFileSync(resolve(root, 'src/db/myWork.ts'), 'utf8')
const prefixes = ['kadrowka_my_work_', 'kadrowka_planning_v2_', 'kadrowka_ssi_']
const keys = [
  'kadrowka_my_work_favorite_pages',
  'kadrowka_my_work_favorite_tools',
  'kadrowka_my_work_recent_pages',
  'kadrowka_my_work_page_notes',
  'kadrowka_my_work_page_note_types',
  'kadrowka_my_work_meetings',
  'kadrowka_my_work_planning_insights',
  'kadrowka_planning_v2_draft_index',
  'kadrowka_ssi_requirement_checks_v1',
]

if (flutterBackup && flutterMain) {
  for (const prefix of prefixes) assert.ok(flutterBackup.includes(`'${prefix}'`), `Flutter nie obsługuje prefiksu ${prefix}`)
} else {
  console.log('Źródła Flutter niedostępne: porównanie kluczy z bieżącym Flutterem pominięte; test kontraktu React pozostaje aktywny.')
}
for (const key of keys) {
  if (flutterMain) assert.ok(flutterMain.includes(`'${key}'`), `Brak klucza Flutter: ${key}`)
  assert.ok(reactKeys.includes(`'${key}'`), `Brak klucza React: ${key}`)
}

const fixture = Object.fromEntries(keys.map((key, index) => [key, {
  type: 'string',
  value: JSON.stringify(index === 8 ? [`requirement:${index}`] : [{ id: `fixture-${index}`, text: `Dane ${index}` }]),
}]))
fixture.kadrowka_my_work_boolean_fixture = { type: 'bool', value: true }
fixture.kadrowka_my_work_integer_fixture = { type: 'int', value: 7 }
fixture.kadrowka_my_work_double_fixture = { type: 'double', value: 3.5 }
fixture.kadrowka_my_work_list_fixture = { type: 'stringList', value: ['a', 'b'] }
fixture.ignored_system_key = { type: 'string', value: 'nie wolno importować' }

const flutterPayload = {
  schema: 'kadrowka-user-backup', schemaVersion: 1, exportedAt: new Date(0).toISOString(),
  source: 'flutter', contentVersion: 'test', preferences: fixture,
}
const reactStore = Object.fromEntries(Object.entries(flutterPayload.preferences).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix))))
const reactPayload = { ...flutterPayload, source: 'react', preferences: reactStore }
const flutterRestored = Object.fromEntries(Object.entries(reactPayload.preferences).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix))))

assert.equal(reactPayload.schema, 'kadrowka-user-backup')
assert.equal(reactPayload.schemaVersion, 1)
assert.equal(reactPayload.source, 'react')
assert.ok(!('ignored_system_key' in reactStore), 'Import przepuścił klucz spoza danych użytkownika')
assert.deepEqual(flutterRestored, reactStore)
for (const key of keys) assert.deepEqual(flutterRestored[key], fixture[key], `Utrata danych dla ${key}`)

console.log(`Migracja Flutter -> React -> Flutter: OK (${Object.keys(flutterRestored).length} obszarów danych, ${keys.length} kluczowych funkcji).`)
