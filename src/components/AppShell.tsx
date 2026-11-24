import {
  CalendarDays,
  CircleHelp,
  DatabaseZap,
  Grid2X2,
  Hammer,
  Home,
  LayoutDashboard,
  Search,
  Settings,
  Smartphone,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PwaUpdateBanner } from './PwaUpdateBanner'
import { useContent } from '../content/ContentContext'
import { isAdminPanelAvailable } from '../config/runtimeConfig'

const navigation = [
  { to: '/', label: 'Start', icon: Home, end: true },
  { to: '/modules', label: 'Moduły', icon: Grid2X2 },
  { to: '/tools', label: 'Narzędzia', icon: Hammer },
  { to: '/search', label: 'Szukaj', icon: Search },
  { to: '/planning', label: 'Planowanie', icon: CalendarDays },
  { to: '/dashboard', label: 'Pulpit', icon: LayoutDashboard },
]

export function AppShell() {
  const location = useLocation()
  const { content } = useContent()
  const moduleChildActive = /^\/(page|module)\//.test(location.pathname)
  const navClass = (to: string, routeActive: boolean) => {
    const moduleChild = to === '/modules' && moduleChildActive
    return `nav-item${routeActive || moduleChild ? ' active' : ''}`
  }
  return (
    <div className="app-shell">
      <header className="top-bar">
        <NavLink to="/" className="brand" aria-label="Kadrówka - Start">
          <img src="/kadrowka-logo-v2.png" alt="" />
          <span>Kadrówka</span>
        </NavLink>
        <div className="top-actions">
          {content && isAdminPanelAvailable(content.runtimeConfig) && <a className="icon-button" href="/admin" title="Materiały aplikacji">
            <DatabaseZap aria-hidden="true" />
          </a>}
          <NavLink className="icon-button" to="/install" title="Zainstaluj Kadrówkę">
            <Smartphone aria-hidden="true" />
          </NavLink>
          <NavLink className="icon-button" to="/feedback" state={{ from: `${location.pathname}${location.search}` }} title="Uwagi i propozycje">
            <CircleHelp aria-hidden="true" />
          </NavLink>
          <NavLink className="icon-button" to="/settings" title="Ustawienia">
            <Settings aria-hidden="true" />
          </NavLink>
        </div>
      </header>

      <aside className="side-navigation" aria-label="Główna nawigacja">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(to, isActive)}>
            <Icon aria-hidden="true" />
            <span>{label}{to === '/modules' && moduleChildActive && <span className="sr-only">, aktywne</span>}</span>
          </NavLink>
        ))}
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-navigation" aria-label="Główna nawigacja">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(to, isActive)}>
            <Icon aria-hidden="true" />
            <span>{label}{to === '/modules' && moduleChildActive && <span className="sr-only">, aktywne</span>}</span>
          </NavLink>
        ))}
      </nav>
      <PwaUpdateBanner />
    </div>
  )
}
