import { BookOpenCheck, CheckCircle2, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { OfflineMaterialsManager } from '../components/OfflineMaterialsManager'
import { ErrorState, LoadingState } from '../components/PageState'
import { useContent } from '../content/ContentContext'
import { downloadBackup, importBackupFile, verifyBackupCompatibility } from '../db/backup'

export function SettingsPage() {
  const { content, loading, error } = useContent()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  if (loading) return <LoadingState />
  if (error || !content) return <ErrorState message={error ?? 'Brak danych'} />

  async function importFile(file?: File) {
    if (!file) return
    try {
      const result = await importBackupFile(file, content!.manifest.version)
      setMessage(`Twoja praca została przywrócona (${result.importedCount} zapisanych obszarów). Odśwież widok, aby zobaczyć zmiany.`)
    } catch (importError) {
      setMessage(importError instanceof Error ? importError.message : 'Nie udało się wczytać kopii Twojej pracy.')
    }
  }

  async function verifyBackup() {
    try {
      const result = await verifyBackupCompatibility(content!.manifest.version)
      const areas = result.preferences === 1 ? '1 zapisany obszar danych' : `${result.preferences} zapisanych obszarów danych`
      setMessage(`Kopia jest gotowa do przywrócenia. Sprawdzono: ${areas}.`)
    } catch (verifyError) {
      setMessage(verifyError instanceof Error ? verifyError.message : 'Kontrola kopii nie powiodła się.')
    }
  }

  return <div className="page-stack"><PageHeader title="Ustawienia" lead="Dane, treści i informacje o aplikacji." />
    <section className="settings-section local-data-section"><h2>Twoje dane zostają na tym urządzeniu</h2><p>Plany, wnioski, notatki, ulubione i protokoły są zapisywane wyłącznie w tej przeglądarce na tym telefonie lub komputerze. Nie trafiają na serwer i nie synchronizują się automatycznie z innymi urządzeniami.</p><p>Przed zmianą telefonu, usunięciem aplikacji albo wyczyszczeniem danych przeglądarki pobierz kopię swojej pracy.</p></section>
    <section className="settings-section"><h2>Kopia Twojej pracy</h2><p>Zapisz w jednym pliku swoje plany, wnioski, notatki, ulubione, protokoły odpraw i postęp SSI. Kopię możesz później wczytać na tym lub innym urządzeniu.</p><div className="button-row wrap"><button className="secondary-action" type="button" onClick={() => void downloadBackup(content.manifest.version)}><Download aria-hidden="true" /> Pobierz kopię</button><button className="secondary-action" type="button" onClick={() => input.current?.click()}><Upload aria-hidden="true" /> Wczytaj kopię</button><button className="secondary-action" type="button" onClick={() => void verifyBackup()}><CheckCircle2 aria-hidden="true" /> Sprawdź kopię</button><input ref={input} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></div>{message && <p className="status-message" role="status">{message}</p>}</section>
    <section className="settings-section tutorial-settings"><div><h2>Pomoc i samouczek</h2><p>Przejdź ponownie przez najważniejsze funkcje Kadrówki i zasady zapisywania danych.</p></div><Link className="secondary-action" to="/tutorial"><BookOpenCheck aria-hidden="true" /> Uruchom samouczek</Link></section>
    <section className="settings-section"><h2>Wersje i treści</h2><dl><div><dt>Wersja aplikacji</dt><dd>{__APP_VERSION__}</dd></div><div><dt>Data buildu</dt><dd>{new Date(__BUILD_DATE__).toLocaleString('pl-PL')}</dd></div><div><dt>Wersja pakietu</dt><dd>{content.manifest.version}</dd></div><div><dt>Wydanie materiałów</dt><dd>{content.materialCatalog.releaseId}</dd></div><div><dt>Źródło materiałów</dt><dd>{content.materialCatalogSource === 'azure' ? 'Azure Blob Storage' : 'Lokalna paczka aplikacji'}</dd></div><div><dt>Strony</dt><dd>{content.pages.length}</dd></div><div><dt>Moduły</dt><dd>{content.modules.length}</dd></div></dl>{content.materialCatalogWarning && <p className="diagnostic-message warning">{content.materialCatalogWarning}</p>}</section>
    <OfflineMaterialsManager content={content} />
    <section className="settings-section diagnostics-section"><h2>Kontrola paczki</h2><p className={`diagnostic-state ${content.diagnostics.status}`}>{content.diagnostics.status === 'error' ? 'Wykryto błędy' : content.diagnostics.status === 'warning' ? 'Paczka działa, ale wymaga uwagi' : 'Paczka jest spójna'}</p><dl><div><dt>Pliki</dt><dd>{content.diagnostics.counts.assets}</dd></div><div><dt>Rozmiar materiałów</dt><dd>{(content.diagnostics.counts.totalAssetBytes / 1024 ** 2).toFixed(0)} MB</dd></div><div><dt>Sformatowane bloki</dt><dd>{content.diagnostics.counts.richTextBlocks ?? 0}</dd></div><div><dt>Klikalne grafiki</dt><dd>{content.diagnostics.counts.imageActions ?? 0}</dd></div><div><dt>Raport</dt><dd>{new Date(content.diagnostics.generatedAt).toLocaleString('pl-PL')}</dd></div></dl>{content.diagnostics.errors.map((item) => <p className="diagnostic-message error" key={item}>{item}</p>)}{content.diagnostics.warnings.map((item) => <p className="diagnostic-message warning" key={item}>{item}</p>)}{content.diagnostics.notes?.map((item) => <p className="diagnostic-message note" key={item}>{item}</p>)}</section>
    <section className="settings-section"><h2>Autor</h2><p>Jakub Lasek</p></section>
  </div>
}
