import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeSingleQuotedJsString, safeExternalUrl } from './security-utils.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = process.env.KADROWKA_CONTENT_ROOT
  ? resolve(process.env.KADROWKA_CONTENT_ROOT)
  : resolve(projectRoot, 'public/content')
const pagesPath = resolve(contentRoot, 'pages.json')
const sourceCandidates = [
  process.env.KADROWKA_CONTENT_FILES,
  resolve(projectRoot, '../package/content-package/files'),
  resolve(projectRoot, 'public/content/files'),
].filter(Boolean)
const filesRoot = sourceCandidates.find((candidate) => existsSync(candidate))

if (!filesRoot || !existsSync(pagesPath)) {
  console.log('Wzbogacanie SharePoint pominięte: brak rozpakowanych stron źródłowych.')
  process.exit(0)
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function slug(value) {
  return String(value ?? '')
    .replace(/\.aspx(?:[?#].*)?$/i, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l').toLocaleLowerCase('pl')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().normalize('NFC').toLocaleLowerCase('pl')
}

function extractClientContext(html) {
  const marker = "spClientSidePageContext=JSON.parse('"
  const start = html.indexOf(marker)
  if (start < 0) return null
  const valueStart = start + marker.length
  let end = valueStart
  for (; end < html.length; end += 1) {
    if (html[end] !== "'") continue
    let slashes = 0
    for (let index = end - 1; index >= valueStart && html[index] === '\\'; index -= 1) slashes += 1
    if (slashes % 2 === 0) break
  }
  if (end >= html.length) return null
  const decoded = decodeSingleQuotedJsString(html.slice(valueStart, end))
  return JSON.parse(decoded)
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1].toLowerCase() === 'x'
      return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10))
    }
    return named[entity.toLowerCase()] ?? `&${entity};`
  })
}

