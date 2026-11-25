import {
  ArchiveRestore,
  CheckCircle2,
  CloudUpload,
  Download,
  FileCheck2,
  Files,
  FolderOpen,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/PageState'
import { useContent } from '../content/ContentContext'
import { formatBytes } from '../content/offlineMaterials'
import { isAdminPanelAvailable, isAzureAdminReady } from '../config/runtimeConfig'
import { AzureContentAdmin, type PublishProgress } from '../admin/azureContentAdmin'
import {
  analyzeMaterialFiles,
  exportPreparedRelease,
  prepareRelease,
  type ImportedMaterialFile,
  type PreparedRelease,
} from '../admin/materialImport'
import type { MaterialCatalogPointer } from '../types/content'

const statusLabels = {
  new: 'Nowy',
  replace: 'Podmiana',
  unchanged: 'Bez zmian',
  duplicate: 'Ta sama zawartość',
  invalid: 'Wymaga poprawy',
} as const

function suggestedReleaseId() {
  const now = new Date()
  const value = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('')
  return `release-${value}`
}

function progressLabel(progress: PublishProgress) {
  if (progress.phase === 'files') return `Przesyłanie plików: ${progress.completed}/${progress.total}${progress.current ? ` · ${progress.current}` : ''}`
  if (progress.phase === 'catalog') return 'Zapisywanie katalogu wydania…'
  return 'Aktywowanie nowego wydania…'
}

export function AdminPage() {
  const { content, loading, error } = useContent()
  const folderInput = useRef<HTMLInputElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const [analysis, setAnalysis] = useState<ImportedMaterialFile[]>([])
  const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 0 })
  const [releaseId, setReleaseId] = useState(suggestedReleaseId)
  const [defaultModuleIds, setDefaultModuleIds] = useState<string[]>([])
  const [draft, setDraft] = useState<PreparedRelease | null>(null)
  const [busy, setBusy] = useState<'analysis' | 'login' | 'publish' | 'rollback' | null>(null)
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null)
  const [accountName, setAccountName] = useState('')
  const [currentPointer, setCurrentPointer] = useState<MaterialCatalogPointer | null>(null)
  const [notice, setNotice] = useState<{ text: string; warning?: boolean } | null>(null)

  const azureReady = Boolean(content && isAzureAdminReady(content.runtimeConfig))
  const azure = useMemo(() => content && azureReady ? new AzureContentAdmin(content.runtimeConfig.azure) : null, [content, azureReady])

  useEffect(() => {
    if (!azure) return
    let active = true
    void azure.initialize().then(async () => {
      if (!active) return
      setAccountName(azure.account()?.username ?? '')
      if (azure.account()) {
        try {
          const result = await azure.currentPointer()
          if (active) setCurrentPointer(result.pointer)
        } catch {
          // Brak uprawnień jest pokazany dopiero przy świadomej operacji administratora.
        }
      }
    }).catch((initializationError) => {
      if (active) setNotice({ text: initializationError instanceof Error ? initializationError.message : 'Nie udało się rozpocząć logowania administratora.', warning: true })
    })
    return () => { active = false }
  }, [azure])

  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />
  if (!isAdminPanelAvailable(content.runtimeConfig)) return (
    <div className="page-stack admin-page">
      <PageHeader title="Materiały aplikacji" lead="Panel administracyjny nie jest jeszcze aktywny." />
      <section className="admin-environment preparation">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Publikowanie materiałów jest wyłączone</strong>
          <span>Dostęp pojawi się po skonfigurowaniu Azure i nadaniu uprawnień administratora.</span>
        </div>
      </section>
    </div>
  )

  const summary = Object.fromEntries(['new', 'replace', 'unchanged', 'duplicate', 'invalid'].map((status) => [status, analysis.filter((item) => item.status === status).length])) as Record<keyof typeof statusLabels, number>
  const totalBytes = analysis.reduce((sum, item) => sum + item.file.size, 0)
  const unassigned = analysis.filter((item) => item.assetKind === 'document'
    && !item.moduleIds.length
    && !defaultModuleIds.length
    && item.status !== 'invalid')
  const canPrepare = analysis.length > 0 && !summary.invalid && !unassigned.length && !busy

  async function runAnalysis(selected?: FileList | null) {
    const files = [...(selected ?? [])]
    if (!files.length) return
    setBusy('analysis')
    setNotice(null)
    setDraft(null)
    setAnalysisProgress({ completed: 0, total: files.length })
    try {
      const result = await analyzeMaterialFiles(files, content!.materialCatalog, content!.modules, (completed, total) => setAnalysisProgress({ completed, total }))
      setAnalysis(result)
      const invalid = result.filter((item) => item.status === 'invalid').length
      setNotice(invalid
        ? { text: `Analiza zakończona. ${invalid} plików wymaga poprawy przed publikacją.`, warning: true }
        : { text: `Analiza zakończona. Sprawdzono ${result.length} plików.` })
    } catch (analysisError) {
      setAnalysis([])
      setNotice({ text: analysisError instanceof Error ? analysisError.message : 'Nie udało się przeanalizować paczki.', warning: true })
    } finally {
      setBusy(null)
      if (folderInput.current) folderInput.current.value = ''
      if (filesInput.current) filesInput.current.value = ''
    }
  }

  function toggleDefaultModule(moduleId: string) {
    setDraft(null)
    setDefaultModuleIds((current) => current.includes(moduleId)
      ? current.filter((item) => item !== moduleId)
      : [...current, moduleId])
  }

  function buildDraft() {
    try {
      const next = prepareRelease(content!.materialCatalog, analysis, releaseId, defaultModuleIds, content!.materialCatalogSource)
      setDraft(next)
      setNotice(next.initialMigrationComplete
        ? { text: `Wydanie jest gotowe do publikacji: ${next.uploads.length} plików do przesłania.` }
        : { text: 'To pierwsza migracja do Azure. Wybierz cały folder files, aby nowe wydanie objęło wszystkie obecne materiały.', warning: true })
    } catch (draftError) {
      setNotice({ text: draftError instanceof Error ? draftError.message : 'Nie udało się przygotować wydania.', warning: true })
    }
  }

  async function signIn() {
    if (!azure) return
    setBusy('login')
    setNotice(null)
    try {
      const account = await azure.signIn()
      setAccountName(account.username)
      const current = await azure.currentPointer()
      setCurrentPointer(current.pointer)
      setNotice({ text: `Zalogowano jako ${account.username}.` })
    } catch (loginError) {
      setNotice({ text: loginError instanceof Error ? loginError.message : 'Logowanie nie powiodło się.', warning: true })
    } finally {
      setBusy(null)
    }
  }

  async function signOut() {
    if (!azure) return
    try {
      await azure.signOut()
    } catch {
      // SWA session is closed even if the MSAL popup was dismissed.
    } finally {
      setAccountName('')
      setCurrentPointer(null)
      window.location.assign('/.auth/logout')
    }
  }

  async function publish() {
    if (!azure || !draft || !window.confirm(`Opublikować wydanie ${draft.catalog.releaseId}? Aplikacja zacznie używać go po zmianie wskaźnika current.json.`)) return
    setBusy('publish')
    setNotice(null)
    setPublishProgress({ phase: 'files', completed: 0, total: draft.uploads.length })
    try {
      const pointer = await azure.publish(draft, setPublishProgress)
      setCurrentPointer(pointer)
      setNotice({ text: `Wydanie ${pointer.releaseId} zostało opublikowane. Użytkownicy zobaczą je po ponownym uruchomieniu aplikacji.` })
    } catch (publishError) {
      setNotice({ text: publishError instanceof Error ? publishError.message : 'Publikacja nie powiodła się.', warning: true })
    } finally {
      setBusy(null)
      setPublishProgress(null)
    }
  }

  async function rollback() {
    if (!azure || !currentPointer?.previousReleaseId || !window.confirm(`Przywrócić wydanie ${currentPointer.previousReleaseId}?`)) return
    setBusy('rollback')
    setNotice(null)
    try {
      const pointer = await azure.rollback()
      setCurrentPointer(pointer)
      setNotice({ text: `Przywrócono wydanie ${pointer.releaseId}.` })
    } catch (rollbackError) {
      setNotice({ text: rollbackError instanceof Error ? rollbackError.message : 'Nie udało się przywrócić wydania.', warning: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page-stack admin-page">
      <PageHeader title="Materiały aplikacji" lead="Przygotuj i opublikuj wersjonowaną paczkę bez ręcznego opisywania każdego pliku." />

      <section className={`admin-environment ${azureReady ? 'ready' : 'preparation'}`}>
        {azureReady ? <ShieldCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
        <div>
          <strong>{azureReady ? 'Środowisko Azure jest skonfigurowane' : 'Tryb przygotowania lokalnego'}</strong>
          <span>{azureReady
            ? `Konto Storage: ${content.runtimeConfig.azure.storageAccountName}; kontener: ${content.runtimeConfig.azure.containerName}.`
            : 'Możesz analizować foldery i eksportować projekt wydania. Publikacja odblokuje się po uzupełnieniu runtime-config.json.'}</span>
        </div>
        {azureReady && (accountName
          ? <button className="secondary-action" type="button" onClick={() => void signOut()}><LogOut aria-hidden="true" /> Wyloguj</button>
          : <button className="primary-action" type="button" disabled={busy === 'login'} onClick={() => void signIn()}>{busy === 'login' ? <RefreshCw className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />} Zaloguj administratora</button>)}
      </section>

      {accountName && <p className="admin-account"><CheckCircle2 aria-hidden="true" /> Zalogowano: <strong>{accountName}</strong></p>}

      <section className="admin-section">
        <div className="admin-section-heading"><span><span className="admin-step">1</span><span><h2>Wybierz paczkę</h2><p>Najwygodniej wskaż cały folder <code>files</code>. Pliki są tylko odczytywane lokalnie do czasu publikacji.</p></span></span></div>
        <div className="button-row wrap">
          <button className="primary-action" type="button" disabled={Boolean(busy)} onClick={() => folderInput.current?.click()}><FolderOpen aria-hidden="true" /> Wybierz folder</button>
          <button className="secondary-action" type="button" disabled={Boolean(busy)} onClick={() => filesInput.current?.click()}><Files aria-hidden="true" /> Wybierz pliki</button>
          <input ref={folderInput} className="hidden-file-input" type="file" multiple tabIndex={-1} aria-hidden="true" onChange={(event) => void runAnalysis(event.target.files)} {...({ webkitdirectory: '', directory: '' })} />
          <input ref={filesInput} className="hidden-file-input" type="file" multiple tabIndex={-1} aria-hidden="true" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.xlsx,.pptx,.ppsx" onChange={(event) => void runAnalysis(event.target.files)} />
        </div>
        {busy === 'analysis' && <div className="admin-progress" role="status"><RefreshCw className="spin" aria-hidden="true" /><span>Sprawdzanie plików {analysisProgress.completed}/{analysisProgress.total}</span><progress value={analysisProgress.completed} max={Math.max(analysisProgress.total, 1)} /></div>}
      </section>

      {analysis.length > 0 && <>
        <section className="admin-summary" aria-label="Wynik analizy">
          <article><strong>{analysis.length}</strong><span>plików</span></article>
          <article><strong>{formatBytes(totalBytes)}</strong><span>rozmiar paczki</span></article>
          {(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map((status) => <article className={`status-${status}`} key={status}><strong>{summary[status]}</strong><span>{statusLabels[status]}</span></article>)}
        </section>

        <section className="admin-section">
          <div className="admin-section-heading"><span><span className="admin-step">2</span><span><h2>Ustaw wydanie</h2><p>Przypisanie wybrane poniżej zostanie dodane zbiorczo. Dotychczasowe przypisania pozostaną zachowane.</p></span></span></div>
          <label className="admin-field"><span>Identyfikator wydania</span><input value={releaseId} onChange={(event) => { setReleaseId(event.target.value); setDraft(null) }} pattern="[A-Za-z0-9._-]+" /></label>
          <details className="admin-module-picker" open={unassigned.length > 0}>
            <summary>Przypisz całą paczkę do modułów <small>{defaultModuleIds.length ? `wybrano: ${defaultModuleIds.length}` : 'opcjonalne dla rozpoznanych folderów'}</small></summary>
            <div>{content.modules.filter((module) => module.id !== 'planowanie').map((module) => <label key={module.id}><input type="checkbox" checked={defaultModuleIds.includes(module.id)} onChange={() => toggleDefaultModule(module.id)} /><span>{module.title}</span></label>)}</div>
          </details>
          {unassigned.length > 0 && <p className="admin-warning"><TriangleAlert aria-hidden="true" /> {unassigned.length} dokumentów nie ma rozpoznanego miejsca. Wybierz przynajmniej jeden moduł dla całej paczki.</p>}
        </section>

        <details className="admin-file-review" open={summary.invalid > 0}>
          <summary>Pliki wymagające uwagi i zmiany <small>{summary.invalid + summary.new + summary.replace}</small></summary>
          <div className="admin-file-list">{analysis.filter((item) => ['invalid', 'new', 'replace'].includes(item.status)).map((item) => <article key={`${item.legacyPath}-${item.file.lastModified}`}><div><strong>{item.title}</strong><span>{item.legacyPath || item.file.name}</span>{item.errors.map((message) => <small key={message}>{message}</small>)}</div><span className={`admin-file-status status-${item.status}`}>{statusLabels[item.status]}</span></article>)}</div>
        </details>

        <section className="admin-section">
          <div className="admin-section-heading"><span><span className="admin-step">3</span><span><h2>Sprawdź i opublikuj</h2><p>Pliki trafią do niezmiennego katalogu wydania. Aktywacja nastąpi dopiero w ostatnim kroku.</p></span></span></div>
          <div className="button-row wrap"><button className="primary-action" type="button" disabled={!canPrepare} onClick={buildDraft}><FileCheck2 aria-hidden="true" /> Przygotuj wydanie</button>{draft && <button className="secondary-action" type="button" onClick={() => exportPreparedRelease(draft)}><Download aria-hidden="true" /> Pobierz raport JSON</button>}</div>
          {draft && <div className="admin-release-review"><dl><div><dt>Wydanie</dt><dd>{draft.catalog.releaseId}</dd></div><div><dt>Pozycji w katalogu</dt><dd>{draft.catalog.materialCount}</dd></div><div><dt>Plików do przesłania</dt><dd>{draft.uploads.length}</dd></div><div><dt>Rozmiar przesyłania</dt><dd>{formatBytes(draft.uploads.reduce((sum, item) => sum + item.file.size, 0))}</dd></div></dl>{!draft.initialMigrationComplete && <p className="admin-warning"><TriangleAlert aria-hidden="true" /> Pierwsza publikacja nie obejmuje jeszcze wszystkich materiałów lokalnych i pozostaje zablokowana.</p>}</div>}
          {publishProgress && <div className="admin-progress" role="status"><CloudUpload aria-hidden="true" /><span>{progressLabel(publishProgress)}</span><progress value={publishProgress.completed} max={Math.max(publishProgress.total, 1)} /></div>}
          {draft && <button className="primary-action admin-publish" type="button" disabled={!azureReady || !accountName || !draft.initialMigrationComplete || Boolean(busy)} onClick={() => void publish()}><CloudUpload aria-hidden="true" /> Opublikuj i aktywuj wydanie</button>}
        </section>
      </>}

      {azureReady && accountName && <section className="admin-section admin-rollback"><div><h2>Aktywne wydanie</h2><p>{currentPointer ? `${currentPointer.releaseId}, opublikowane ${new Date(currentPointer.publishedAt).toLocaleString('pl-PL')}` : 'Nie opublikowano jeszcze katalogu w Azure.'}</p></div><button className="secondary-action" type="button" disabled={!currentPointer?.previousReleaseId || Boolean(busy)} onClick={() => void rollback()}><ArchiveRestore aria-hidden="true" /> Przywróć poprzednie</button></section>}

      {notice && <p className={`status-message admin-notice ${notice.warning ? 'status-warning' : ''}`} role="status">{notice.warning ? <TriangleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{notice.text}</p>}
    </div>
  )
}
