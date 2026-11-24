import { useMemo, useState } from 'react'
import { ContentLinkButton } from '../components/ContentLink'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { SearchField } from '../components/SearchField'
import { useContent } from '../content/ContentContext'
import { processTitles, teamAreaTitles } from '../content/moduleExperience'
import { myWorkKeys, useJsonPreference } from '../db/myWork'
import type { SearchItem } from '../types/content'
import { matchesQuery, relaxedKey, searchItemTarget, toolCategory } from '../utils/content'

type Scope = 'Wszystko' | 'Czytaj' | 'Narzędzia' | 'Materiały' | 'Moja praca'

function workText(value: Record<string, unknown>) {
  return Object.values(value).flatMap((item) => Array.isArray(item) ? item : [item]).join(' ')
}

export function SearchPage() {
  const { content, loading, error } = useContent()
  const notesRaw = useJsonPreference<Record<string, string>>(myWorkKeys.notes, {})
  const noteTypesRaw = useJsonPreference<Record<string, string>>(myWorkKeys.noteTypes, {})
  const meetingsRaw = useJsonPreference<Array<Record<string, unknown>>>(myWorkKeys.meetings, [])
  const plansRaw = useJsonPreference<Array<Record<string, unknown>>>(myWorkKeys.draftIndex, [])
  const insightsRaw = useJsonPreference<Array<Record<string, unknown>>>(myWorkKeys.planningInsights, [])
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>('Wszystko')

  const items = useMemo(() => {
    if (!content) return []
    const notes = notesRaw ?? {}
    const noteTypes = noteTypesRaw ?? {}
    const meetings = meetingsRaw ?? []
    const plans = plansRaw ?? []
    const insights = insightsRaw ?? []
    const pageNotes: SearchItem[] = Object.entries(notes).map(([pageId, text]) => ({
      id: `note:${pageId}`, kind: 'note', scope: 'work', targetKind: 'page', targetId: pageId,
      title: noteTypes[pageId] ?? 'Pozostała notatka',
      subtitle: content.pages.find((page) => page.id === pageId)?.title ?? pageId, text,
    }))
    const protocols: SearchItem[] = meetings.map((meeting, index) => ({
      id: `meeting:${String(meeting.id ?? index)}`, kind: 'protocol', scope: 'work',
      targetKind: 'dashboard', targetId: 'meetings', title: String(meeting.title ?? 'Protokół odprawy'),
      subtitle: String(meeting.date ?? ''), text: workText(meeting),
    }))
    const planItems: SearchItem[] = plans.map((plan, index) => ({
      id: `plan:${String(plan.id ?? index)}`, kind: 'plan', scope: 'work', targetKind: 'planning',
      title: String(plan.name ?? 'Plan roboczy'), subtitle: String(plan.profile ?? ''), text: workText(plan),
    }))
    const insightItems: SearchItem[] = insights.map((item, index) => ({
      id: `insight:${String(item.id ?? index)}`, kind: 'insight', scope: 'work',
      targetKind: 'dashboard', targetId: 'plans', title: String(item.sourceTitle ?? 'Wniosek do planu'),
      subtitle: 'Wniosek do planu', text: String(item.text ?? ''),
    }))
    const toolItems: SearchItem[] = content.tools.map((tool) => ({
      ...tool,
      id: `tool:${tool.id ?? relaxedKey(tool.title)}`,
      kind: tool.kind ?? 'tool',
      scope: 'tool',
      subtitle: toolCategory(tool),
      text: [tool.description, tool.audiences?.join(' '), tool.usageModes?.join(' '), tool.levels?.join(' ')].filter(Boolean).join(' '),
    }))
    const core = content.search
      .filter((item) => !(item.path?.toLocaleLowerCase('pl').endsWith('.aspx') || (item.kind === 'file' && relaxedKey(item.title) === 'home')))
      .map((item) => ({
        ...item,
        title: (item.targetId && (processTitles[item.targetId] ?? teamAreaTitles[item.targetId])) || item.title,
        scope: (['page', 'module'].includes(item.kind ?? '') ? 'read' : 'material') as SearchItem['scope'],
      }))
    const seen = new Set<string>()
    return [...pageNotes, ...protocols, ...planItems, ...insightItems, ...toolItems, ...core].filter((item) => {
      const key = `${item.scope}|${relaxedKey(item.title)}|${item.path?.normalize('NFC') ?? item.url ?? item.targetId ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [content, insightsRaw, meetingsRaw, noteTypesRaw, notesRaw, plansRaw])

  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />

  const selectedScope: SearchItem['scope'] | undefined = scope === 'Czytaj' ? 'read' : scope === 'Narzędzia' ? 'tool' : scope === 'Materiały' ? 'material' : scope === 'Moja praca' ? 'work' : undefined
  const hasQuery = query.trim().length > 0
  const results = hasQuery ? items.filter((item) => (!selectedScope || item.scope === selectedScope) && matchesQuery(query, item.title, item.subtitle, item.text)).slice(0, 150) : []

  return (
    <div className="page-stack">
      <PageHeader title="Szukaj" lead="Przeszukuj treści, narzędzia, materiały i własne dokumenty." />
      <SearchField value={query} onChange={setQuery} placeholder="Wpisz szukaną frazę" />
      <div className="filter-chips" aria-label="Zakres wyszukiwania">
        {(['Wszystko', 'Czytaj', 'Narzędzia', 'Materiały', 'Moja praca'] as Scope[]).map((item) => <button type="button" className={scope === item ? 'active' : ''} onClick={() => setScope(item)} key={item}>{item}</button>)}
      </div>
      {hasQuery && <p className="result-count">Wyniki: {results.length}</p>}
      {results.length ? <div className="search-results">
        {results.map((item, index) => (
          <article className="search-result" key={item.id ?? index}>
            <div><h2>{item.title}</h2>{item.subtitle && <p>{item.subtitle}</p>}</div>
            <ContentLinkButton item={searchItemTarget(item)} />
          </article>
        ))}
      </div> : <EmptyState title={hasQuery ? 'Brak wyników' : 'Znajdź potrzebną treść'} text={hasQuery ? 'Zmień frazę albo wybierz inny zakres wyszukiwania.' : 'Wpisz nazwę zagadnienia, narzędzia, materiału albo własnego dokumentu.'} />}
    </div>
  )
}
