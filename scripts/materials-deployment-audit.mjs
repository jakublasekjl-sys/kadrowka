import assert from 'node:assert/strict'

const input = process.argv[2] ?? process.env.KADROWKA_URL
if (!input) throw new Error('Podaj adres, np. pnpm test:materials:deployment https://testowka.drogowskazykultury.org')

const base = new URL(input.endsWith('/') ? input : `${input}/`)
const indexUrl = new URL('content/assets-index.json', base)
const indexResponse = await fetch(indexUrl, { cache: 'no-store' })
assert.equal(indexResponse.ok, true, `${indexUrl.href}: HTTP ${indexResponse.status}`)
const assets = await indexResponse.json()
assert.equal(Array.isArray(assets), true, 'Indeks materiałów nie jest tablicą.')

let next = 0
let checked = 0
const failures = []
const workers = Array.from({ length: Math.min(4, assets.length) }, async () => {
  while (next < assets.length) {
    const asset = assets[next++]
    const path = String(asset.path ?? '').split('/').map(encodeURIComponent).join('/')
    const url = new URL(`content/${path}`, base)
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'follow' })
      const contentType = response.headers.get('content-type') ?? ''
      const contentLength = Number(response.headers.get('content-length') ?? 0)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (/text\/html/i.test(contentType)) throw new Error(`zwrócono HTML (${contentType})`)
      if (contentLength && Number(asset.size) && contentLength !== Number(asset.size)) {
        throw new Error(`rozmiar ${contentLength} B zamiast ${asset.size} B`)
      }
    } catch (error) {
      failures.push(`${asset.path}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      checked += 1
      if (checked % 100 === 0 || checked === assets.length) console.log(`Sprawdzono ${checked} z ${assets.length} materiałów.`)
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
  console.log(`Materiały na serwerze: OK (${assets.length} plików).`)
}
