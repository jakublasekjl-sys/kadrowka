import assert from 'node:assert/strict'
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { assertProductionRuntime } from './security-headers.mjs'
import { validateMaterialSignature } from './file-signature-utils.mjs'

const release = resolve(import.meta.dirname, '../release/kadrowka-web')
const originInput = process.env.KADROWKA_PRODUCTION_ORIGIN
if (!originInput) throw new Error('Ustaw KADROWKA_PRODUCTION_ORIGIN na docelowy adres HTTPS.')
const origin = new URL(originInput)
assert.equal(origin.protocol, 'https:', 'Produkcja wymaga HTTPS.')
assert.equal(origin.pathname, '/', 'Adres produkcyjny nie moze zawierac podsciezki.')
assert.equal(origin.username + origin.password + origin.search + origin.hash, '', 'Adres produkcyjny nie moze zawierac danych logowania ani parametrow.')
assert.notEqual(origin.hostname, 'localhost', 'Podaj rzeczywista domene produkcyjna.')
assert.equal(process.env.KADROWKA_PUBLIC_MATERIALS_APPROVED, '1',
  'Wlasciciel tresci musi potwierdzic publiczny dostep do KAZDEGO materialu (KADROWKA_PUBLIC_MATERIALS_APPROVED=1).')

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) throw new Error(`Dowiazanie symboliczne w wydaniu: ${path}`)
    return stat.isDirectory() ? walk(path) : [path]
  })
}

for (const name of ['index.html', '.htaccess', 'staticwebapp.config.json', 'runtime-config.json', 'sw.js', 'content/assets-index.json', 'deployment-manifest.json']) {
  assert.ok(existsSync(resolve(release, name)), `Brak pliku wydania: ${name}`)
}

const runtime = JSON.parse(readFileSync(resolve(release, 'runtime-config.json'), 'utf8'))
const blobOrigin = assertProductionRuntime(runtime)
const swa = JSON.parse(readFileSync(resolve(release, 'staticwebapp.config.json'), 'utf8'))
const apache = readFileSync(resolve(release, '.htaccess'), 'utf8')
for (const csp of [swa.globalHeaders?.['Content-Security-Policy'], apache.match(/Header always set Content-Security-Policy "([^"]+)"/)?.[1]]) {
  assert.ok(csp, 'Brak polityki CSP w wydaniu.')
  assert.doesNotMatch(csp, /\*\.blob\.core\.windows\.net|unsafe-eval/, 'Polityka CSP jest zbyt szeroka.')
  if (blobOrigin) assert.ok(csp.includes(blobOrigin), 'CSP nie dopuszcza skonfigurowanego konta Blob.')
}

const assets = JSON.parse(readFileSync(resolve(release, 'content/assets-index.json'), 'utf8'))
assert.ok(Array.isArray(assets) && assets.length >= 600, 'Indeks materialow jest niepelny.')
const paths = new Set()
for (const asset of assets) {
  assert.match(asset.path, /^files\//, `Nieprawidlowa sciezka materialu: ${asset.path}`)
  const destination = resolve(release, 'content', asset.path)
  assert.ok(destination.startsWith(resolve(release, 'content/files') + '\\') || destination.startsWith(resolve(release, 'content/files') + '/'),
    `Material poza katalogiem: ${asset.path}`)
  assert.ok(existsSync(destination), `Brak materialu: ${asset.path}`)
  assert.equal(statSync(destination).size, asset.size, `Niezgodny rozmiar: ${asset.path}`)
  validateMaterialSignature(destination)
  const key = asset.path.normalize('NFC').toLocaleLowerCase('pl')
  assert.ok(!paths.has(key), `Kolizja nazw materialow: ${asset.path}`)
  paths.add(key)
}
const manifest = JSON.parse(readFileSync(resolve(release, 'deployment-manifest.json'), 'utf8'))
assert.equal(manifest.materialFiles, assets.length, 'Liczba plikow wydania nie zgadza sie z indeksem.')
assert.equal(manifest.quarantinedFiles, 0, 'Wydanie nie moze pomijac nieprawidlowych materialow.')

const releaseFiles = walk(release)
const forbidden = releaseFiles.filter((path) => /(?:\.map|\.aspx|\.env|private[-_.]?key|credentials?)$/i.test(path)
  || ['package.json', 'pnpm-lock.yaml'].includes(relative(release, path).replaceAll('\\', '/')))
assert.deepEqual(forbidden, [], `W wydaniu sa pliki niedozwolone: ${forbidden.map((path) => relative(release, path)).join(', ')}`)
assert.ok(releaseFiles.some((path) => relative(release, path).startsWith('assets') && extname(path) === '.js'), 'Brak plikow aplikacji.')

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[ps]_[A-Za-z0-9]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/,
]
for (const path of releaseFiles) {
  const name = relative(release, path).replaceAll('\\', '/')
  if (name.startsWith('content/files/') || !/\.(?:js|json|html|webmanifest)$/i.test(name)) continue
  const body = readFileSync(path, 'utf8')
  for (const pattern of secretPatterns) assert.doesNotMatch(body, pattern, `Mozliwy sekret w wydaniu: ${name}`)
}

console.log(`Kontrola lokalnej paczki produkcyjnej: OK (${assets.length} materialow; ${origin.origin}).`)
console.log('To nie potwierdza konfiguracji Azure, uprawnien ani statusu udostepnionej domeny.')
