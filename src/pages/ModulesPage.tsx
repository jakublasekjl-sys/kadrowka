import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleIcon } from '../components/ModuleIcon'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/PageState'
import { useContent } from '../content/ContentContext'
import { moduleRoute } from '../content/moduleRoutes'

const hidden = new Set(['planowanie', 'narzedzia-dla-kadry', 'pozostale-materialy'])

export function ModulesPage() {
  const { content, loading, error } = useContent()
  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />
  return (
    <div className="page-stack">
      <PageHeader title="Moduły" lead="Treści merytoryczne uporządkowane według obszarów pracy z kadrą." />
      <div className="module-list">
        {content.modules.filter((module) => !hidden.has(module.id)).map((module) => { const route=moduleRoute(module); const inside=<><ModuleIcon module={module}/><div className="module-row-copy"><h2>{module.title}</h2>{module.description && <p>{module.description}</p>}</div><ArrowRight className="module-row-arrow" aria-hidden="true" /></>; return route.external ? <a className="list-row module-row" href={route.target} target="_blank" rel="noopener noreferrer" key={module.id}>{inside}</a> : (
          <Link className="list-row module-row" to={route.target} key={module.id}>
            {inside}
          </Link>
        )})}
      </div>
    </div>
  )
}
