import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installMaterialResolver, loadActiveMaterialCatalog, parseMaterialCatalog, resolveMaterialUrl } from '../src/content/materialCatalog.ts'
import { isAdminPanelAvailable, parseRuntimeConfig } from '../src/config/runtimeConfig.ts'

const local = parseMaterialCatalog(JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/content/materials-catalog.json'), 'utf8')))
const releaseId = 'content-test-release'
const config = parseRuntimeConfig({
  schemaVersion: 1,
  environment: 'development',
  adminPanelEnabled: false,
  azure: {
    enabled: true,
    tenantId: '',
    clientId: '',
    storageAccountName: 'kadrowkatest',
    containerName: 'content',
    publicBaseUrl: 'https://kadrowkatest.blob.core.windows.net/content',
    catalogReleaseId: releaseId,
  },
})
assert.equal(isAdminPanelAvailable(config), false)
assert.throws(() => parseRuntimeConfig({ ...config, adminPanelEnabled: true }))

const remote = parseMaterialCatalog({
  ...local,
  releaseId,
  materials: local.materials.map((material) => ({ ...material, storagePath: `releases/${releaseId}/${material.storagePath}` })),
})
const cache = new Map()
globalThis.localStorage = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => { cache.set(key, value) },
}
globalThis.fetch = async (url) => {
  assert.equal(url, `${config.azure.publicBaseUrl}/catalog/${releaseId}.json`)
  return Response.json(remote)
}
const active = await loadActiveMaterialCatalog(local, config)
assert.equal(active.source, 'azure')
installMaterialResolver(active.catalog, active.source, config.azure.publicBaseUrl)
assert.match(resolveMaterialUrl(local.materials[0].legacyPaths[0]), new RegExp(`/releases/${releaseId}/files/`))
assert.equal(resolveMaterialUrl('files/__missing__.pdf'), '')

globalThis.fetch = async () => { throw new TypeError('Network unavailable') }
const offline = await loadActiveMaterialCatalog(local, config)
assert.equal(offline.source, 'azure')
assert.match(offline.warning, /ostatnio sprawdzonego katalogu/)

globalThis.fetch = async () => new Response('Not found', { status: 404 })
await assert.rejects(loadActiveMaterialCatalog(local, config), /HTTP 404/)

globalThis.fetch = async () => Response.json({
  ...remote,
  materials: remote.materials.map((material, index) => index === 0 ? { ...material, title: 'Zmieniony tytuł' } : material),
})
await assert.rejects(loadActiveMaterialCatalog(local, config), /różni się od zatwierdzonego materiału/)

globalThis.fetch = async () => { throw new TypeError('Network unavailable') }
const otherRelease = parseRuntimeConfig({ ...config, azure: { ...config.azure, catalogReleaseId: 'content-other-release' } })
await assert.rejects(loadActiveMaterialCatalog(local, otherRelease), /Nie udało się wczytać materiałów/)
console.log('Konfiguracja Azure: OK (odczyt bez Entra, wersja przypięta, cache offline, brak cichego fallbacku).')
