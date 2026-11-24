import { readFileSync, writeFileSync } from 'node:fs'

export function configuredBlobOrigin(config) {
  if (!config.azure?.enabled) return ''
  const { storageAccountName, containerName, publicBaseUrl } = config.azure
  if (!/^[a-z0-9]{3,24}$/.test(storageAccountName)
    || !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(containerName)) {
    throw new Error('Nieprawidlowa nazwa Azure Storage w konfiguracji wydania.')
  }
  const origin = `https://${storageAccountName}.blob.core.windows.net`
  if (publicBaseUrl?.replace(/\/+$/, '') !== `${origin}/${containerName}`) {
    throw new Error('Adres kontenera Azure nie odpowiada nazwie konta i kontenera.')
  }
  return origin
}

export function assertProductionRuntime(config) {
  if (config.environment !== 'production') throw new Error('Wydanie musi uzywac konfiguracji production.')
  if (config.adminPanelEnabled) {
    throw new Error('Bezposredni panel Blob nie ma serwerowej walidacji publikacji i nie moze byc wlaczony w tym trybie wydania produkcyjnego.')
  }
  return configuredBlobOrigin(config)
}

export function pinBlobOriginInCsp(csp, origin) {
  if (!origin) return csp
  let result = csp
  for (const directive of ['img-src', 'connect-src', 'media-src']) {
    const pattern = new RegExp(`(${directive}[^;]*)(;)`)
    if (!pattern.test(result)) throw new Error(`Brak dyrektywy CSP: ${directive}`)
    result = result.replace(pattern, (_, value, end) => `${value} ${origin}${end}`)
  }
  return result
}

export function pinReleaseSecurityHeaders(releaseRoot, config) {
  const origin = configuredBlobOrigin(config)
  const apachePath = `${releaseRoot}/.htaccess`
  const apache = readFileSync(apachePath, 'utf8')
  const apacheUpdated = apache.replace(/(Header always set Content-Security-Policy ")([^"]+)(")/, (_, before, csp, after) =>
    `${before}${pinBlobOriginInCsp(csp, origin)}${after}`)
  if (apacheUpdated === apache && origin) throw new Error('Nie znaleziono CSP w .htaccess.')
  writeFileSync(apachePath, apacheUpdated, 'utf8')

  const swaPath = `${releaseRoot}/staticwebapp.config.json`
  const swa = JSON.parse(readFileSync(swaPath, 'utf8'))
  swa.globalHeaders['Content-Security-Policy'] = pinBlobOriginInCsp(swa.globalHeaders['Content-Security-Policy'], origin)
  writeFileSync(swaPath, `${JSON.stringify(swa, null, 2)}\n`, 'utf8')
}
