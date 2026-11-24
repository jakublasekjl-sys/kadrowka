import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pagesPath = resolve(projectRoot, 'public/content/pages.json')
const reportPath = resolve(projectRoot, 'docs/SSI_DUPLICATES_AUDIT.md')
const dataPath = resolve(projectRoot, 'docs/SSI_DUPLICATES_AUDIT.json')

const pages = JSON.parse(readFileSync(pagesPath, 'utf8'))
  .filter((page) => page.moduleId === 'system-stopni-instruktorskich-w-zhp')

function normalize(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl')
}

function collect(page) {
  const fragments = []
  for (const [blockIndex, block] of (page.blocks ?? []).entries()) {
    if (block.type === 'paragraph' && normalize(block.text).length >= 80) {
      fragments.push({
        kind: 'paragraph',
        text: String(block.text).replace(/\s+/g, ' ').trim(),
        location: { block: blockIndex + 1 },
      })
    }
    if (block.type === 'list') {
      for (const [itemIndex, item] of (block.items ?? []).entries()) {
        const text = typeof item === 'string' ? item : item?.text
        if (normalize(text).length < 25) continue
        fragments.push({
          kind: 'list-item',
          text: String(text).replace(/\s+/g, ' ').trim(),
          location: { block: blockIndex + 1, item: itemIndex + 1 },
        })
      }
    }
  }
  return fragments
}

function duplicateGroups(page, kind) {
  const byText = new Map()
  for (const fragment of collect(page).filter((item) => item.kind === kind)) {
    const key = normalize(fragment.text)
    const group = byText.get(key) ?? []
    group.push(fragment)
    byText.set(key, group)
  }
  return [...byText.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      pageId: page.id,
      pageTitle: page.title,
      sourceUrl: page.sourceUrl,
      kind,
      text: group[0].text,
      occurrences: group.map((item) => item.location),
    }))
}

const paragraphGroups = pages.flatMap((page) => duplicateGroups(page, 'paragraph'))
const listItemGroups = pages.flatMap((page) => duplicateGroups(page, 'list-item'))
const allGroups = [...paragraphGroups, ...listItemGroups]

function locations(group) {
  return group.occurrences
    .map((location) => location.item ? `blok ${location.block}, punkt ${location.item}` : `blok ${location.block}`)
    .join('; ')
}

function markdownQuote(text) {
  return text.split('\n').map((line) => `> ${line}`).join('\n')
}

function excerpt(text, length = 180) {
  return text.length <= length ? text : `${text.slice(0, length - 1).trim()}…`
}

const report = [
  '# Audyt potencjalnych duplikatów SSI',
  '',
  'Źródło: aktualny plik `public/content/pages.json` w aplikacji React.',
  '',
  'Historyczna liczba 58 ostrzeżeń nie jest już możliwa do odtworzenia po kolejnych etapach normalizacji i czyszczenia treści. Bieżący audyt rozdziela:',
  '',
  `- **${paragraphGroups.length} grup identycznych pełnych akapitów** - wymagają decyzji redakcyjnej, czy powtórzenie jest potrzebne w danym kontekście;`,
  `- **${listItemGroups.length} grup identycznych punktów list** - wiele z nich to świadome powtórzenia fragmentów idei stopnia przy objaśnianiu kolejnych wymagań.`,
  '',
  'Raport niczego nie usuwa. Pełne dane wszystkich grup i lokalizacji znajdują się także w `SSI_DUPLICATES_AUDIT.json`.',
  '',
  '## Identyczne pełne akapity',
  '',
]

let number = 0
for (const page of pages) {
  const groups = paragraphGroups.filter((group) => group.pageId === page.id)
  if (!groups.length) continue
  report.push(`### ${page.title}`, '', `Źródło: \`${page.sourceUrl}\``, '')
  for (const group of groups) {
    number += 1
    report.push(
      `#### ${number}. Powtórzenie ${group.occurrences.length} razy`,
      '',
      `**Lokalizacje:** ${locations(group)}`,
      '',
      markdownQuote(group.text),
      '',
    )
  }
}

report.push(
  '## Powtarzające się punkty list',
  '',
  'Ta część jest pomocnicza. Krótkie zdania z idei stopnia są celowo przywoływane przy kilku wymaganiach, dlatego nie powinny być usuwane automatycznie.',
  '',
  '| Strona | Liczba wystąpień | Lokalizacje | Początek treści |',
  '|---|---:|---|---|',
)
for (const group of listItemGroups) {
  report.push(`| ${group.pageTitle} | ${group.occurrences.length} | ${locations(group)} | ${excerpt(group.text).replaceAll('|', '\\|')} |`)
}

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${report.join('\n')}\n`, 'utf8')
writeFileSync(dataPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'public/content/pages.json',
  pageCount: pages.length,
  paragraphGroupCount: paragraphGroups.length,
  listItemGroupCount: listItemGroups.length,
  groups: allGroups,
}, null, 2)}\n`, 'utf8')

console.log(
  `Audyt SSI: ${paragraphGroups.length} grup akapitów i ${listItemGroups.length} grup punktów list. Raport: ${reportPath}`,
)
