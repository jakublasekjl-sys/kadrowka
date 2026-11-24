import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './database'
import { parseStringJson } from '../utils/content'
import { reportStorageWriteError } from './storageErrors'

export const myWorkKeys = {
  favoritePages: 'kadrowka_my_work_favorite_pages',
  favoriteTools: 'kadrowka_my_work_favorite_tools',
  recentPages: 'kadrowka_my_work_recent_pages',
  notes: 'kadrowka_my_work_page_notes',
  noteTypes: 'kadrowka_my_work_page_note_types',
  meetings: 'kadrowka_my_work_meetings',
  planningInsights: 'kadrowka_my_work_planning_insights',
  draftIndex: 'kadrowka_planning_v2_draft_index',
  ssiChecks: 'kadrowka_ssi_requirement_checks_v1',
} as const

export function useJsonPreference<T>(key: string, fallback: T) {
  return useLiveQuery(async () => {
    const record = await db.preferences.get(key)
    return parseStringJson<T>(record?.value, fallback)
  }, [key])
}

export async function saveJson(key: string, value: unknown) {
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

export async function togglePageFavorite(pageId: string) {
  const record = await db.preferences.get(myWorkKeys.favoritePages)
  const favorites = new Set(parseStringJson<string[]>(record?.value, []))
  if (favorites.has(pageId)) favorites.delete(pageId)
  else favorites.add(pageId)
  await saveJson(myWorkKeys.favoritePages, [...favorites])
}

export async function rememberPage(page: { id: string; title: string; subtitle?: string }) {
  const record = await db.preferences.get(myWorkKeys.recentPages)
  const recent = parseStringJson<Array<Record<string, unknown>>>(record?.value, []).filter(
    (item) => item.id !== page.id,
  )
  recent.unshift({ ...page, updatedAt: new Date().toISOString() })
  await saveJson(myWorkKeys.recentPages, recent.slice(0, 25))
}

export async function savePageNote(pageId: string, note: string, type: string, sourceTitle = pageId) {
  const [notesRecord, typesRecord] = await Promise.all([
    db.preferences.get(myWorkKeys.notes),
    db.preferences.get(myWorkKeys.noteTypes),
  ])
  const notes = parseStringJson<Record<string, string>>(notesRecord?.value, {})
  const types = parseStringJson<Record<string, string>>(typesRecord?.value, {})
  if (note.trim()) notes[pageId] = note.trim()
  else delete notes[pageId]
  if (type === 'Wniosek do planu') types[pageId] = type
  else delete types[pageId]
  const insightsRecord = await db.preferences.get(myWorkKeys.planningInsights)
  const insights = parseStringJson<Array<Record<string, unknown>>>(insightsRecord?.value, [])
  const insightId = `note:${pageId}`
  const existing = insights.find((item) => item.id === insightId)
  const nextInsights = insights.filter((item) => item.id !== insightId)
  if (note.trim() && type === 'Wniosek do planu') {
    const timestamp = new Date().toISOString()
    nextInsights.unshift({ id: insightId, sourceId: pageId, sourceTitle, type, text: note.trim(), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp })
  }
  await Promise.all([
    saveJson(myWorkKeys.notes, notes),
    saveJson(myWorkKeys.noteTypes, types),
    saveJson(myWorkKeys.planningInsights, nextInsights.slice(0, 80)),
  ])
}
