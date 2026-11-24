import { z } from 'zod'
import { maxBackupFileBytes, parseJsonImport, sanitizeEmbeddedPreference } from '../security/importValidation'
import { db, isUserDataKey, type PreferenceRecord, type PreferenceType } from './database'

const preferenceSchema = z.object({
  type: z.enum(['string', 'bool', 'int', 'double', 'stringList']),
  value: z.unknown(),
}).strict().superRefine((record, context) => {
  const valid = record.type === 'string' ? typeof record.value === 'string' && record.value.length <= 10_000_000
    : record.type === 'bool' ? typeof record.value === 'boolean'
      : record.type === 'int' ? Number.isSafeInteger(record.value)
        : record.type === 'double' ? typeof record.value === 'number' && Number.isFinite(record.value)
          : Array.isArray(record.value) && record.value.length <= 5_000 && record.value.every((item) => typeof item === 'string' && item.length <= 20_000)
  if (!valid) context.addIssue({ code: 'custom', message: 'Wartość nie pasuje do zadeklarowanego typu.' })
})

const backupSchema = z.object({
  schema: z.literal('kadrowka-user-backup'),
  schemaVersion: z.literal(1),
  exportedAt: z.string().max(80).refine((value) => Number.isFinite(Date.parse(value))),
  source: z.enum(['flutter', 'react']),
  contentVersion: z.string().max(200).optional(),
  preferences: z.record(z.string().max(240), preferenceSchema).superRefine((value, context) => {
    if (Object.keys(value).length > 1_000) context.addIssue({ code: 'custom', message: 'Kopia zawiera zbyt wiele obszarów danych.' })
  }),
}).strict()

export type UserBackup = z.infer<typeof backupSchema>

function downloadJson(value: unknown, prefix: string) {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${prefix}-${stamp}.json`
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function createBackup(contentVersion = ''): Promise<UserBackup> {
  const records = await db.preferences.toArray()
  const preferences = Object.fromEntries(
    records
      .filter((record) => isUserDataKey(record.key))
      .map((record) => [record.key, { type: record.type, value: record.value }]),
  )
  return {
    schema: 'kadrowka-user-backup',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: 'react',
    contentVersion,
    preferences,
  }
}

export async function downloadBackup(
  contentVersion = '',
  prefix = 'kadrowka-kopia-twojej-pracy',
) {
  downloadJson(await createBackup(contentVersion), prefix)
}

export async function verifyBackupCompatibility(contentVersion = '') {
  const backup = backupSchema.parse(await createBackup(contentVersion))
  const invalidKeys = Object.keys(backup.preferences).filter((key) => !isUserDataKey(key))
  if (invalidKeys.length) throw new Error(`Kopia zawiera niedozwolone klucze: ${invalidKeys.join(', ')}`)
  return { preferences: Object.keys(backup.preferences).length, source: backup.source, schemaVersion: backup.schemaVersion }
}

export async function importBackupFile(file: File, contentVersion = '') {
  const candidate = await parseJsonImport(file, maxBackupFileBytes)
  const result = backupSchema.safeParse(candidate)
  if (!result.success) throw new Error('Plik nie jest prawidłową kopią danych Kadrówki.')
  const parsed = result.data
  const invalidKeys = Object.keys(parsed.preferences).filter((key) => !isUserDataKey(key) || !/^[a-z0-9_.:-]+$/i.test(key))
  if (invalidKeys.length) throw new Error('Kopia zawiera niedozwolone obszary danych.')
  const existing = await db.preferences.count()
  if (existing > 0) {
    await downloadBackup(contentVersion, 'kadrowka-kopia-przed-wczytaniem')
  }

  const now = new Date().toISOString()
  const records: PreferenceRecord[] = Object.entries(parsed.preferences)
    .map(([key, record]) => {
      if (key === 'kadrowka_ssi_requirement_checks_v1' && record.type === 'stringList') {
        return { key, type: 'string', value: JSON.stringify(record.value), updatedAt: now }
      }
      return {
        key,
        type: record.type as PreferenceType,
        value: record.type === 'string'
          ? sanitizeEmbeddedPreference(key, record.value as string)
          : record.value,
        updatedAt: now,
      }
    })

  await db.transaction('rw', db.preferences, async () => {
    await db.preferences.bulkPut(records)
  })
  await db.meta.put({ key: 'lastImportAt', value: now })
  await db.meta.put({ key: 'lastImportSource', value: parsed.source })
  return { importedCount: records.length, source: parsed.source }
}

export function decodeJsonPreference(record?: PreferenceRecord) {
  if (!record || record.type !== 'string' || typeof record.value !== 'string') {
    return null
  }
  try {
    return JSON.parse(record.value) as unknown
  } catch {
    return null
  }
}
