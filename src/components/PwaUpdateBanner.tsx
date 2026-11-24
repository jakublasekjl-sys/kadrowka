import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyPwaUpdate, dismissPwaUpdate, subscribePwaUpdate } from '../pwa/pwaManager'

export function PwaUpdateBanner() {
  const [available, setAvailable] = useState(false)
  useEffect(() => subscribePwaUpdate(setAvailable), [])
  if (!available) return null

  return (
    <aside className="pwa-update-banner" role="status" aria-live="polite">
      <RefreshCw aria-hidden="true" />
      <div>
        <strong>Dostępna jest nowa wersja Kadrówki</strong>
        <span>Zaktualizuj aplikację, aby korzystać z najnowszych poprawek.</span>
      </div>
      <button className="primary-action" type="button" onClick={() => void applyPwaUpdate()}>Zaktualizuj</button>
      <button className="icon-button" type="button" title="Później" onClick={dismissPwaUpdate}><X aria-hidden="true" /></button>
    </aside>
  )
}
