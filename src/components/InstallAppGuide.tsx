import { CheckCircle2, Download, Share2, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { promptPwaInstall, subscribeInstallState, type InstallState } from '../pwa/pwaManager'

export function InstallAppGuide({ standalone = false }: { standalone?: boolean }) {
  const [state, setState] = useState<InstallState>({ canPrompt: false, installed: false })
  const [message, setMessage] = useState('')
  const platform = useMemo(() => {
    const agent = navigator.userAgent.toLocaleLowerCase('pl')
    if (/iphone|ipad|ipod/.test(agent)) return 'ios'
    if (/android/.test(agent)) return 'android'
    return 'other'
  }, [])

  useEffect(() => subscribeInstallState(setState), [])

  async function install() {
    const result = await promptPwaInstall()
    if (result === 'dismissed') setMessage('Instalacja została anulowana. Możesz uruchomić ją ponownie później.')
    if (result === 'unavailable') setMessage('Skorzystaj z instrukcji dla swojej przeglądarki poniżej.')
  }

  return (
    <section className="settings-section install-guide" id="instalacja">
      {!standalone && (
        <div className="settings-heading">
          <div><h2>Instalacja na telefonie</h2><p>Kadrówkę można dodać do ekranu głównego bez sklepu Google Play i App Store.</p></div>
          <Smartphone aria-hidden="true" />
        </div>
      )}
      {state.installed ? (
        <p className="status-message"><CheckCircle2 aria-hidden="true" /> Kadrówka jest uruchomiona jako zainstalowana aplikacja.</p>
      ) : state.canPrompt ? (
        <button className="primary-action" type="button" onClick={() => void install()}><Download aria-hidden="true" /> Zainstaluj aplikację</button>
      ) : null}
      {message && <p className="status-message status-warning" role="status">{message}</p>}
      <div className="install-platform-grid">
        <article className={platform === 'android' ? 'current-platform' : ''}>
          {standalone ? <h2>Android</h2> : <h3>Android</h3>}
          <ol>
            <li>Otwórz Kadrówkę w przeglądarce Chrome.</li>
            <li>Dotknij menu z trzema kropkami.</li>
            <li>Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.</li>
            <li>Potwierdź instalację.</li>
          </ol>
        </article>
        <article className={platform === 'ios' ? 'current-platform' : ''}>
          {standalone ? <h2>iPhone i iPad</h2> : <h3>iPhone i iPad</h3>}
          <ol>
            <li>Otwórz Kadrówkę w przeglądarce Safari.</li>
            <li>Dotknij przycisku udostępniania <Share2 aria-label="Udostępnij" />.</li>
            <li>Przewiń listę i wybierz „Do ekranu początkowego”.</li>
            <li>Dotknij „Dodaj”.</li>
          </ol>
        </article>
      </div>
      <p className="install-note">Nazwy poleceń mogą się nieznacznie różnić zależnie od wersji systemu. Instalacja wymaga otwarcia strony przez HTTPS.</p>
    </section>
  )
}
