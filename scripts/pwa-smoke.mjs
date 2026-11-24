import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
for (const path of ['index.html', 'favicon-v2.png', 'manifest.webmanifest', 'sw.js', 'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/icon-maskable-512-v2.png', 'icons/apple-touch-icon-180-v2.png']) assert.ok(existsSync(resolve(dist, path)), `Brak ${path}`)
const index = readFileSync(resolve(dist, 'index.html'), 'utf8')
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'))
const worker = readFileSync(resolve(dist, 'sw.js'), 'utf8')

assert.equal(manifest.display, 'standalone')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.lang, 'pl')
assert.equal(manifest.theme_color, '#5B2A86')
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'))
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'))
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'))
assert.ok(index.includes('manifest.webmanifest'))
assert.ok(index.includes('href="/favicon-v2.png"'))
assert.ok(index.includes('apple-touch-icon-180-v2.png'))
assert.ok(index.includes('name="theme-color" content="#5B2A86"'))
for (const asset of ['content/pages.json', 'content/modules.json', 'content/tools-catalog.json', 'content/search/search-index.json', 'content/planning/planning-config.json']) {
  assert.ok(worker.includes(asset), `Service Worker nie buforuje ${asset}`)
}
assert.ok(worker.includes('kadrowka-materialy-v3'))
assert.ok(worker.includes('NetworkFirst'), 'Materiały online nie używają strategii odświeżającej zapisany plik')
assert.ok(worker.includes('denylist') && worker.includes('content\\/files'), 'Fallback nawigacji PWA przechwytuje adresy materiałów')
assert.ok(worker.includes('/content/files/'))
assert.ok(worker.includes('index.html'))
assert.ok(worker.includes('self.skipWaiting()'), 'Service Worker nie przejmuje automatycznie starszej instalacji')
assert.ok(worker.includes('clientsClaim()'), 'Service Worker nie przejmuje otwartych klientów')
assert.ok(!worker.includes('.aspx'))

console.log('PWA: OK (ikony Android/iOS, manifest, nawigacja offline, rdzeń treści i cache materiałów).')
