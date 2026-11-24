import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { decodeSingleQuotedJsString, isSafeArchivePath, safeContentPath, safeExternalUrl } from './security-utils.mjs'
import { validateMaterialSignature } from './file-signature-utils.mjs'
import { isAdminPanelAvailable, parseRuntimeConfig } from '../src/config/runtimeConfig.ts'
import { parseMaterialCatalog, parseMaterialCatalogPointer } from '../src/content/materialCatalog.ts'
import { readJsonResponse } from '../src/security/jsonResponse.ts'
import { assertProductionRuntime, configuredBlobOrigin, pinBlobOriginInCsp } from './security-headers.mjs'

const root = resolve(import.meta.dirname, '..')

function walk(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function collectObjects(value, output = []) {
  if (!value || typeof value !== 'object') return output
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, output))
    return output
  }
  output.push(value)
  Object.values(value).forEach((item) => collectObjects(item, output))
  return output
}

assert.equal(safeExternalUrl('https://zhp.pl/path'), 'https://zhp.pl/path')
for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', '//example.com', 'https://user:pass@example.com']) {
  assert.equal(safeExternalUrl(url), '', `Niebezpieczny URL zostal dopuszczony: ${url}`)
}
assert.equal(safeContentPath('files/modul/dokument.pdf'), 'files/modul/dokument.pdf')
for (const path of ['../sekret', 'files/../sekret', 'files/%2e%2e/sekret', 'files/a%2fb.pdf', 'files/a%252fb.pdf', 'files/a?x.pdf', 'files/a:b.pdf', 'files/\u202eevil.pdf', '/files/a.pdf', 'https://example.com/a.pdf']) {
  assert.equal(safeContentPath(path), '', `Niebezpieczna sciezka zostala dopuszczona: ${path}`)
}
for (const path of ['../a', '/a', 'C:/a', 'files/../../a']) assert.equal(isSafeArchivePath(path), false)
assert.equal(decodeSingleQuotedJsString('{\\"a\\":\\"x\\u002fy\\"}'), '{"a":"x/y"}')

assert.deepEqual(await readJsonResponse(new Response('{"ok":true}', {
  headers: { 'Content-Type': 'application/json' },
}), 32, 'test'), { ok: true })
await assert.rejects(readJsonResponse(new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('{"ok":'))
    controller.enqueue(new Uint8Array(100))
    controller.close()
  },
}), { headers: { 'Content-Type': 'application/json' } }), 20, 'bez Content-Length'), /zbyt duży/)
await assert.rejects(readJsonResponse(new Response('<html></html>', {
  headers: { 'Content-Type': 'text/html' },
}), 100, 'HTML'), /Nieprawidłowy typ/)

const sourceFiles = [
  ...walk(resolve(root, 'src')).filter((path) => ['.ts', '.tsx'].includes(extname(path))),
  ...walk(resolve(root, 'scripts')).filter((path) => extname(path) === '.mjs' && !path.endsWith('security-smoke.mjs')),
]
const source = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
for (const [label, pattern] of [
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['przypisanie innerHTML', /\.innerHTML\s*=/],
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\s*\(/],
  ['node:vm', /node:vm|runInNewContext/],
]) assert.doesNotMatch(source, pattern, `W kodzie pozostalo ryzykowne uzycie: ${label}`)

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[ps]_[A-Za-z0-9]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/,
]
for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, `W kodzie wykryto ciag przypominajacy sekret: ${pattern}`)

const contentFiles = walk(resolve(root, 'public/content')).filter((path) => extname(path) === '.json')
const contentObjects = contentFiles.flatMap((path) => collectObjects(JSON.parse(readFileSync(path, 'utf8'))))
for (const item of contentObjects) {
  if (typeof item.url === 'string' && item.url.trim()) assert.ok(safeExternalUrl(item.url), `Niedozwolony URL w tresci: ${item.url}`)
  if (typeof item.path === 'string' && item.path.trim()) assert.ok(safeContentPath(item.path), `Niedozwolona sciezka w tresci: ${item.path}`)
}

