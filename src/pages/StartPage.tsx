import { ArrowRight, BookOpenCheck, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModuleIcon } from '../components/ModuleIcon'
import { useContent } from '../content/ContentContext'
import { ErrorState, LoadingState } from '../components/PageState'
import { moduleRoute } from '../content/moduleRoutes'
import { setTutorialState, tutorialState } from '../utils/tutorialState'

const startModules = [
  'model-przywodztwa',
  'proces-pracy-z-kadra',
  'praca-z-kadra-w-zespole',
  'ewaluacja',
  'funkcje-w-zhp',
  'system-ksztalcenia-w-zhp',
  'system-stopni-instruktorskich-w-zhp',
  'artykuly-z-czuwaj',
]

export function StartPage() {
  const { content, loading, error } = useContent()
  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />
  const modules = startModules
    .map((id) => content.modules.find((module) => module.id === id))
    .filter(Boolean)

  return (
    <div className="page-stack">
      <section className="start-hero" aria-labelledby="start-title">
        <img src="/kadrowka-logo-v2.png" alt="" />
        <div>
          <h1 id="start-title">{content.home.title ?? 'Kadrówka'}</h1>
          <p className="start-subtitle">{String(content.home.subtitle ?? 'Platforma wiedzy i narzędzi dla kadry ZHP')}</p>
          <p>{String(content.home.description ?? 'Materiały, poradniki, narzędzia i strony wokół Systemu Pracy z Kadrą w ZHP.')}</p>
        </div>
      </section>
      <Link className="search-launcher" to="/search">
        <Search aria-hidden="true" />
        <span>Szukaj w stronach, materiałach i narzędziach...</span>
      </Link>
      <OnboardingPrompt />
      <section aria-labelledby="start-modules">
        <h2 id="start-modules" className="section-title">Praca z kadrą</h2>
        <div className="module-grid">
          {modules.map((module) => module && (() => { const route = moduleRoute(module); return route.external ? (
            <a className="module-tile" href={route.target} target="_blank" rel="noopener noreferrer" key={module.id}>
              <div className="module-tile-main"><ModuleIcon module={module} /><div><h3>{module.title}</h3>{module.description && <p>{module.description}</p>}</div></div><ArrowRight className="module-tile-arrow" aria-hidden="true" />
            </a>
          ) : (
            <Link className="module-tile" to={route.target} key={module.id}>
              <div className="module-tile-main"><ModuleIcon module={module} /><div><h3>{module.title}</h3>{module.description && <p>{module.description}</p>}</div></div>
              <ArrowRight className="module-tile-arrow" aria-hidden="true" />
            </Link>
          ) })())}
        </div>
      </section>
      <HomeIntroduction />
    </div>
  )
}

function OnboardingPrompt() {
  const [visible, setVisible] = useState(() => tutorialState() === 'new')
  if (!visible) return null
  function dismiss() {
    setTutorialState('dismissed')
    setVisible(false)
  }
  return (
    <aside className="onboarding-prompt" aria-labelledby="onboarding-title">
      <BookOpenCheck aria-hidden="true" />
      <div><h2 id="onboarding-title">Pierwszy raz w Kadrówce?</h2><p>Zobacz, gdzie są moduły, materiały, Planowanie, Pulpit i kopia Twojej pracy.</p></div>
      <Link className="primary-action" to="/tutorial">Rozpocznij samouczek</Link>
      <button className="icon-button" type="button" onClick={dismiss} aria-label="Nie pokazuj ponownie" title="Nie pokazuj ponownie"><X aria-hidden="true" /></button>
    </aside>
  )
}

function HomeIntroduction() {
  return (
    <section className="home-introduction" aria-labelledby="home-introduction-title">
      <img className="home-introduction-image" src="/pracazkadra.webp" alt="Praca z kadrą w ZHP: relacje, rozwój, kultura organizacyjna i wspólnota" />
      <div className="home-reading-list">
        <article className="home-reading-block">
          <h2 id="home-introduction-title">Kadra jako kapitał ZHP</h2>
          <p>Kadra jest najcenniejszym kapitałem Związku Harcerstwa Polskiego. Realizuje lub wspiera realizację celów i misji ZHP, kreuje kulturę organizacyjną. Sprawne zarządzanie potencjałem kadrowym oraz doskonalenie się kadry w działaniu jest warunkiem rozwoju organizacji.</p>
          <p>Kadrą ZHP są członkowie ZHP powyżej 16 roku życia, pełniący funkcję lub mający powierzone zadania, których celem jest realizacja Misji ZHP bądź wspieranie tych działań. Szczególną grupą kadry są instruktorzy, czyli osoby przygotowane do prowadzenia pracy wychowawczej.</p>
        </article>
        <article className="home-reading-block">
          <h2>Czym jest praca z kadrą?</h2>
          <p>Praca z kadrą w ZHP to ogół działań mających na celu wspieranie w pełnieniu powierzonej funkcji i realizacji zadań, które są odpowiedzią na potrzeby harcerskiego środowiska i umożliwiają rozwój osobisty kadry ZHP. Praca z kadrą jest możliwa dzięki budowaniu braterskich relacji. Zachodzi podczas pracy indywidualnej i pracy w zespole.</p>
          <ul>
            <li><strong>Celowym</strong> - realizuje zaplanowane cele pracy z kadrą ZHP.</li>
            <li><strong>Powszechnym</strong> - obejmuje całą kadrę ZHP i jest stosowany we wszystkich zespołach.</li>
            <li><strong>Ciągłym</strong> - jest planowany, realizowany i podsumowywany nieprzerwanie w każdym działaniu.</li>
          </ul>
        </article>
        <article className="home-reading-block">
          <h2>Po co pracujemy z kadrą?</h2>
          <ul>
            <li>Podnoszenie jakości pracy wychowawczej prowadzonej w ZHP.</li>
            <li>Rozwijanie potencjału kadry umożliwiającego realizację strategicznych i bieżących celów organizacji.</li>
            <li>Zwiększanie satysfakcji kadry wynikającej z możliwości doskonalenia się i samorozwoju w działaniu.</li>
          </ul>
        </article>
        <article className="home-reading-block">
          <h2>Kultura organizacyjna i platforma wiedzy</h2>
          <p>Kultura organizacyjna to sposób organizowania się w działaniu, charakterystyczny dla danego zespołu czy organizacji, obejmujący normy społeczne, system wartości, właściwy klimat organizacyjny oraz wzorce zachowań, które są ważne dla członków organizacji i budują wspólnotę.</p>
          <p>Platforma Kadry ZHP to repozytorium wiedzy i narzędzi stworzone z myślą o wsparciu rozwoju oraz codziennej pracy kadry w Związku Harcerstwa Polskiego. Na platformie znajdują się materiały graficzne, poradniki, scenariusze, przykłady dobrych praktyk i narzędzia wspierające wdrażanie standardów pracy z kadrą.</p>
          <p>Platforma jest stale rozwijana, by jeszcze lepiej odpowiadała na potrzeby kadry w drodze realizacji Misji ZHP. Jeśli posiadasz materiały oraz narzędzia, które wspierają pracę z kadrą i chcesz się nimi podzielić w ZHP, napisz do nas!</p>
        </article>
      </div>
    </section>
  )
}
