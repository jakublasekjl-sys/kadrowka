import assert from 'node:assert/strict'

const input = process.argv[2] ?? process.env.KADROWKA_URL
if (!input) {
  throw new Error('Podaj adres, np. pnpm test:deployment https://testowka.drogowskazykultury.org')
}

const base = new URL(input.endsWith('/') ? input : `${input}/`)
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
  throw new Error(`Wdrożenie PWA musi działać przez HTTPS: ${base.href}`)
}

async function request(path, expectedType) {
  const url = new URL(path.replace(/^\//, ''), base)
  const response = await fetch(url, { redirect: 'follow' })
  assert.equal(response.ok, true, `${url.href}: HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (expectedType) assert.match(contentType, expectedType, `${url.href}: nieprawidłowy Content-Type: ${contentType}`)
  return response
}

const home = await request('/', /text\/html/i)
assert.match(await home.text(), /<div id="root"><\/div>/, 'Start nie zawiera kontenera aplikacji React.')
assert.equal(home.headers.get('x-content-type-options'), 'nosniff', 'Brak ochrony przed sniffingiem MIME.')
assert.equal(home.headers.get('x-frame-options'), 'DENY', 'Aplikacja może zostać osadzona w obcej ramce.')
assert.match(home.headers.get('content-security-policy') ?? '', /default-src 'self'/, 'Brak Content Security Policy.')
assert.match(home.headers.get('content-security-policy') ?? '', /object-src 'none'/, 'CSP dopuszcza niebezpieczne obiekty.')
assert.doesNotMatch((home.headers.get('content-security-policy') ?? '').match(/script-src[^;]+/)?.[0] ?? '', /unsafe-inline|unsafe-eval/, 'CSP dopuszcza skrypty inline lub eval.')
if (base.protocol === 'https:') assert.match(home.headers.get('strict-transport-security') ?? '', /max-age=\d+/, 'Brak HSTS.')

const deepRoute = await request('/page/proces-pracy-z-kadra', /text\/html/i)
assert.match(await deepRoute.text(), /<div id="root"><\/div>/, 'Fallback SPA nie działa dla bezpośredniej podstrony.')

const webManifest = await (await request('/manifest.webmanifest', /application\/(manifest\+json|json)/i)).json()
assert.equal(webManifest.name, 'Kadrówka', 'Manifest PWA ma nieprawidłową nazwę.')
assert.ok(webManifest.icons?.some((icon) => icon.sizes === '192x192'), 'Manifest nie zawiera ikony 192x192.')
assert.ok(webManifest.icons?.some((icon) => icon.sizes === '512x512' && String(icon.purpose).includes('maskable')), 'Manifest nie zawiera ikony maskowalnej 512x512.')

await request('/sw.js', /javascript/i)
await request('/pracazkadra.webp', /image\/webp/i)
const runtimeResponse = await request('/runtime-config.json', /application\/json/i)
assert.match(runtimeResponse.headers.get('cache-control') ?? '', /no-store/, 'Konfiguracja panelu nie może być cache\'owana.')
const runtimeConfig = await runtimeResponse.json()
if (runtimeConfig.adminPanelEnabled) {
  assert.equal(runtimeConfig.azure?.enabled, true, 'Panel administratora nie może być włączony bez Azure.')
  assert.equal(runtimeConfig.azure?.publicBaseUrl,
    `https://${runtimeConfig.azure.storageAccountName}.blob.core.windows.net/${runtimeConfig.azure.containerName}`,
    'Adres materiałów musi wskazywać skonfigurowany kontener.')
}

const contentManifest = await (await request('/content/manifest.json', /application\/json/i)).json()
const assets = await (await request('/content/assets-index.json', /application\/json/i)).json()
assert.equal(Array.isArray(assets), true, 'Indeks materiałów nie jest tablicą.')
assert.ok(assets.length >= 600, `Indeks materiałów jest zbyt mały: ${assets.length}.`)

const material = assets.find((asset) => /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(asset.path) && /\.(pdf|docx|xlsx|png|jpe?g|webp)$/i.test(asset.path))
  ?? assets.find((asset) => /\.(pdf|docx|xlsx|png|jpe?g|webp)$/i.test(asset.path))
assert.ok(material?.path, 'Nie znaleziono materiału do kontroli wielkości liter i ścieżki.')
const materialResponse = await request(`/content/${material.path.split('/').map(encodeURIComponent).join('/')}`)
const materialType = materialResponse.headers.get('content-type') ?? ''
assert.doesNotMatch(materialType, /text\/html/i, `Materiał ${material.path} został zastąpiony stroną HTML. Sprawdź wielkość liter i kompletność plików na serwerze.`)
assert.ok((await materialResponse.arrayBuffer()).byteLength > 0, `Materiał ${material.path} jest pusty.`)

const missingMaterialUrl = new URL('/content/files/__kadrowka-test-brakujacego-materialu__.pdf', base)
const missingMaterialResponse = await fetch(missingMaterialUrl, { redirect: 'manual' })
assert.equal(missingMaterialResponse.status, 404, `${missingMaterialUrl.href}: brakujący materiał powinien zwracać HTTP 404, otrzymano ${missingMaterialResponse.status}.`)
assert.doesNotMatch(await missingMaterialResponse.text(), /<div id="root"><\/div>/i, 'Brakujący materiał został zastąpiony stroną aplikacji React.')

for (const path of ['/assets/__kadrowka-missing__.js', '/package.json', '/src/main.tsx']) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' })
  assert.ok([403, 404].includes(response.status), `${path}: oczekiwano 403/404, otrzymano ${response.status}.`)
  assert.doesNotMatch(await response.text(), /<div id="root"><\/div>/i, `${path}: brakujący plik został zastąpiony aplikacją.`)
}

const directoryResponse = await fetch(new URL('/content/files/', base), { redirect: 'manual' })
assert.ok([403, 404].includes(directoryResponse.status), `Listing katalogu materiałów nie jest zablokowany: ${directoryResponse.status}.`)
if (process.env.KADROWKA_EXPECT_AZURE_ADMIN_ROUTE === '1') {
  const admin = await fetch(new URL('/admin', base), { redirect: 'manual' })
  assert.ok([302, 401, 403].includes(admin.status), `Panel jest publicznie dostępny mimo wymaganej roli administratora: ${admin.status}.`)
}

for (const path of ['/.env', '/.git/config', '/.htaccess']) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' })
  assert.ok([403, 404].includes(response.status), `${path}: plik techniczny jest publicznie dostępny.`)
}

const corsResponse = await fetch(new URL('/content/manifest.json', base), { headers: { Origin: 'https://attacker.example' } })
assert.equal(corsResponse.headers.get('access-control-allow-origin'), null, 'Serwer niepotrzebnie udostępnia treści przez CORS.')

if (base.protocol === 'https:') {
  const insecure = new URL(base)
  insecure.protocol = 'http:'
  const redirect = await fetch(insecure, { redirect: 'manual' })
  assert.ok([301, 302, 307, 308].includes(redirect.status), `HTTP nie przekierowuje do HTTPS: ${redirect.status}.`)
  assert.equal(new URL(redirect.headers.get('location') ?? '', insecure).protocol, 'https:', 'Przekierowanie HTTP nie prowadzi do HTTPS.')
}

console.log(`Wdrożenie OK: ${base.href}`)
console.log(`Treści: ${contentManifest.version}; materiały: ${assets.length}; próbka: ${material.path}`)
