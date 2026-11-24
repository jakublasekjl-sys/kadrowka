import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderDown,
  Grid2X2,
  HardDrive,
  Heart,
  Smartphone,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { setTutorialState } from '../utils/tutorialState'

interface TutorialStep {
  title: string
  lead: string
  icon: ReactNode
  points: string[]
  action?: { label: string; to: string }
}

const steps: TutorialStep[] = [
  {
    title: 'Znajdź właściwe miejsce',
    lead: 'Dolne menu prowadzi do sześciu głównych części Kadrówki.',
    icon: <Grid2X2 aria-hidden="true" />,
    points: [
      'Start daje szybki dostęp do najważniejszych modułów pracy z kadrą.',
      'Moduły zawierają wiedzę, zastosowania, materiały i powiązane strony.',
      'Narzędzia i Szukaj pomagają dotrzeć bezpośrednio do konkretnego rozwiązania.',
    ],
    action: { label: 'Zobacz moduły', to: '/modules' },
  },
  {
    title: 'Czytaj i wracaj do ważnych treści',
    lead: 'Każdy moduł ma własną nawigację dopasowaną do jego treści.',
    icon: <BookOpen aria-hidden="true" />,
    points: [
      'Zacznij od zakładki Czytaj, a potem przejdź do rozwinięć, takich jak Postawy lub Obszary.',
      'W Zastosuj zapiszesz notatkę albo wniosek, który trafi również do Planowania.',
      'Gwiazdka zapisuje stronę lub narzędzie w Ulubionych na Pulpicie.',
    ],
  },
  {
    title: 'Otwieraj materiały online lub przygotuj je na wyjazd',
    lead: 'Nie musisz niczego pobierać przed zwykłym korzystaniem z Kadrówki.',
    icon: <FolderDown aria-hidden="true" />,
    points: [
      'Przy połączeniu z internetem materiał otworzy się od razu i zostanie zapamiętany do kolejnego użycia.',
      'W zakładce Materiały możesz pobrać cały potrzebny moduł przed wyjazdem bez zasięgu.',
      'Jeżeli pliku nie ma na urządzeniu i nie ma internetu, Kadrówka pokaże jasny komunikat zamiast pustej strony.',
    ],
    action: { label: 'Przejdź do Narzędzi', to: '/tools' },
  },
  {
    title: 'Twórz plany i zbieraj wnioski',
    lead: 'Planowanie prowadzi krok po kroku przez diagnozę, cele, działania i harmonogram.',
    icon: <CalendarDays aria-hidden="true" />,
    points: [
      'Szkic planu zapisuje się automatycznie na tym urządzeniu.',
      'Możesz prowadzić kilka planów i przełączać się między nimi.',
      'Notatki oznaczone jako wnioski do planu są dostępne w module Planowanie.',
    ],
    action: { label: 'Otwórz Planowanie', to: '/planning' },
  },
  {
    title: 'Pulpit zbiera Twoją pracę',
    lead: 'Plany, notatki, wnioski, ulubione i protokoły są w jednym miejscu.',
    icon: <Heart aria-hidden="true" />,
    points: [
      'Dane pozostają wyłącznie w tej przeglądarce na tym telefonie lub komputerze.',
      'Nie synchronizują się automatycznie między urządzeniami.',
      'Notatki i protokoły możesz pobrać jako czytelne dokumenty DOCX lub PDF.',
    ],
    action: { label: 'Przejdź do Pulpitu', to: '/dashboard' },
  },
  {
    title: 'Kopia Twojej pracy chroni dane',
    lead: 'Przed zmianą telefonu pobierz jeden plik zawierający całą własną pracę.',
    icon: <HardDrive aria-hidden="true" />,
    points: [
      'Pobierz kopię zapisującą plany, notatki, wnioski, ulubione, protokoły i postęp SSI.',
      'Na nowym urządzeniu wybierz Wczytaj kopię, aby przywrócić swoją pracę.',
      'DOCX i PDF służą do czytania lub wysłania. Kopia Twojej pracy służy do przenoszenia danych.',
    ],
    action: { label: 'Otwórz Ustawienia', to: '/settings' },
  },
  {
    title: 'Zainstaluj Kadrówkę na telefonie',
    lead: 'Aplikację możesz dodać do ekranu głównego bez sklepu Google Play i App Store.',
    icon: <Smartphone aria-hidden="true" />,
    points: [
      'Na Androidzie użyj Chrome i polecenia Zainstaluj aplikację lub Dodaj do ekranu głównego.',
      'Na iPhonie otwórz stronę w Safari i wybierz Udostępnij, a potem Do ekranu początkowego.',
      'Instrukcję zawsze znajdziesz pod ikoną telefonu w górnym pasku.',
    ],
    action: { label: 'Zobacz instrukcję instalacji', to: '/install' },
  },
]

export function TutorialPage() {
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const step = steps[index]
  const last = index === steps.length - 1

  function finish() {
    setTutorialState('completed')
    navigate('/')
  }

  function dismiss() {
    setTutorialState('dismissed')
    navigate('/')
  }

  return (
    <div className="page-stack tutorial-page">
      <PageHeader title="Samouczek Kadrówki" lead="Najważniejsze funkcje w kilku krótkich krokach." />
      <div className="tutorial-progress" aria-label={`Krok ${index + 1} z ${steps.length}`}>
        <div><span>Krok {index + 1} z {steps.length}</span><strong>{Math.round(((index + 1) / steps.length) * 100)}%</strong></div>
        <progress value={index + 1} max={steps.length} />
      </div>
      <section className="tutorial-panel" aria-live="polite">
        <div className="tutorial-icon">{step.icon}</div>
        <div className="tutorial-copy">
          <h2>{step.title}</h2>
          <p>{step.lead}</p>
          <ul>{step.points.map((point) => <li key={point}><Check aria-hidden="true" /><span>{point}</span></li>)}</ul>
          {step.action && <Link className="text-link-with-icon" to={step.action.to}>{step.action.label}<ChevronRight aria-hidden="true" /></Link>}
        </div>
      </section>
      <div className="tutorial-navigation">
        <button className="secondary-action" type="button" disabled={index === 0} onClick={() => setIndex((current) => current - 1)}><ChevronLeft aria-hidden="true" /> Wstecz</button>
        {last
          ? <button className="primary-action" type="button" onClick={finish}>Zakończ samouczek <Check aria-hidden="true" /></button>
          : <button className="primary-action" type="button" onClick={() => setIndex((current) => current + 1)}>Dalej <ChevronRight aria-hidden="true" /></button>}
      </div>
      <button className="text-button tutorial-dismiss" type="button" onClick={dismiss}>Nie pokazuj zaproszenia ponownie</button>
    </div>
  )
}
