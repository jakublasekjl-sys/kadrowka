import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMaterialCatalog } from '../src/content/materialCatalog.ts'
import { parseRuntimeConfig } from '../src/config/runtimeConfig.ts'

const root = resolve(import.meta.dirname, '..')
const stage = resolve(root, 'release/kadrowka-azure-app')
const config = parseRuntimeConfig(JSON.parse(readFileSync(resolve(stage, 'runtime-config.json'), 'utf8')))
const releaseId = config.azure.catalogReleaseId
assert.ok(config.azure.enabled && releaseId, 'Brak przypiętego wydania Azure.')
const catalog = parseMaterialCatalog(JSON.parse(readFileSync(resolve(root, `release/kadrowka-azure-content/catalog/${releaseId}.json`), 'utf8')))
const base = config.azure.publicBaseUrl.replace(/\/$/, '')
const mode = process.argv[2] ?? 'files'
if (!['files', 'catalog'].includes(mode)) throw new Error('Użyj: pnpm test:azure:blob files|catalog')

function blobUrl(path) {
  return `${base}/${path.split('/').map(encodeURIComponent).join('/')}`
}

if (mode === 'catalog') {
  const origin = process.env.KADROWKA_APP_ORIGIN
  if (!origin || new URL(origin).protocol !== 'https:') throw new Error('Podaj KADROWKA_APP_ORIGIN=https://domena aplikacji.')
  const response = await fetch(blobUrl(`catalog/${releaseId}.json`), { cache: 'no-store', headers: { Origin: origin } })
  assert.equal(response.ok, true, `Katalog Blob: HTTP ${response.status}`)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i, 'Nieprawidłowy typ katalogu.')
  assert.ok(['*', origin].includes(response.headers.get('access-control-allow-origin')), 'Brak CORS dla katalogu.')
  const remote = parseMaterialCatalog(await response.json())
  assert.deepEqual(remote, catalog, 'Opublikowany katalog różni się od zatwierdzonego wydania.')
  console.log(`Katalog Blob: OK (${releaseId}).`)
} else {
  const origin = process.env.KADROWKA_APP_ORIGIN
  if (!origin || new URL(origin).protocol !== 'https:') throw new Error('Podaj KADROWKA_APP_ORIGIN=https://domena aplikacji.')
  let next = 0
  let checked = 0
  const errors = []
  const workers = Array.from({ length: 4 }, async () => {
    while (next < catalog.materials.length) {
      const material = catalog.materials[next++]
      try {
        const url = blobUrl(material.storagePath)
        const response = await fetch(url, { cache: 'no-store', headers: { Origin: origin }, signal: AbortSignal.timeout(180000) })
        assert.equal(response.ok, true, `HTTP ${response.status}`)
        assert.ok((response.headers.get('content-type') ?? '').toLowerCase().startsWith(material.mimeType.toLowerCase()), 'Niezgodny typ MIME.')
        assert.equal(Number(response.headers.get('content-length')), material.size, 'Niezgodny rozmiar pliku.')
        assert.ok(['*', origin].includes(response.headers.get('access-control-allow-origin')), 'Brak CORS dla aplikacji.')
        assert.ok(response.body, 'Brak zawartości pliku.')
        const hash = createHash('sha256')
        for await (const chunk of response.body) hash.update(chunk)
        assert.equal(hash.digest('hex'), material.sha256, 'Niezgodny SHA-256 pliku.')
      } catch (error) {
        errors.push(`${material.storagePath}: ${error instanceof Error ? error.message : String(error)}`)
      }
      checked += 1
      if (checked % 100 === 0 || checked === catalog.materials.length) console.log(`Blob: ${checked}/${catalog.materials.length} plików sprawdzonych.`)
    }
  })
  await Promise.all(workers)
  if (errors.length) throw new Error(`Nieprawidłowe pliki Blob (${errors.length}):\n${errors.slice(0, 20).join('\n')}`)
  console.log(`Materiały Blob: OK (${catalog.materials.length} plików, pełny SHA-256).`)
}
