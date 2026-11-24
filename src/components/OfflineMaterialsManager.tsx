import { CheckCircle2, Download, HardDrive, RefreshCw, Trash2, TriangleAlert, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  checkAssetAvailability,
  clearOfflineMaterials,
  downloadOfflineAssets,
  ensureOfflineCacheVersion,
  formatBytes,
  offlineStatus,
  type OfflineStatus,
} from '../content/offlineMaterials'
import type { ContentAsset, ContentBundle } from '../types/content'

interface PendingDownload {
  title: string
  assets: ContentAsset[]
}

interface StorageEstimate {
  usage: number
  quota: number
}

function fileCountLabel(count: number) {
  if (count === 1) return '1 plik'
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} pliki`
  return `${count} plików`
}

export function OfflineMaterialsManager({ content }: { content: ContentBundle }) {
  const [status, setStatus] = useState<OfflineStatus | null>(null)
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'warning' } | null>(null)
  const [operation, setOperation] = useState<'download' | 'verify' | 'clear' | null>(null)
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null)
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 })
  const downloadController = useRef<AbortController | null>(null)
  const busy = operation !== null

  const packs = useMemo(() => content.modules.map((module) => ({
    id: module.id,
    title: module.title,
    assets: content.assets.filter((asset) => asset.moduleId === module.id || asset.moduleIds?.includes(module.id)),
  })).filter((pack) => pack.assets.length), [content])

  const refreshStatus = useCallback(async () => {
    await ensureOfflineCacheVersion(content.materialCatalog.releaseId)
    setStatus(await offlineStatus(content.assets))
  }, [content.assets, content.materialCatalog.releaseId])

  const refreshStorageEstimate = useCallback(async () => {
    if (!navigator.storage?.estimate) return setStorageEstimate(null)
    const estimate = await navigator.storage.estimate()
    if (typeof estimate.quota !== 'number') return setStorageEstimate(null)
    setStorageEstimate({ usage: estimate.usage ?? 0, quota: estimate.quota })
  }, [])

  useEffect(() => {
    void refreshStatus()
    void refreshStorageEstimate()
  }, [refreshStatus, refreshStorageEstimate])

  function requestDownload(request: PendingDownload) {
    if (!busy) setPendingDownload(request)
  }

  async function download(request: PendingDownload) {
    const controller = new AbortController()
    downloadController.current = controller
    setPendingDownload(null)
    setOperation('download')
    setNotice(null)
    setProgress({ completed: 0, total: request.assets.length, failed: 0 })
    try {
      const failures = await downloadOfflineAssets(
        request.assets,
        (completed, total, failed) => setProgress({ completed, total, failed }),
        controller.signal,
      )
      setNotice(failures.length
        ? { text: `Pobrano część materiałów. Nie udało się pobrać ${fileCountLabel(failures.length)}.`, tone: 'warning' }
        : { text: `Pobrano „${request.title}” do pracy offline (${fileCountLabel(request.assets.length)}).`, tone: 'success' })
    } catch (error) {
      setNotice(error instanceof Error && error.name === 'AbortError'
        ? { text: 'Pobieranie zatrzymano. Wybierz „Wznów pobieranie”, aby kontynuować bez ponownego pobierania zapisanych plików.', tone: 'warning' }
        : { text: error instanceof Error ? error.message : 'Nie udało się pobrać materiałów.', tone: 'warning' })
    } finally {
      downloadController.current = null
      try {
        await Promise.all([refreshStatus(), refreshStorageEstimate()])
      } finally {
        setOperation(null)
      }
    }
  }

  function cancelDownload() {
    downloadController.current?.abort()
  }

  async function clear() {
    setPendingDownload(null)
    setOperation('clear')
    setProgress({ completed: 0, total: 0, failed: 0 })
    try {
      await clearOfflineMaterials()
      await Promise.all([refreshStatus(), refreshStorageEstimate()])
      setNotice({ text: 'Usunięto pobrane materiały. Treści stron i Twoje dane pozostały bez zmian.', tone: 'success' })
    } finally {
      setOperation(null)
    }
  }

  async function verify() {
    setPendingDownload(null)
    setOperation('verify')
    setNotice(null)
    setProgress({ completed: 0, total: content.assets.length, failed: 0 })
    try {
      const failures = await checkAssetAvailability(content.assets, (completed, total, failed) => setProgress({ completed, total, failed }))
      setNotice(failures.length
        ? { text: `Kontrola zakończona: niedostępne pliki: ${failures.length}.`, tone: 'warning' }
        : { text: `Kontrola zakończona: wszystkie ${content.assets.length} pliki są dostępne.`, tone: 'success' })
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Nie udało się sprawdzić materiałów.', tone: 'warning' })
    } finally {
      setOperation(null)
    }
  }

  const availableBytes = storageEstimate ? Math.max(0, storageEstimate.quota - storageEstimate.usage) : null
  const pendingBytes = pendingDownload?.assets.reduce((sum, asset) => sum + asset.size, 0) ?? 0
  const insufficientStorage = availableBytes !== null && pendingBytes > availableBytes

  return <section className="settings-section offline-manager">
    <div className="settings-heading"><div><h2>Materiały bez internetu</h2><p>Wszystkie materiały otwierają się od razu online. Przed wyjazdem możesz opcjonalnie pobrać tylko potrzebne moduły.</p></div><HardDrive aria-hidden="true" /></div>
    {status && <div className="storage-summary"><strong>{formatBytes(status.cachedBytes)}</strong><span>{status.cachedCount} z {status.totalCount} plików</span><progress value={status.cachedBytes} max={Math.max(status.totalBytes, 1)} /></div>}
    {storageEstimate && <p className="storage-capacity">Szacowane wolne miejsce dla tej aplikacji: <strong>{formatBytes(Math.max(0, storageEstimate.quota - storageEstimate.usage))}</strong></p>}
    {operation && progress.total > 0 && <div className="download-progress" role="status"><RefreshCw className="spin" aria-hidden="true" /><span>{progress.completed} / {progress.total}{progress.failed ? `, błędy: ${progress.failed}` : ''}</span></div>}
    {operation === 'download' && <button className="secondary-action danger" type="button" onClick={cancelDownload}><XCircle aria-hidden="true" /> Zatrzymaj pobieranie</button>}
    {pendingDownload && <div className={`offline-download-confirmation ${insufficientStorage ? 'insufficient' : ''}`} role="status">
      <TriangleAlert aria-hidden="true" />
      <div><strong>{pendingDownload.title}</strong><p>Do pobrania: maksymalnie {formatBytes(pendingBytes)} ({fileCountLabel(pendingDownload.assets.length)}). Korzystaj z Wi-Fi i nie zamykaj aplikacji podczas pobierania.</p>{availableBytes !== null && <p>Dostępne miejsce: około {formatBytes(availableBytes)}.</p>}{insufficientStorage && <p><strong>Brakuje miejsca na wybrany pakiet. Zwolnij pamięć lub pobierz mniejszy moduł.</strong></p>}<div className="button-row wrap"><button className="primary-action" type="button" disabled={insufficientStorage} onClick={() => void download(pendingDownload)}><Download aria-hidden="true" /> Rozpocznij pobieranie</button><button className="text-button" type="button" onClick={() => setPendingDownload(null)}>Anuluj</button></div></div>
    </div>}
    <details className="settings-details" open><summary>Pobierz wybrany moduł</summary><div className="offline-pack-list">{packs.map((pack) => <div className="offline-pack" key={pack.id}><span><strong>{pack.title}</strong><small>{fileCountLabel(pack.assets.length)}, {formatBytes(pack.assets.reduce((sum, asset) => sum + asset.size, 0))}</small></span><button className="secondary-action compact-action" type="button" disabled={busy} onClick={() => requestDownload({ title: pack.title, assets: pack.assets })}><Download aria-hidden="true" /> Pobierz</button></div>)}</div></details>
    <details className="settings-details"><summary>Opcje techniczne</summary><div className="button-row wrap technical-actions"><button className="secondary-action" type="button" disabled={busy} onClick={() => void verify()}><CheckCircle2 aria-hidden="true" /> Sprawdź dostępność plików</button><button className="secondary-action danger" type="button" disabled={busy || !status?.cachedCount} onClick={() => void clear()}><Trash2 aria-hidden="true" /> Usuń pobrane materiały</button></div></details>
    {notice && <p className={`status-message ${notice.tone === 'warning' ? 'status-warning' : ''}`}>{notice.tone === 'warning' ? <TriangleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{notice.text}</p>}
  </section>
}
