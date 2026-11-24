import { Filter, RotateCcw, Star, X } from 'lucide-react'
import { useState } from 'react'
import { ContentLinkButton } from '../components/ContentLink'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/PageState'
import { SearchField } from '../components/SearchField'
import { useContent } from '../content/ContentContext'
import { myWorkKeys, saveJson, useJsonPreference } from '../db/myWork'
import type { ContentFile } from '../types/content'
import { matchesQuery, toolCategory, toolFavoriteId, uniqueValues } from '../utils/content'

const all = 'Wszystkie'

const toolTypeLabels: Record<string, string> = {
  analysis: 'Analiza',
  course: 'Kurs',
  pdf: 'PDF',
  spreadsheet: 'Arkusz',
  tool: 'Narzędzie',
  word: 'Dokument Word',
  xlsx: 'Arkusz',
  docx: 'Dokument Word',
}

function toolTypeLabel(type?: string) {
  if (!type) return ''
  return toolTypeLabels[type.toLocaleLowerCase('pl')] ?? type
}

function toolAudiences(tool: ContentFile) {
  return tool.audiences?.length ? tool.audiences : tool.audience ? [tool.audience] : []
}

function toolUsageModes(tool: ContentFile) {
  return tool.usageModes?.length ? tool.usageModes : tool.mode ? [tool.mode] : []
}

function toolLevels(tool: ContentFile) {
  return tool.levels?.length ? tool.levels : tool.level ? [tool.level] : []
}

function FilterSelect({ label, value, values, onChange }: {
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={all}>{all}</option>
        {values.map((item) => <option value={item} key={item}>{item}</option>)}
      </select>
    </label>
  )
}

export function ToolsPage() {
  const { content, loading, error } = useContent()
  const favoriteTools = useJsonPreference<ContentFile[]>(myWorkKeys.favoriteTools, []) ?? []
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(all)
  const [audience, setAudience] = useState(all)
  const [usageMode, setUsageMode] = useState(all)
  const [level, setLevel] = useState(all)
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia('(max-width: 720px)').matches)

  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />

  const tools = content.tools
  const categories = uniqueValues(tools.map(toolCategory))
  const audiences = uniqueValues(tools.flatMap(toolAudiences))
  const usageModes = uniqueValues(tools.flatMap(toolUsageModes))
  const levels = uniqueValues(tools.flatMap(toolLevels))
  const favoriteIds = new Set(favoriteTools.map(toolFavoriteId))
  const activeFilters = [category, audience, usageMode, level].filter((value) => value !== all).length
  const activeFilterItems = [
    { label: 'Kategoria', value: category, clear: () => setCategory(all) },
    { label: 'Odbiorca', value: audience, clear: () => setAudience(all) },
    { label: 'Sposób używania', value: usageMode, clear: () => setUsageMode(all) },
    { label: 'Poziom', value: level, clear: () => setLevel(all) },
  ].filter((item) => item.value !== all)
  const visible = tools.filter((tool) => {
    const categoryName = toolCategory(tool)
    return (category === all || categoryName === category)
      && (audience === all || toolAudiences(tool).includes(audience))
      && (usageMode === all || toolUsageModes(tool).includes(usageMode))
      && (level === all || toolLevels(tool).includes(level))
      && matchesQuery(
        query,
        tool.title,
        tool.description,
        categoryName,
        toolAudiences(tool),
        toolUsageModes(tool),
        toolLevels(tool),
        tool.sourceModuleTitle,
        tool.type,
      )
  })

  function clearFilters() {
    setCategory(all)
    setAudience(all)
    setUsageMode(all)
    setLevel(all)
  }

  function clearSearchAndFilters() {
    setQuery('')
    clearFilters()
  }

  async function toggleFavorite(tool: ContentFile) {
    const id = toolFavoriteId(tool)
    const next = favoriteTools.filter((item) => toolFavoriteId(item) !== id)
    if (!favoriteIds.has(id)) next.unshift({ ...tool, favoriteId: id, updatedAt: new Date().toISOString() })
    await saveJson(myWorkKeys.favoriteTools, next.slice(0, 120))
  }

  return (
    <div className="page-stack">
      <PageHeader title="Narzędzia pracy z kadrą" lead={`${tools.length} konkretnych narzędzi i metod w jednym katalogu.`} />
      <SearchField value={query} onChange={setQuery} placeholder="Szukaj narzędzia" />
      <details className="tool-filters" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
        <summary>
          <span><Filter aria-hidden="true" /> Filtry</span>
          <small>{activeFilters ? `${activeFilters} aktywne` : 'Wszystkie narzędzia'}</small>
        </summary>
        <div className="tool-filter-grid">
          <FilterSelect label="Kategoria" value={category} values={categories} onChange={setCategory} />
          <FilterSelect label="Odbiorca" value={audience} values={audiences} onChange={setAudience} />
          <FilterSelect label="Sposób używania" value={usageMode} values={usageModes} onChange={setUsageMode} />
          <FilterSelect label="Poziom organizacji" value={level} values={levels} onChange={setLevel} />
        </div>
        {activeFilters > 0 && (
          <button className="text-button tool-filter-reset" type="button" onClick={clearFilters}>
            <RotateCcw aria-hidden="true" /> Wyczyść filtry
          </button>
        )}
      </details>
      {activeFilterItems.length > 0 && (
        <div className="active-tool-filters" aria-label="Aktywne filtry">
          {activeFilterItems.map((item) => (
            <button type="button" onClick={item.clear} aria-label={`Usuń filtr: ${item.label} - ${item.value}`} key={item.label}>
              <span>{item.label}: {item.value}</span><X aria-hidden="true" />
            </button>
          ))}
          {activeFilterItems.length > 1 && <button className="clear-all" type="button" onClick={clearFilters}><RotateCcw aria-hidden="true" /><span>Wyczyść</span></button>}
        </div>
      )}
      <p className="result-count">Wyniki: {visible.length}</p>
      {visible.length > 0 ? (
        <div className="tool-list">
          {visible.map((tool, index) => {
            const favorite = favoriteIds.has(toolFavoriteId(tool))
            return (
              <article className="tool-row" key={toolFavoriteId(tool) || index}>
                <div className="tool-main">
                  <div><h2>{tool.title}</h2>{tool.description && <p>{tool.description}</p>}</div>
                  <button className={`icon-button ${favorite ? 'is-favorite' : ''}`} type="button" onClick={() => void toggleFavorite(tool)} title={favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}>
                    <Star aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="metadata-line">{[toolCategory(tool), toolTypeLabel(tool.type)].filter(Boolean).join(' · ')}</div>
                <dl className="tool-metadata">
                  <div><dt>Odbiorcy</dt><dd>{toolAudiences(tool).join(', ')}</dd></div>
                  <div><dt>Sposób używania</dt><dd>{toolUsageModes(tool).join(', ')}</dd></div>
                  <div><dt>Poziom</dt><dd>{toolLevels(tool).join(', ')}</dd></div>
                </dl>
                <ContentLinkButton item={tool} />
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <Filter aria-hidden="true" />
          <h2>Brak pasujących narzędzi</h2>
          <button className="secondary-action" type="button" onClick={clearSearchAndFilters}>Wyczyść wyszukiwanie i filtry</button>
        </div>
      )}
    </div>
  )
}
