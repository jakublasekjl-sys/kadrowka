import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ContentLinkButton } from '../components/ContentLink'
import { BlockRenderer } from '../components/BlockRenderer'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { useContent } from '../content/ContentContext'
import { readingBlocks } from '../content/moduleExperience'
import { CzuwajArticlesPage } from './CzuwajArticlesPage'

const externalModules: Record<string, string> = {
  'funkcje-w-zhp': 'https://gkzhp.sharepoint.com/sites/platforma-kadry',
}

export function ModulePage() {
  const { moduleId = '' } = useParams()
  const { content, loading, error } = useContent()
  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />
  const module = content.modules.find((item) => item.id === moduleId)
  if (!module) return <EmptyState title="Nie znaleziono modułu" />
  if (module.id === 'artykuly-z-czuwaj') return <CzuwajArticlesPage content={content} module={module} />

  const pageIds = new Set(
    (module.pages ?? []).map((item) => String(item.id ?? item.targetId ?? '')).filter(Boolean),
  )
  const pages = content.pages.filter(
    (page) => page.moduleId === module.id || pageIds.has(page.id),
  )
  const mainPage = pages.find((page) => page.id === module.id) ?? pages[0]
  const subpages = pages.filter((page) => page.id !== mainPage?.id && readingBlocks(page).length > 0)
  const externalUrl = externalModules[module.id]

  return (
    <div className="page-stack">
      <Link className="back-link" to="/modules"><ArrowLeft aria-hidden="true" /> Moduły</Link>
      <PageHeader title={module.title} lead={module.description} />
      {externalUrl ? (
        <a className="primary-action" href={externalUrl} target="_blank" rel="noopener noreferrer">
          Otwórz stronę <ExternalLink aria-hidden="true" />
        </a>
      ) : mainPage ? (
        <Link className="primary-action" to={`/page/${mainPage.id}`}>
          Czytaj <FileText aria-hidden="true" />
        </Link>
      ) : null}

      {subpages.length > 0 && (
        <section>
          <h2 className="section-title">Podstrony</h2>
          <div className="accordion-list">
            {subpages.map((page, index) => (
              <details className="module-page-accordion" open={index === 0} key={page.id}>
                <summary><div><h3>{page.title}</h3>{page.summary && <p>{page.summary}</p>}</div></summary>
                <div className="module-page-content">
                  <BlockRenderer blocks={readingBlocks(page)} />
                  <Link className="secondary-action" to={`/page/${page.id}`}>Otwórz podstronę osobno</Link>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {!!module.files?.length && (
        <section>
          <h2 className="section-title">Materiały</h2>
          <div className="content-links material-list">
            {module.files.filter((file) => file.type !== 'page').map((file, index) => (
              <ContentLinkButton item={file} key={file.id ?? file.path ?? index} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
