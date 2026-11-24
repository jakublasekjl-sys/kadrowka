import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const contentRoot = process.env.KADROWKA_CONTENT_ROOT
  ? resolve(process.env.KADROWKA_CONTENT_ROOT)
  : resolve('public/content')
let changedFiles = 0
let changedPaths = 0

function jsonFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return extname(path).toLowerCase() === '.json' ? [path] : []
  })
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeValue(child)]))
  }
  if (typeof value === 'string' && value.startsWith('files/')) {
    const normalized = value.normalize('NFC')
    if (normalized !== value) changedPaths += 1
    return normalized
  }
  return value
}

for (const path of jsonFiles(contentRoot)) {
  const source = readFileSync(path, 'utf8')
  const output = `${JSON.stringify(normalizeValue(JSON.parse(source)), null, 2)}\n`
  if (output !== source) {
    writeFileSync(path, output, 'utf8')
    changedFiles += 1
  }
}

console.log(`Znormalizowano ${changedPaths} ścieżek NFC w ${changedFiles} plikach JSON.`)
