import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppShell } from './components/AppShell'
import { MaterialAccessProvider } from './components/MaterialAccessProvider'
import { LoadingState } from './components/PageState'
import { ContentProvider } from './content/ContentContext'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })))
const InstallPage = lazy(() => import('./pages/InstallPage').then((module) => ({ default: module.InstallPage })))
const ModulePage = lazy(() => import('./pages/ModulePage').then((module) => ({ default: module.ModulePage })))
const ModulesPage = lazy(() => import('./pages/ModulesPage').then((module) => ({ default: module.ModulesPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const PageReader = lazy(() => import('./pages/PageReader').then((module) => ({ default: module.PageReader })))
const PlanningPage = lazy(() => import('./pages/PlanningPage').then((module) => ({ default: module.PlanningPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const StartPage = lazy(() => import('./pages/StartPage').then((module) => ({ default: module.StartPage })))
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })))
const TutorialPage = lazy(() => import('./pages/TutorialPage').then((module) => ({ default: module.TutorialPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))

export default function App() {
  return (
    <ContentProvider>
      <MaterialAccessProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route element={<AppShell />}>
              <Route index element={<StartPage />} />
              <Route path="modules" element={<ModulesPage />} />
              <Route path="module/:moduleId" element={<ModulePage />} />
              <Route path="page/:pageId" element={<PageReader />} />
              <Route path="tools" element={<ToolsPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="planning" element={<PlanningPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="install" element={<InstallPage />} />
              <Route path="tutorial" element={<TutorialPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MaterialAccessProvider>
    </ContentProvider>
  )
}
