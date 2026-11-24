import { ArrowLeft, Star } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExperienceTabs, buildExperienceTabs } from '../components/PageExperience'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { useContent } from '../content/ContentContext'
import { resolvedPage } from '../content/moduleExperience'
import { myWorkKeys, rememberPage, togglePageFavorite, useJsonPreference } from '../db/myWork'

export function PageReader() {
  const { pageId = '' } = useParams()
  const { content, loading, error } = useContent()
  const favorites = useJsonPreference<string[]>(myWorkKeys.favoritePages, []) ?? []
  const page = content ? resolvedPage(content, pageId) : undefined

  useEffect(() => {
    if (page) void rememberPage({ id: page.id, title: page.title, subtitle: page.subtitle })
  }, [page])

  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />
  if (!page) return <EmptyState title="Nie znaleziono strony" />
  const favorite = favorites.includes(page.id)
  const tabs = buildExperienceTabs(content, page)

  return (
    <article className="reader page-stack">
      <Link className="back-link" to="/modules"><ArrowLeft aria-hidden="true" /> Wstecz</Link>
      <PageHeader
        eyebrow={content.modules.find((module) => module.id === page.moduleId)?.title}
        title={page.title}
        actions={(
          <button className={`icon-button favorite-button ${favorite ? 'is-favorite' : ''}`} type="button" title={favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'} onClick={() => void togglePageFavorite(page.id)}>
            <Star aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
          </button>
        )}
      />
      <ExperienceTabs tabs={tabs} />
      <Link className="back-button" to="/modules"><ArrowLeft aria-hidden="true" /> Wstecz</Link>
    </article>
  )
}
