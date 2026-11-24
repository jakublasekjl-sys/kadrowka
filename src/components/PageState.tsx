import { AlertTriangle, LoaderCircle } from 'lucide-react'

export function LoadingState() {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>Ładowanie treści…</p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-panel error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <h1>Nie udało się wczytać treści</h1>
      <p>{message}</p>
      <button className="secondary-action" type="button" onClick={() => window.location.reload()}>Spróbuj ponownie</button>
    </div>
  )
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}
