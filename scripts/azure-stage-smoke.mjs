import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { installMaterialResolver, parseMaterialCatalog, resolveMaterialUrl } from '../src/content/materialCatalog.ts'
import { isAdminPanelAvailable, parseRuntimeConfig } from '../src/config/runtimeConfig.ts'

const root = resolve(import.meta.dirname, '..')
const appRoot = resolve(root, 'release/kadrowka-azure-app')
const blobRoot = resolve(root, 'release/kadrowka-azure-content')
const manifest = JSON.parse(readFileSync(resolve(root, 'release/kadrowka-azure-manifest.json'), 'utf8'))
const config = parseRuntimeConfig(JSON.parse(readFileSync(resolve(appRoot, 'runtime-config.json'), 'utf8')))
const catalog = parseMaterialCatalog(JSON.parse(readFileSync(resolve(blobRoot, manifest.catalogPath), 'utf8')))
const assets = JSON.parse(readFileSync(resolve(appRoot, 'content/assets-index.json'), 'utf8'))

assert.equal(config.azure.enabled, true)
assert.equal(config.adminPanelEnabled, false)
assert.equal(isAdminPanelAvailable(config), false)
assert.equal(config.azure.catalogReleaseId, manifest.releaseId)
assert.equal(catalog.releaseId, manifest.releaseId)
assert.equal(catalog.contentVersion, manifest.contentVersion)
assert.equal(catalog.materialCount, manifest.materialFiles)
assert.equal(catalog.totalBytes, manifest.materialBytes)
assert.ok(manifest.appBytes < 250 * 1024 * 1024)
assert.equal(existsSync(resolve(appRoot, 'content/files')), false)
assert.equal(existsSync(resolve(appRoot, 'index.html')), true)
assert.equal(existsSync(resolve(appRoot, 'staticwebapp.config.json')), true)

const origin = new URL(config.azure.publicBaseUrl).origin
const swa = JSON.parse(readFileSync(resolve(appRoot, 'staticwebapp.config.json'), 'utf8'))
const apache = readFileSync(resolve(appRoot, '.htaccess'), 'utf8')
for (const csp of [swa.globalHeaders['Content-Security-Policy'], apache.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '']) {
  for (const directive of ['img-src', 'connect-src', 'media-src']) {
    assert.match(csp, new RegExp(`${directive}[^;]*${origin.replaceAll('.', '\\.')}[^;]*;`))
  }
  assert.doesNotMatch(csp, /\*\.blob\.core\.windows\.net/)
}

installMaterialResolver(catalog, 'azure', config.azure.publicBaseUrl)
for (const asset of assets) {
  const url = resolveMaterialUrl(asset.path)
  assert.ok(url.startsWith(`${config.azure.publicBaseUrl}/releases/${manifest.releaseId}/files/`), asset.path)
}
for (const material of catalog.materials) {
  const path = resolve(blobRoot, material.storagePath)
  assert.ok(existsSync(path), material.storagePath)
  assert.equal(statSync(path).size, material.size, material.storagePath)
}
assert.equal(readdirSync(resolve(blobRoot, 'catalog')).length, 1)
assert.equal(resolveMaterialUrl('files/__missing__.pdf'), '')
console.log(`Azure staging: OK (${manifest.appFiles} plików aplikacji, ${catalog.materialCount} unikalnych materiałów, ${assets.length} ścieżek).`)
