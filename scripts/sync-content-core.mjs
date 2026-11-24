import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readZipCatalog } from './content-package-utils.mjs'
import { assertSafeArchive } from './security-utils.mjs'
import { sourcePackageZip } from './source-package.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = sourcePackageZip
const target = process.env.KADROWKA_CONTENT_ROOT
  ? resolve(process.env.KADROWKA_CONTENT_ROOT)
  : resolve(projectRoot, 'public/content')
const categoriesPath = resolve(projectRoot, 'public/content/czuwaj-categories.json')
if (!existsSync(categoriesPath)) throw new Error('Brak katalogu kategorii artykulow z Czuwaj w repozytorium.')
const articleCategories = JSON.parse(readFileSync(categoriesPath, 'utf8'))
for (const asset of ['public/kadrowka_logo.png', 'public/kadrowka-logo-v2.png', 'public/pracazkadra.webp']) {
  if (!existsSync(resolve(projectRoot, asset))) throw new Error(`Brak zasobu graficznego w repozytorium: ${asset}`)
}
const entries = [
  'manifest.json',
  'branding.json',
  'categories.json',
  'documents.json',
  'home.json',
  'modules.json',
  'pages.json',
  'curated-pages.json',
  'page-layouts.json',
  'search/search-index.json',
  'planning/planning-config.json',
  'planning/schedule-config.json',
  'planning/analysis-tools.json',
  'planning/questions-gromada.json',
  'planning/questions-druzyna.json',
  'planning/team-kadry-aspects.json',
]

if (!existsSync(packagePath)) {
  throw new Error(`Nie znaleziono paczki treści: ${packagePath}`)
}

assertSafeArchive(readZipCatalog(packagePath))

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

const result = spawnSync('tar', ['-xf', packagePath, '-C', target, ...entries], {
  stdio: 'inherit',
})
if (result.status !== 0) {
  throw new Error(`Nie udało się przygotować danych treści (tar: ${result.status})`)
}

writeFileSync(
  resolve(target, 'czuwaj-categories.json'),
  JSON.stringify(articleCategories, null, 2),
  'utf8',
)

console.log(`Treści rdzeniowe zsynchronizowane z: ${packagePath}`)
