import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import { analyzeMaterialFiles, prepareRelease } from '../src/admin/materialImport.ts'

const bytes = new TextEncoder().encode('%PDF-1.4\n%%EOF')
const digest = await crypto.subtle.digest('SHA-256', bytes)
const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
const file = new File([bytes], 'material.pdf', { type: 'application/pdf' })
Object.defineProperty(file, 'webkitRelativePath', { value: 'files/model-przywodztwa/material.pdf' })

const catalog = {
  schemaVersion: 1,
  releaseId: 'local-test',
  generatedAt: new Date().toISOString(),
  contentVersion: 'test',
  materialCount: 1,
  totalBytes: bytes.length,
  materials: [{
    id: `material-${hash.slice(0, 24)}`,
    title: 'Materiał',
    legacyPaths: ['files/model-przywodztwa/material.pdf'],
    storagePath: 'files/model-przywodztwa/material.pdf',
    sha256: hash,
    size: bytes.length,
    mimeType: 'application/pdf',
    assetKind: 'document',
    moduleIds: ['model-przywodztwa'],
    placements: [{ kind: 'module', targetId: 'model-przywodztwa', section: 'materials' }],
  }],
}
const modules = [{ id: 'model-przywodztwa', title: 'Model przywództwa' }]
const result = await analyzeMaterialFiles([file], catalog, modules)
assert.equal(result.length, 1)
assert.equal(result[0].status, 'unchanged')
assert.equal(result[0].sha256, hash)

const release = prepareRelease(catalog, result, 'release-test', [], 'local')
assert.equal(release.initialMigrationComplete, true)
assert.equal(release.uploads.length, 1)
assert.equal(release.catalog.materials[0].storagePath, 'releases/release-test/files/model-przywodztwa/material.pdf')

const bad = new File([bytes], 'evil.pdf', { type: 'application/pdf' })
Object.defineProperty(bad, 'webkitRelativePath', { value: 'files/../evil.pdf' })
const badResult = await analyzeMaterialFiles([bad], catalog, modules)
assert.equal(badResult[0].status, 'invalid')

const otherBytes = new TextEncoder().encode('%PDF-1.4\nother\n%%EOF')
const otherDigest = await crypto.subtle.digest('SHA-256', otherBytes)
const otherHash = [...new Uint8Array(otherDigest)].map((value) => value.toString(16).padStart(2, '0')).join('')
const previous = structuredClone(catalog)
previous.materials.push({
  ...structuredClone(catalog.materials[0]),
  id: `material-${otherHash.slice(0, 24)}`,
  legacyPaths: ['files/model-przywodztwa/drugi.pdf'],
  storagePath: 'files/model-przywodztwa/drugi.pdf',
  sha256: otherHash,
  size: otherBytes.length,
})
previous.materialCount = 2
previous.totalBytes = bytes.length + otherBytes.length
const replacementBytes = new TextEncoder().encode('%PDF-1.4\nreplacement\n%%EOF')
const replacements = ['material.pdf', 'drugi.pdf'].map((name) => {
  const replacement = new File([replacementBytes], name, { type: 'application/pdf' })
  Object.defineProperty(replacement, 'webkitRelativePath', { value: `files/model-przywodztwa/${name}` })
  return replacement
})
const analyzedReplacements = await analyzeMaterialFiles(replacements, previous, modules)
assert.deepEqual(analyzedReplacements.map((item) => item.status), ['replace', 'replace'])
const duplicatedBytesRelease = prepareRelease(previous, analyzedReplacements, 'release-two', [], 'azure')
assert.equal(duplicatedBytesRelease.uploads.length, 2)
for (const record of duplicatedBytesRelease.catalog.materials) {
  assert.ok(duplicatedBytesRelease.uploads.some((upload) => upload.materialId === record.id && upload.storagePath === record.storagePath))
}

console.log('Panel materiałów: analiza, SHA-256, migracja początkowa i ochrona ścieżek działają.')
