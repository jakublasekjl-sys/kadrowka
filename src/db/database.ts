import Dexie, { type EntityTable } from 'dexie'

export type PreferenceType = 'string' | 'bool' | 'int' | 'double' | 'stringList'

export interface PreferenceRecord {
  key: string
  type: PreferenceType
  value: unknown
  updatedAt: string
}

export interface MetaRecord {
  key: string
  value: string
}

export const db = new Dexie('kadrowka') as Dexie & {
  preferences: EntityTable<PreferenceRecord, 'key'>
  meta: EntityTable<MetaRecord, 'key'>
}

db.version(1).stores({
  preferences: 'key, type, updatedAt',
  meta: 'key',
})

export const userKeyPrefixes = [
  'kadrowka_my_work_',
  'kadrowka_planning_v2_',
  'kadrowka_ssi_',
] as const

export function isUserDataKey(key: string) {
  return userKeyPrefixes.some((prefix) => key.startsWith(prefix))
}
