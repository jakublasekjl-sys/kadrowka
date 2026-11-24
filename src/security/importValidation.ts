import { z } from 'zod'
import type { PlanningDraft } from '../planning/planningModel'

export const maxBackupFileBytes = 20 * 1024 * 1024
export const maxPlanFileBytes = 8 * 1024 * 1024

const shortText = z.string().max(512)
const longText = z.string().max(500_000)
const profile = z.enum(['gromada', 'druzyna', 'zespol_kadry', 'haliz'])

export const planningDraftSchema: z.ZodType<PlanningDraft> = z.object({
  name: z.string().max(240),
  profile,
  stepIndex: z.number().int().min(0).max(100).default(0),
  skipped: z.array(z.string().max(120)).max(100).default([]),
  answers: z.record(z.string().max(300), longText).superRefine((value, context) => {
    if (Object.keys(value).length > 3_000) context.addIssue({ code: 'custom', message: 'Plan zawiera zbyt wiele odpowiedzi.' })
  }),
  selectedAnalysisToolIds: z.array(z.string().max(160)).max(200).default([]),
}).strict()

const meetingTaskSchema = z.object({
  task: z.string().max(20_000),
  person: z.string().max(2_000),
  due: z.string().max(2_000),
})

const meetingSchema = z.object({
  id: shortText,
  title: z.string().max(2_000),
  date: z.string().max(2_000).optional(),
  agenda: longText.optional(),
  decisions: longText.optional(),
  taskRows: z.array(meetingTaskSchema).max(500).optional(),
  tasks: longText.optional(),
  nextSteps: longText.optional(),
  updatedAt: shortText.optional(),
})

const draftIndexSchema = z.array(z.object({
  id: shortText,
  name: z.string().max(240),
  profile,
  updatedAt: shortText.default(''),
})).max(500)

const recentPagesSchema = z.array(z.object({
  id: shortText,
  title: z.string().max(2_000),
  subtitle: z.string().max(5_000).optional(),
  updatedAt: shortText.optional(),
})).max(100)

const planningInsightsSchema = z.array(z.object({
  id: shortText,
  sourceId: shortText.optional(),
  sourceTitle: z.string().max(2_000).optional(),
  type: shortText.optional(),
  text: longText.optional(),
  createdAt: shortText.optional(),
  updatedAt: shortText.optional(),
}).passthrough()).max(500)

const boundedStringRecord = z.record(z.string().max(300), longText).superRefine((value, context) => {
  if (Object.keys(value).length > 5_000) context.addIssue({ code: 'custom', message: 'Zbyt wiele wpisow w kopii.' })
})

const embeddedSchemas: Record<string, z.ZodType> = {
  kadrowka_my_work_favorite_pages: z.array(shortText).max(5_000),
  kadrowka_my_work_favorite_tools: z.array(z.record(z.string().max(300), z.unknown())).max(5_000),
  kadrowka_my_work_recent_pages: recentPagesSchema,
  kadrowka_my_work_page_notes: boundedStringRecord,
  kadrowka_my_work_page_note_types: boundedStringRecord,
  kadrowka_my_work_meetings: z.array(meetingSchema).max(1_000),
  kadrowka_my_work_planning_insights: planningInsightsSchema,
  kadrowka_planning_v2_draft_index: draftIndexSchema,
  kadrowka_ssi_requirement_checks_v1: z.array(shortText).max(10_000),
}

const forbiddenObjectKeys = new Set(['__proto__', 'prototype', 'constructor'])

function validateJsonTree(value: unknown) {
  let nodes = 0
  const visit = (current: unknown, depth: number) => {
    nodes += 1
    if (nodes > 100_000) throw new Error('Plik zawiera zbyt wiele elementow.')
    if (depth > 30) throw new Error('Plik ma zbyt gleboko zagniezdzona strukture.')
    if (typeof current === 'string' && current.length > 2_000_000) throw new Error('Plik zawiera zbyt dlugi tekst.')
    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1)
      return
    }
    if (!current || typeof current !== 'object') return
    const prototype = Object.getPrototypeOf(current)
    if (prototype !== Object.prototype && prototype !== null) throw new Error('Plik zawiera niedozwolony typ danych.')
    for (const [key, item] of Object.entries(current)) {
      if (key.length > 500 || forbiddenObjectKeys.has(key)) throw new Error('Plik zawiera niedozwolony klucz.')
      visit(item, depth + 1)
    }
  }
  visit(value, 0)
}

export async function parseJsonImport(file: File, maxBytes: number): Promise<unknown> {
  if (file.size <= 0) throw new Error('Wybrany plik jest pusty.')
  if (file.size > maxBytes) throw new Error(`Plik jest zbyt duzy. Maksymalny rozmiar to ${Math.floor(maxBytes / 1024 ** 2)} MB.`)
  const jsonName = file.name.toLocaleLowerCase('pl').endsWith('.json')
  const jsonType = !file.type || /^(application|text)\/(?:[a-z.+-]*\+)?json$/i.test(file.type)
  if (!jsonName && !jsonType) throw new Error('Wybierz plik kopii w formacie JSON.')
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text()) as unknown
  } catch {
    throw new Error('Plik nie zawiera prawidlowych danych JSON.')
  }
  validateJsonTree(parsed)
  return parsed
}

export async function parsePlanningDraftFile(file: File): Promise<PlanningDraft> {
  const parsed = await parseJsonImport(file, maxPlanFileBytes)
  const candidate = parsed && typeof parsed === 'object' && 'draft' in parsed
    ? (parsed as { draft?: unknown }).draft
    : parsed
  const result = planningDraftSchema.safeParse(candidate)
  if (!result.success) throw new Error('Plik nie jest prawidlowa kopia planu Kadrowki.')
  return result.data
}

export function sanitizeEmbeddedPreference(key: string, value: string): string {
  const schema = embeddedSchemas[key]
    ?? (/^kadrowka_planning_v2_draft(?:\.[a-z0-9-]{1,80})?$/i.test(key) ? planningDraftSchema : undefined)
  if (!schema) {
    if (value.length > 10_000_000) throw new Error(`Obszar ${key} zawiera zbyt dlugi tekst.`)
    return value
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    throw new Error(`Obszar ${key} zawiera uszkodzone dane.`)
  }
  validateJsonTree(parsed)
  const result = schema.safeParse(parsed)
  if (!result.success) throw new Error(`Obszar ${key} ma nieprawidlowa strukture.`)
  return JSON.stringify(result.data)
}
