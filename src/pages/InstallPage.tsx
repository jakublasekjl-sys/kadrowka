import { InstallAppGuide } from '../components/InstallAppGuide'
import { PageHeader } from '../components/PageHeader'

export function InstallPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Instalacja na telefonie"
        lead="Kadrówkę można dodać do ekranu głównego bez sklepu Google Play i App Store."
      />
      <InstallAppGuide standalone />
    </div>
  )
}
