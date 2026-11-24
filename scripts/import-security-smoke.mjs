import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  maxBackupFileBytes,
  parseJsonImport,
  parsePlanningDraftFile,
  planningDraftSchema,
  sanitizeEmbeddedPreference,
} from '../src/security/importValidation.ts'

const root = resolve(import.meta.dirname, '..')
const fixture = JSON.parse(readFileSync(resolve(root, 'test/fixtures/flutter-backup-v1.json'), 'utf8'))

for (const [key, record] of Object.entries(fixture.preferences)) {
  if (record.type !== 'string') continue
  const sanitized = sanitizeEmbeddedPreference(key, record.value)
  assert.equal(typeof sanitized, 'string')
  JSON.parse(sanitized)
}

const legacyDraft = JSON.parse(sanitizeEmbeddedPreference(
  'kadrowka_planning_v2_draft',
  fixture.preferences.kadrowka_planning_v2_draft.value,
))
assert.deepEqual(legacyDraft.skipped, [])
assert.deepEqual(legacyDraft.selectedAnalysisToolIds, [])

const validDraft = planningDraftSchema.parse({ name: 'Test', profile: 'druzyna', stepIndex: 0, answers: {} })
assert.equal(validDraft.profile, 'druzyna')
assert.throws(() => planningDraftSchema.parse({ ...validDraft, profile: 'admin' }))
assert.throws(() => planningDraftSchema.parse({ ...validDraft, unexpected: '<script>alert(1)</script>' }))

const wrappedPlan = new File([
  JSON.stringify({ schema: 'kadrowka-planning-draft', draft: validDraft }),
], 'plan.json', { type: 'application/json' })
assert.deepEqual(await parsePlanningDraftFile(wrappedPlan), validDraft)

await assert.rejects(
  parseJsonImport(new File(['{"__proto__":{"polluted":true}}'], 'kopia.json', { type: 'application/json' }), maxBackupFileBytes),
  /niedozwolony klucz/i,
)
await assert.rejects(
  parseJsonImport({ size: maxBackupFileBytes + 1, name: 'kopia.json', type: 'application/json', text: async () => '{}' }, maxBackupFileBytes),
  /zbyt duzy/i,
)
await assert.rejects(
  parseJsonImport(new File(['nie-json'], 'kopia.json', { type: 'application/json' }), maxBackupFileBytes),
  /JSON/i,
)

console.log('Import danych: OK (zgodność kopii Flutter, limity, schemat planu i odporność na uszkodzony JSON).')
