import { Mail } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useContent } from '../content/ContentContext'

interface FeedbackLocationState {
  from?: string
}

export function FeedbackPage() {
  const location = useLocation()
  const { content } = useContent()
  const sourcePath = (location.state as FeedbackLocationState | null)?.from ?? '/'
  const sourceUrl = new URL(sourcePath, window.location.origin).href
  const buildDate = new Date(__BUILD_DATE__).toLocaleString('pl-PL')
  const subject = 'Kadrówka - uwaga lub propozycja'
  const body = [
    'Rodzaj uwagi: [Drobna zmiana / Zmiana systemowa / Nowa funkcjonalność]',
    'Moduł:',
    'Dokładne miejsce:',
    '',
    'Co zauważyłeś/aś?',
    '',
    'Co proponujesz zmienić?',
    '',
    '--- Dane pomocnicze ---',
    `Strona: ${sourceUrl}`,
    `Wersja aplikacji: ${__APP_VERSION__}`,
    `Build: ${buildDate}`,
    `Wersja treści: ${content?.manifest.version ?? 'nieznana'}`,
  ].join('\n')
  const mailUrl = `mailto:jakub.lasek@zhp.pl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  return (
    <div className="page-stack">
      <PageHeader title="Uwagi i propozycje" lead="Pomóż rozwijać Kadrówkę." />
      <section className="feedback-panel">
        <Mail aria-hidden="true" />
        <div>
          <h2>Napisz do nas</h2>
          <p>Pomysły na nowe funkcjonalności i moduły oraz zgłoszenia błędów prosimy kierować na adres <a href="mailto:jakub.lasek@zhp.pl">jakub.lasek@zhp.pl</a>.</p>
          <p>Wiadomość zostanie uzupełniona o wersję aplikacji i treści. Przed wysłaniem możesz swobodnie zmienić lub usunąć każdą informację.</p>
          <a className="primary-action" href={mailUrl}>Napisz wiadomość</a>
        </div>
      </section>
    </div>
  )
}
