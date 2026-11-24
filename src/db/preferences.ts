import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PreferenceRecord } from './database'
import { reportStorageWriteError } from './storageErrors'

export function usePreference(key: string) {
  return useLiveQuery(() => db.preferences.get(key), [key])
}

export function parseJsonValue<T>(record: PreferenceRecord | undefined, fallback: T): T {
  if (record?.type !== 'string' || typeof record.value !== 'string') return fallback
  try {
    return JSON.parse(record.value) as T
  } catch {
    return fallback
  }
}

export async function saveJsonPreference(key: string, value: unknown) {
  try {
    await db.preferences.put({
      key,
      type: 'string',
      value: JSON.stringify(value),
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    reportStorageWriteError(error)
    throw error
  }
}
