import { Link } from 'react-router-dom'
import { EmptyState } from '../components/PageState'

export function NotFoundPage() {
  return <div className="page-stack"><EmptyState title="Nie znaleziono strony" text="Ten adres nie prowadzi do dostępnej treści." /><Link className="primary-action" to="/">Wróć na Start</Link></div>
}
