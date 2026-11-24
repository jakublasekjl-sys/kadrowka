import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve, sep } from 'node:path'
import { applySourceImageRepairs, sourceImageRepairs } from './source-image-repairs.mjs'

const root = resolve(import.meta.dirname, '../../package/content-package/files')
const repair = sourceImageRepairs[0]
const source = resolve(root, repair.to.replace(/^files\//, ''))
const temporary = mkdtempSync(resolve(tmpdir(), 'kadrowka-image-repair-'))
if (!temporary.startsWith(resolve(tmpdir()) + sep)) throw new Error('Nieoczekiwana sciezka testowa.')
try {
  const oldPath = resolve(temporary, repair.from.replace(/^files\//, ''))
  const newPath = resolve(temporary, repair.to.replace(/^files\//, ''))
  mkdirSync(dirname(oldPath), { recursive: true })
  copyFileSync(source, oldPath)
  applySourceImageRepairs(temporary)
  assert.ok(!existsSync(oldPath) && existsSync(newPath), 'Obraz nie zostal przemianowany na PNG.')
  assert.deepEqual(readFileSync(newPath), readFileSync(source), 'Naprawa nie moze zmieniac pikseli ani metadanych obrazu.')
  applySourceImageRepairs(temporary)
  rmSync(newPath)
  writeFileSync(oldPath, 'niepoprawny obraz')
  assert.throws(() => applySourceImageRepairs(temporary), /zmienil sie/)
  assert.ok(existsSync(oldPath) && !existsSync(newPath), 'Bledny obraz nie moze zostac przemianowany.')
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
console.log('Naprawa obrazu: OK (PNG, zachowanie danych, idempotencja, odrzucenie zmiany SHA-256).')
