import assert from 'node:assert/strict'
import { loadDeploymentMaterials } from './deployment-materials.mjs'

const input = process.argv[2] ?? process.env.KADROWKA_URL
if (!input) throw new Error('Podaj adres, np. pnpm test:materials:deployment https://testowka.drogowskazykultury.org')

const base = new URL(input.endsWith('/') ? input : `${input}/`)
const indexUrl = new URL('content/assets-index.json', base)
const indexResponse = await fetch(indexUrl, { cache: 'no-store' })
assert.equal(indexResponse.ok, true, `${indexUrl.href}: HTTP ${indexResponse.status}`)
const assets = await indexResponse.json()
assert.equal(Array.isArray(assets), true, 'Indeks materiałów nie jest tablicą.')
const materials = await loadDeploymentMaterials(base)
const byLegacyPath = new Map(materials.catalog.materials.flatMap((record) => record.legacyPaths.map((path) => [path.normalize('NFC').toLocaleLowerCase('pl'), record])))
const targets = new Map()
for (const asset of assets) {
  const record = byLegacyPath.get(String(asset.path ?? '').normalize('NFC').toLocaleLowerCase('pl'))
  const path = materials.materialUrl(asset.path)
  assert.ok(record && path, `Materiał nie występuje w katalogu: ${asset.path}`)
  const url = new URL(path, base).href
  assert.equal(Number(asset.size), record.size, `Niezgodny rozmiar w indeksie: ${asset.path}`)
  if (!targets.has(url)) targets.set(url, record)
}

let next = 0
let checked = 0
const failures = []
const entries = [...targets]
const workers = Array.from({ length: Math.min(4, entries.length) }, async () => {
  while (next < entries.length) {
    const [url, record] = entries[next++]
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'follow', headers: materials.source === 'azure' ? { Origin: base.origin } : undefined })
      const contentType = response.headers.get('content-type') ?? ''
      const contentLength = Number(response.headers.get('content-length') ?? 0)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (/text\/html/i.test(contentType)) throw new Error(`zwrócono HTML (${contentType})`)
      if (materials.source === 'azure' && !contentType.toLowerCase().startsWith(record.mimeType.toLowerCase())) {
        throw new Error(`typ ${contentType} zamiast ${record.mimeType}`)
      }
      if (materials.source === 'azure' && !['*', base.origin].includes(response.headers.get('access-control-allow-origin'))) {
        throw new Error('brak CORS dla domeny aplikacji')
      }
      if (contentLength && contentLength !== record.size) {
        throw new Error(`rozmiar ${contentLength} B zamiast ${record.size} B`)
      }
    } catch (error) {
      failures.push(`${record.storagePath}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      checked += 1
      if (checked % 100 === 0 || checked === entries.length) console.log(`Sprawdzono ${checked} z ${entries.length} unikalnych materiałów.`)
      await new Promise((resolve) => setTimeout(resolve, 75))
    }
  }
})

await Promise.all(workers)
if (failures.length) {
  console.error(`Nieprawidłowe materiały (${failures.length}):`)
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`)
  if (failures.length > 100) console.error(`... i ${failures.length - 100} kolejnych.`)
  process.exitCode = 1
} else {
  console.log(`Materiały na serwerze: OK (${entries.length} plików, ${assets.length} ścieżek).`)
}