function contentLink(href, label = '') {
  if (!href || href.startsWith('#')) return undefined
  const decoded = decodeEntities(href).replace(/\\u002f/gi, '/')
  const pageMatch = decoded.match(/\/SitePages\/([^/?#]+)\.aspx/i)
  if (pageMatch) return { title: label, targetKind: 'page', targetId: slug(decodeURIComponent(pageMatch[1])) }
  if (decoded.startsWith('/')) return { title: label, url: `https://gkzhp.sharepoint.com${decoded}` }
  const safeUrl = safeExternalUrl(decoded)
  return safeUrl ? { title: label, url: safeUrl } : undefined
}

function richEntries(html) {
  const entries = []
  let current = null
  let bold = 0
  let italic = 0
  let underline = 0
  const links = []
  const start = (kind) => { if (current?.text.trim()) finish(); current = { kind, text: '', runs: [] } }
  const finish = () => {
    if (!current) return
    current.text = current.text.replace(/\s+/g, ' ').trim()
    current.runs = current.runs.map((run) => ({ ...run, text: run.text.replace(/\s+/g, ' ') })).filter((run) => run.text)
    if (current.text) entries.push(current)
    current = null
  }
  for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('<')) {
      const closing = /^<\//.test(token)
      const tag = token.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase() ?? ''
      if (!closing && /^(p|h[1-6]|li)$/.test(tag)) start(tag)
      if (!closing && /^(br)$/.test(tag) && current) current.text += ' '
      if (/^(strong|b)$/.test(tag)) bold += closing ? -1 : 1
      if (/^(em|i)$/.test(tag)) italic += closing ? -1 : 1
      if (tag === 'u') underline += closing ? -1 : 1
      if (tag === 'a') {
        if (closing) links.pop()
        else links.push(token.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '')
      }
      if (closing && /^(p|h[1-6]|li)$/.test(tag)) finish()
      continue
    }
    if (!current) continue
    const text = decodeEntities(token)
    if (!text) continue
    const run = { text }
    if (bold > 0) run.bold = true
    if (italic > 0) run.italic = true
    if (underline > 0) run.underline = true
    const link = contentLink(links.at(-1), text.trim())
    if (link) run.link = link
    current.text += text
    current.runs.push(run)
  }
  finish()
  return entries
}

function canvasData(html) {
  const context = extractClientContext(html)
  const raw = context?.page?.Content?.CanvasContent1
  if (!raw) return []
  return JSON.parse(raw)
}

function sourceId(page) {
  const fromUrl = String(page.sourceUrl ?? '').split('/').at(-1)
  return slug(fromUrl || page.id)
}

function updateTextBlocks(blocks, entries, used) {
  for (const block of blocks ?? []) {
    if (block.type === 'section') {
      for (const column of block.columns ?? []) updateTextBlocks(column.blocks, entries, used)
      continue
    }
    if (!['paragraph', 'heading'].includes(block.type) || !block.text) continue
    const text = normalize(block.text)
    let matchIndex = entries.findIndex((entry, index) => !used.has(index) && normalize(entry.text) === text)
    if (matchIndex < 0 && text.length > 32) {
      matchIndex = entries.findIndex((entry, index) => {
        if (used.has(index)) return false
        const candidate = normalize(entry.text)
        return candidate.length > 32 && (candidate.includes(text) || text.includes(candidate))
      })
    }
    if (matchIndex < 0) continue
    used.add(matchIndex)
    const runs = entries[matchIndex].runs
    if (runs.some((run) => run.bold || run.italic || run.underline || run.link)) block.runs = runs
  }
}

function normalizedFileName(path) {
  try { return decodeURIComponent(basename(path)).normalize('NFC').toLocaleLowerCase('pl') } catch { return basename(path).normalize('NFC').toLocaleLowerCase('pl') }
}

function updateImageBlocks(blocks, actions) {
  let changed = 0
  for (const block of blocks ?? []) {
    if (block.type === 'section') {
      for (const column of block.columns ?? []) changed += updateImageBlocks(column.blocks, actions)
      continue
    }
    if (block.type !== 'image' || !block.path) continue
    const action = actions.get(normalizedFileName(block.path))
    if (action && !block.action) { block.action = action; changed += 1 }
  }
  return changed
}

const sourceFiles = walk(filesRoot).filter((path) => extname(path).toLowerCase() === '.aspx')
const sourceMap = new Map(sourceFiles.map((path) => [slug(basename(path)), path]))
const pages = JSON.parse(readFileSync(pagesPath, 'utf8'))
let enrichedPages = 0
let richBlocks = 0
let imageActions = 0
let parseFailures = 0

for (const page of pages) {
  const source = sourceMap.get(sourceId(page)) ?? sourceMap.get(slug(page.id))
  if (!source) continue
  try {
    const controls = canvasData(readFileSync(source, 'utf8'))
    const entries = controls.filter((control) => control.controlType === 4 && control.innerHTML).flatMap((control) => richEntries(control.innerHTML))
    const actions = new Map()
    for (const control of controls) {
      const data = control.webPartData
      const imageSource = data?.serverProcessedContent?.imageSources?.imageSource
      const linkUrl = data?.properties?.linkUrl || data?.serverProcessedContent?.links?.linkUrl
      if (!imageSource || !linkUrl) continue
      actions.set(normalizedFileName(imageSource), contentLink(linkUrl, data?.properties?.captionText || 'Otwórz materiał'))
    }
    const before = JSON.stringify(page.blocks).match(/"runs":/g)?.length ?? 0
    updateTextBlocks(page.blocks, entries, new Set())
    const after = JSON.stringify(page.blocks).match(/"runs":/g)?.length ?? 0
    const imageCount = updateImageBlocks(page.blocks, actions)
    if (after > before || imageCount > 0) enrichedPages += 1
    richBlocks += after - before
    imageActions += imageCount
  } catch (error) {
    parseFailures += 1
    console.warn(`Nie udało się wzbogacić ${page.id}: ${error instanceof Error ? error.message : error}`)
  }
}

writeFileSync(pagesPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8')
console.log(`Wzbogacono ${enrichedPages} stron: ${richBlocks} bloków formatowania, ${imageActions} nowych akcji obrazów, ${parseFailures} błędów.`)
