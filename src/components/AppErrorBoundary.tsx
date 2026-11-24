import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Nieobsłużony błąd interfejsu Kadrówki.', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="fatal-error" role="alert">
        <img src="/kadrowka-logo-v2.png" alt="Kadrówka" />
        <h1>Nie udało się wyświetlić tej strony</h1>
        <p>Twoje zapisane plany i notatki nie zostały automatycznie usunięte. Odśwież aplikację, a jeśli problem wróci, przejdź do ustawień i pobierz kopię swojej pracy.</p>
        <div className="button-row wrap">
          <button className="primary-action" type="button" onClick={() => window.location.reload()}>Odśwież aplikację</button>
          <a className="secondary-action" href="/settings">Przejdź do ustawień</a>
        </div>
      </main>
    )
  }
}
