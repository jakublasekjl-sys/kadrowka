import type { ContentFile, ContentLink, SearchItem } from '../types/content'

export function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLocaleLowerCase('pl')
    .trim()
}

export function matchesQuery(query: string, ...values: unknown[]) {
  const normalized = normalizeText(query)
  if (!normalized) return true
  return normalizeText(values.join(' ')).includes(normalized)
}

export function relaxedKey(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '')
}

export function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, 'pl'),
  )
}

export function searchItemTarget(item: SearchItem): ContentLink {
  if (item.kind === 'module') {
    return { title: item.title, targetKind: 'module', targetId: item.targetId }
  }
  if (item.kind === 'page') {
    return { title: item.title, targetKind: 'page', targetId: item.targetId }
  }
  return item
}

export function toolFavoriteId(tool: ContentFile) {
  if (tool.favoriteId?.trim()) return tool.favoriteId.trim()
  if (tool.path) return `path:${tool.path.normalize('NFC')}`
  if (tool.url) return `url:${tool.url}`
  if (tool.id) return `id:${tool.id}`
  return `title:${normalizeText(tool.title)}`
}

export function toolCategory(tool: ContentFile) {
  return tool.category?.trim() || tool.categoryTitle?.trim() || tool.sourceModuleTitle?.trim() || tool.sourceModule?.trim() || 'Pozostałe narzędzia'
}

export function parseStringJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T
    if (fallback && typeof fallback === 'object') {
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback) as T
    }
    if (typeof fallback === 'string') return (typeof parsed === 'string' ? parsed : fallback) as T
    if (typeof fallback === 'boolean') return (typeof parsed === 'boolean' ? parsed : fallback) as T
    if (typeof fallback === 'number') return (typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback) as T
    return parsed as T
  } catch {
    return fallback
  }
}

export function formatDate(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
