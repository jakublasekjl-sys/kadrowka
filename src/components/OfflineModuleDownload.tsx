import { CheckCircle2, Download, RefreshCw, TriangleAlert, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  downloadOfflineAssets,
  ensureOfflineCacheVersion,
  formatBytes,
  offlineStatus,
  type OfflineStatus,
} from '../content/offlineMaterials'
import type { ContentAsset } from '../types/content'

function fileCount(count: number) {
  if (count === 1) return '1 plik'
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} pliki`
  return `${count} plików`
}

export function OfflineModuleDownload({ assets, moduleTitle, contentVersion }: { assets: ContentAsset[]; moduleTitle: string; contentVersion: string }) {
  const uniqueAssets = useMemo(() => [...new Map(assets.map((asset) => [asset.path, asset])).values()], [assets])
  const [status, setStatus] = useState<OfflineStatus | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [notice, setNotice] = useState<{ text: string; warning?: boolean } | null>(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 })
  const controller = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    await ensureOfflineCacheVersion(contentVersion)
    setStatus(await offlineStatus(uniqueAssets))
  }, [contentVersion, uniqueAssets])

  useEffect(() => { void refresh() }, [refresh])
  if (!uniqueAssets.length) return null

  const totalBytes = uniqueAssets.reduce((sum, asset) => sum + asset.size, 0)
  const allCached = status?.cachedCount === uniqueAssets.length
  const partiallyCached = Boolean(status?.cachedCount) && !allCached
  const remainingBytes = Math.max(totalBytes - (status?.cachedBytes ?? 0), 0)

  async function download() {
    const abortController = new AbortController()
    controller.current = abortController
    setConfirming(false)
    setDownloading(true)
    setNotice(null)
    setProgress({ completed: 0, total: uniqueAssets.length, failed: 0 })
    try {
      const failures = await downloadOfflineAssets(
        uniqueAssets,
        (completed, total, failed) => setProgress({ completed, total, failed }),
        abortController.signal,
      )
      setNotice(failures.length
        ? { text: `Nie udało się pobrać ${fileCount(failures.length)}. Możesz wznowić pobieranie.`, warning: true }
        : { text: `Materiały modułu „${moduleTitle}” są gotowe do pracy bez internetu.` })
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Nie udało się pobrać materiałów modułu.',
        warning: true,
      })
    } finally {
      controller.current = null
      await refresh()
      setDownloading(false)
    }
  }

  return (
    <aside className="module-offline-control">
      <div>
        <strong>{allCached ? 'Materiały dostępne bez internetu' : 'Przygotuj moduł do pracy offline'}</strong>
        <span>{allCached
          ? `${fileCount(uniqueAssets.length)} zapisano na tym urządzeniu.`
          : partiallyCached
            ? `${status?.cachedCount} z ${uniqueAssets.length} plików jest już dostępnych offline. Pozostało do ${formatBytes(remainingBytes)}.`
            : `${fileCount(uniqueAssets.length)}, do ${formatBytes(totalBytes)}. Pobieranie jest opcjonalne.`}</span>
      </div>
      {!allCached && !downloading && <button className="secondary-action" type="button" onClick={() => setConfirming(true)}><Download aria-hidden="true" /> {partiallyCached ? 'Pobierz pozostałe' : 'Pobierz moduł'}</button>}
      {allCached && <CheckCircle2 aria-hidden="true" />}
      {downloading && <div className="module-download-progress"><RefreshCw className="spin" aria-hidden="true" /><span>{progress.completed} z {progress.total}</span><button className="icon-button danger" type="button" onClick={() => controller.current?.abort()} aria-label="Zatrzymaj pobieranie"><XCircle aria-hidden="true" /></button></div>}
      {confirming && <div className="module-download-confirmation"><TriangleAlert aria-hidden="true" /><p>Pobieranie może zużyć do <strong>{formatBytes(partiallyCached ? remainingBytes : totalBytes)}</strong>. Najlepiej użyć Wi-Fi.</p><div className="button-row"><button className="primary-action" type="button" onClick={() => void download()}>Rozpocznij</button><button className="text-button" type="button" onClick={() => setConfirming(false)}>Anuluj</button></div></div>}
      {notice && <p className={`status-message ${notice.warning ? 'status-warning' : ''}`} role="status">{notice.warning ? <TriangleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{notice.text}</p>}
    </aside>
  )
}
