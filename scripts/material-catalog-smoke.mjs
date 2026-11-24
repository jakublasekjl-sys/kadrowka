import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const filesRoot = resolve(root, '../package/content-package/files')
const catalog = JSON.parse(readFileSync(resolve(root, 'public/content/materials-catalog.json'), 'utf8'))
const assets = JSON.parse(readFileSync(resolve(root, 'public/content/assets-index.json'), 'utf8'))

assert.equal(catalog.schemaVersion, 1)
assert.equal(catalog.materialCount, catalog.materials.length)
assert.equal(catalog.totalBytes, catalog.materials.reduce((sum, item) => sum + item.size, 0))
assert.equal(new Set(catalog.materials.map((item) => item.id)).size, catalog.materials.length)

const paths = catalog.materials.flatMap((item) => item.legacyPaths)
assert.equal(new Set(paths.map((path) => path.normalize('NFC').toLocaleLowerCase('pl'))).size, paths.length)
assert.deepEqual(
  new Set(paths.map((path) => path.normalize('NFC').toLocaleLowerCase('pl'))),
  new Set(assets.map((asset) => asset.path.normalize('NFC').toLocaleLowerCase('pl'))),
)

function hashFile(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolveHash(hash.digest('hex')))
  })
}

const sample = catalog.materials.filter((_, index) => index % Math.max(1, Math.floor(catalog.materials.length / 12)) === 0).slice(0, 12)
for (const material of sample) {
  const relative = material.legacyPaths[0].replace(/^files\//, '')
  const path = resolve(filesRoot, relative)
  assert.ok(path.startsWith(filesRoot + sep) && existsSync(path), material.legacyPaths[0])
  assert.equal(await hashFile(path), material.sha256, material.legacyPaths[0])
}

console.log(`Katalog materiałów: OK (${catalog.materials.length} zasobów, ${paths.length} ścieżek, ${sample.length} skrótów kontrolnych).`)
