import { RefreshCw, TriangleAlert, WifiOff, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useContent } from '../content/ContentContext'
import { ensureOfflineCacheVersion, MaterialAccessError, prepareAssetForOpen } from '../content/offlineMaterials'

interface MaterialRequest {
  key: string
  path: string
  target: string
  title: string
}

interface MaterialNotice {
  request: MaterialRequest
  message: string
  offline: boolean
}

interface MaterialAccessValue {
  openingKey: string | null
  openMaterial: (request: MaterialRequest) => Promise<void>
}

const MaterialAccessContext = createContext<MaterialAccessValue | null>(null)

export function MaterialAccessProvider({ children }: { children: ReactNode }) {
  const { content } = useContent()
  const [openingKey, setOpeningKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<MaterialNotice | null>(null)

  const openMaterial = useCallback(async (request: MaterialRequest) => {
    if (openingKey) return
    const openedWindow = window.open('about:blank', '_blank')
    if (openedWindow) openedWindow.opener = null
    setOpeningKey(request.key)
    setNotice(null)
    try {
      if (content) await ensureOfflineCacheVersion(content.materialCatalog.releaseId)
      await prepareAssetForOpen(request.path)
      if (openedWindow && !openedWindow.closed) openedWindow.location.replace(request.target)
      else window.location.assign(request.target)
    } catch (error) {
      openedWindow?.close()
      setNotice({
        request,
        message: error instanceof Error ? error.message : 'Nie udało się otworzyć materiału.',
        offline: error instanceof MaterialAccessError && error.code === 'offline',
      })
    } finally {
      setOpeningKey(null)
    }
  }, [content, openingKey])

  const value = useMemo(() => ({ openingKey, openMaterial }), [openingKey, openMaterial])
  return (
    <MaterialAccessContext.Provider value={value}>
      {children}
      {notice && (
        <aside className="material-access-notice" role="alert">
          {notice.offline ? <WifiOff aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          <div>
            <strong>Nie udało się otworzyć: {notice.request.title}</strong>
            <span>{notice.message}</span>
          </div>
          <button className="secondary-action" type="button" onClick={() => void openMaterial(notice.request)}>
            <RefreshCw aria-hidden="true" /> Spróbuj ponownie
          </button>
          <button className="icon-button" type="button" onClick={() => setNotice(null)} aria-label="Zamknij komunikat">
            <X aria-hidden="true" />
          </button>
        </aside>
      )}
    </MaterialAccessContext.Provider>
  )
}

export function useMaterialAccess() {
  const value = useContext(MaterialAccessContext)
  if (!value) throw new Error('useMaterialAccess musi działać wewnątrz MaterialAccessProvider.')
  return value
}
