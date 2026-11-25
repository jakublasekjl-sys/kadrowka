import { parseRuntimeConfig } from '../src/config/runtimeConfig.ts'
import { installMaterialResolver, loadActiveMaterialCatalog, parseMaterialCatalog, resolveMaterialUrl } from '../src/content/materialCatalog.ts'
import { readJsonResponse } from '../src/security/jsonResponse.ts'

async function readJson(url) {
  const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return readJsonResponse(response, 12 * 1024 * 1024, url)
}

export async function loadDeploymentMaterials(base) {
  const config = parseRuntimeConfig(await readJson(new URL('/runtime-config.json', base)))
  const localCatalog = parseMaterialCatalog(await readJson(new URL('/content/materials-catalog.json', base)))
  const active = await loadActiveMaterialCatalog(localCatalog, config)
  if (config.azure.enabled && active.source !== 'azure') throw new Error('Wdrożenie Azure nie korzysta z katalogu Blob.')
  installMaterialResolver(active.catalog, active.source, config.azure.publicBaseUrl)
  return { config, catalog: active.catalog, source: active.source, materialUrl: resolveMaterialUrl }
}