const materialRoot = resolve(root, '../package/content-package/files')
const assets = JSON.parse(readFileSync(resolve(root, 'public/content/assets-index.json'), 'utf8'))
const repairedImage = 'files/pozostale-materialy/3703019478-Clipart---home-icon.png'
assert.ok(assets.some((asset) => asset.path === repairedImage), 'Naprawiony obraz PNG musi znalezc sie w indeksie.')
assert.ok(!assets.some((asset) => asset.path === repairedImage.replace(/\.png$/, '.jpeg')), 'Nie wolno publikowac obrazu PNG pod nazwa JPEG.')
const diagnostics = JSON.parse(readFileSync(resolve(root, 'public/content/diagnostics.json'), 'utf8'))
assert.equal(diagnostics.counts.quarantinedAssets, 0, 'Publikacja nie moze ukrywac plikow odrzuconych przez walidacje.')
const materialFiles = assets.map((asset) => resolve(materialRoot, asset.path.replace(/^files\//, '')))
for (const path of materialFiles) validateMaterialSignature(path)

const materialCatalog = JSON.parse(readFileSync(resolve(root, 'public/content/materials-catalog.json'), 'utf8'))
assert.equal(parseMaterialCatalog(materialCatalog).materialCount, materialCatalog.materials.length)
assert.ok(materialCatalog.materials.length > 500)
assert.ok(materialCatalog.materials.some((material) => material.legacyPaths.includes(repairedImage)), 'Naprawiony obraz musi byc dostepny przez katalog materialow.')
for (const [label, update] of [
  ['obca ścieżka Storage', { storagePath: 'catalog/current.json' }],
  ['ścieżka spoza materiału', { storagePath: 'releases/release-test/files/obcy.pdf' }],
  ['niedozwolony MIME', { mimeType: 'text/html' }],
]) {
  const invalid = structuredClone(materialCatalog)
  Object.assign(invalid.materials[0], update)
  assert.throws(() => parseMaterialCatalog(invalid), undefined, label)
}
assert.throws(() => parseMaterialCatalogPointer({
  schemaVersion: 1,
  releaseId: 'release-a',
  catalogPath: 'catalog/release-b.json',
  publishedAt: new Date().toISOString(),
}), /niespójne/)

const runtimeConfig = JSON.parse(readFileSync(resolve(root, 'public/runtime-config.json'), 'utf8'))
const parsedRuntimeConfig = parseRuntimeConfig(runtimeConfig)
if (!parsedRuntimeConfig.azure.enabled) {
  assert.equal(parsedRuntimeConfig.adminPanelEnabled, false, 'Panel nie może być włączony bez Azure w paczce wdrożeniowej.')
}
assert.equal(isAdminPanelAvailable(parsedRuntimeConfig), parsedRuntimeConfig.adminPanelEnabled && parsedRuntimeConfig.azure.enabled)
const azureConfig = {
  ...runtimeConfig,
  environment: 'production',
  adminPanelEnabled: true,
  azure: {
    enabled: true,
    tenantId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    storageAccountName: 'kadrowkatest',
    containerName: 'content',
    publicBaseUrl: 'https://kadrowkatest.blob.core.windows.net/content',
  },
}
assert.equal(isAdminPanelAvailable(parseRuntimeConfig(azureConfig)), true)
assert.throws(() => assertProductionRuntime(azureConfig), /Bezposredni panel Blob/)
assert.equal(assertProductionRuntime({ ...azureConfig, adminPanelEnabled: false }), 'https://kadrowkatest.blob.core.windows.net')
assert.throws(() => assertProductionRuntime({ ...azureConfig, environment: 'development', adminPanelEnabled: false }), /production/)
assert.equal(configuredBlobOrigin(azureConfig), 'https://kadrowkatest.blob.core.windows.net')
assert.equal(pinBlobOriginInCsp("img-src 'self'; connect-src 'self'; media-src 'self';", configuredBlobOrigin(azureConfig)),
  "img-src 'self' https://kadrowkatest.blob.core.windows.net; connect-src 'self' https://kadrowkatest.blob.core.windows.net; media-src 'self' https://kadrowkatest.blob.core.windows.net;")
assert.throws(() => configuredBlobOrigin({ ...azureConfig, azure: { ...azureConfig.azure, publicBaseUrl: 'https://obce.example/content' } }))
assert.throws(() => parseRuntimeConfig({ ...azureConfig, azure: { ...azureConfig.azure, publicBaseUrl: 'https://evil.example/content' } }))
assert.throws(() => parseRuntimeConfig({ ...azureConfig, azure: { ...azureConfig.azure, tenantId: 'not-a-tenant-id' } }))
assert.equal(isAdminPanelAvailable({ ...runtimeConfig, environment: 'production', adminPanelEnabled: true }), false)

const apache = readFileSync(resolve(root, 'public/.htaccess'), 'utf8')
for (const marker of ['Options -Indexes', 'Strict-Transport-Security', 'Content-Security-Policy', "default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", 'X-Content-Type-Options', 'Cross-Origin-Opener-Policy', 'content/files/', '[R=404,L]']) {
  assert.ok(apache.includes(marker), `Brak zabezpieczenia Apache: ${marker}`)
}
const csp = apache.match(/Content-Security-Policy[^\n]+/)?.[0] ?? ''
assert.doesNotMatch(csp.match(/script-src[^;]+/)?.[0] ?? '', /unsafe-inline|unsafe-eval/)
assert.doesNotMatch(csp, /\*\.blob\.core\.windows\.net/)
assert.match(apache, /<Files "runtime-config\.json">[\s\S]*?no-store/)

const staticWebApp = JSON.parse(readFileSync(resolve(root, 'public/staticwebapp.config.json'), 'utf8'))
for (const route of ['/.htaccess', '/.env', '/.git/*', '/src/*', '/scripts/*']) {
  assert.equal(staticWebApp.routes.find((item) => item.route === route)?.statusCode, 404, `Brak blokady Azure dla ${route}`)
}
assert.deepEqual(staticWebApp.routes.find((route) => route.route === '/admin*')?.allowedRoles, ['administrator'])
assert.equal(staticWebApp.routes.find((route) => route.route === '/runtime-config.json')?.headers?.['Cache-Control'], 'no-store, max-age=0')
assert.equal(staticWebApp.responseOverrides?.['401']?.redirect, '/.auth/login/aad')
assert.doesNotMatch(staticWebApp.globalHeaders['Content-Security-Policy'].match(/script-src[^;]+/)?.[0] ?? '', /unsafe-inline|unsafe-eval/)
assert.doesNotMatch(staticWebApp.globalHeaders['Content-Security-Policy'], /\*\.blob\.core\.windows\.net/)

const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
assert.match(vite, /navigateFallbackDenylist:[\s\S]*content\\?\/files/)
assert.ok(vite.includes('kadrowka-materialy-v3'))
assert.ok(vite.includes('cacheableResponse: { statuses: [200] }'))
assert.ok(vite.includes('purgeOnQuotaError: true'))
assert.match(vite, /globIgnores:[^\n]+runtime-config\.json/)
const workerPath = resolve(root, 'dist/sw.js')
if (existsSync(workerPath)) assert.doesNotMatch(readFileSync(workerPath, 'utf8'), /runtime-config\.json/, 'Konfiguracja administratora nie może być precache\'owana.')

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
assert.ok(packageJson.scripts['content:rollback'])
assert.ok(packageJson.scripts['deploy:prepare'].includes('test:security'))

for (const outputName of ['dist', 'release/kadrowka-web']) {
  const output = resolve(root, outputName)
  if (!existsSync(output)) continue
  const unexpected = walk(output).filter((path) => /(?:\.map|\.aspx|\.env|private[-_.]?key|credentials?)$/i.test(path))
  assert.deepEqual(unexpected.map((path) => relative(output, path)), [], `${outputName} zawiera pliki niedozwolone we wdrozeniu.`)
}

console.log(`Bezpieczenstwo statyczne: OK (${sourceFiles.length} plikow kodu, ${contentFiles.length} plikow tresci, ${materialFiles.length} zweryfikowanych materialow).`)
