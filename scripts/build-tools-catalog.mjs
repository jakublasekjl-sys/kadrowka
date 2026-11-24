import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = process.env.KADROWKA_CONTENT_ROOT
  ? resolve(process.env.KADROWKA_CONTENT_ROOT)
  : resolve(projectRoot, 'public/content')
const allLevels = ['GK', 'Chorągiew', 'Hufiec', 'Szczep', 'Drużyna']

function json(path) {
  return JSON.parse(readFileSync(resolve(contentRoot, path), 'utf8'))
}

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLocaleLowerCase('pl')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function key(value) {
  return normalized(value).replaceAll(' ', '')
}

function cleanToolTitle(value) {
  const title = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  if (normalized(title).includes('chceck list aspekty pzk')) return 'Checklista aspektów PzK do druku'
  return title.replace(/^Chceck list\b/i, 'Checklista')
}

function fileDuplicateKey(tool) {
  if (tool.kind !== 'file') return ''
  const extension = extname(tool.path ?? '').toLocaleLowerCase('pl')
  const title = normalized(cleanToolTitle(tool.title)).replace(/\s+\d+$/, '')
  return title && extension ? `${title}|${extension}` : ''
}

function duplicatePenalty(tool) {
  const source = `${tool.path ?? ''} ${tool.title ?? ''}`
  return /--\d+-|\(\d+\)|\s\d+\s*$/i.test(source) ? 1 : 0
}

const staticTools = [
  {
    id: 'catalog:stopnie-instruktorskie',
    title: 'Stopnie instruktorskie i praca z opiekunem próby',
    category: 'Stopnie i próby',
    audiences: ['Kadra wychowawcza'],
    usageModes: ['Indywidualnie'],
    levels: allLevels,
    targetKind: 'module',
    targetId: 'system-stopni-instruktorskich-w-zhp',
    type: 'tool',
  },
  {
    id: 'catalog:stopnie-harcerskie-wedrownicze',
    title: 'Stopnie harcerskie (wędrownicze)',
    category: 'Stopnie i próby',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca'],
    usageModes: ['Indywidualnie'],
    levels: ['Hufiec', 'Szczep', 'Drużyna'],
    url: 'https://gkzhp.sharepoint.com/:w:/r/sites/dokumentyzhp/_layouts/15/Doc.aspx?sourcedoc=%7B352E2A39-D500-4FF8-9760-0CDFEAA90E98%7D&file=zalcznik_20070612_12323_u.zal_rn_40_2003.doc&action=default&mobileredirect=true',
    type: 'tool',
  },
  {
    id: 'catalog:indywidualna-sciezka-rozwoju',
    title: 'Indywidualna Ścieżka Rozwoju',
    category: 'Przywództwo i rozwój',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca'],
    usageModes: ['Indywidualnie'],
    levels: allLevels,
    url: 'https://gkzhp.sharepoint.com/:w:/r/sites/dokumentyzhp/_layouts/15/Doc.aspx?sourcedoc=%7BF15F479F-D9FD-4745-A984-95251B5FEBFE%7D&file=u_gk_121_2020_za%C5%82%C4%85cznik_I%C5%9AR.docx&action=default&mobileredirect=true',
    type: 'tool',
  },
  {
    id: 'catalog:miana-kadry-wspierajacej',
    title: 'Miana kadry wspierającej',
    category: 'Przywództwo i rozwój',
    audiences: ['Kadra wspierająca'],
    usageModes: ['Indywidualnie'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-mianakadry',
    type: 'tool',
  },
  {
    id: 'catalog:okk',
    title: 'OKK',
    category: 'Kształcenie',
    audiences: ['Kadra wychowawcza'],
    usageModes: ['Indywidualnie'],
    levels: ['GK', 'Chorągiew', 'Hufiec', 'Szczep'],
    targetKind: 'page',
    targetId: 'system-ksztalcenia-w-zhp',
    type: 'tool',
  },
  {
    id: 'catalog:prawo-harcerskie-dla-doroslych',
    title: 'Prawo harcerskie dla dorosłych',
    category: 'Wprowadzenie do ZHP',
    audiences: ['Nowi wolontariusze', 'Mentorzy'],
    usageModes: ['Indywidualnie', 'Z mentorem'],
    levels: allLevels,
    url: 'https://gkzhp.sharepoint.com/:w:/r/sites/dokumentyzhp/_layouts/15/Doc.aspx?sourcedoc=%7B352E2A39-D500-4FF8-9760-0CDFEAA90E98%7D&file=zalcznik_20070612_12323_u.zal_rn_40_2003.doc&action=default&mobileredirect=true',
    type: 'tool',
  },
  {
    id: 'catalog:kontrakt-jak-pracujemy',
    title: 'Kontrakt „Jak pracujemy?”',
    category: 'Praca zespołu',
    audiences: ['Zespoły kadry', 'Osoby kierujące zespołami'],
    usageModes: ['Zespołowo'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'praca-z-kadra-w-zespole',
    type: 'tool',
  },
  {
    id: 'catalog:checklista-aspektow-pracy-z-kadra',
    title: 'Checklista aspektów pracy z kadrą w zespole',
    category: 'Praca zespołu',
    audiences: ['Osoby kierujące zespołami'],
    usageModes: ['Indywidualnie'],
    levels: ['GK', 'Chorągiew', 'Hufiec', 'Szczep'],
    targetKind: 'page',
    targetId: 'praca-z-kadra-w-zespole',
    type: 'tool',
  },
  {
    id: 'catalog:diagnoza-hufca',
    title: 'Diagnoza hufca',
    category: 'Diagnoza i ewaluacja',
    audiences: ['Komendy', 'Osoby kierujące zespołami'],
    usageModes: ['Indywidualnie', 'Zespołowo'],
    levels: ['Hufiec'],
    targetKind: 'page',
    targetId: 'arkusz-diagnozy-hufca',
    type: 'tool',
  },
  {
    id: 'catalog:magnolia-kultury',
    title: 'Magnolia Kultury - Rozkwit Organizacji',
    category: 'Praca zespołu',
    audiences: ['Zespoły kadry', 'Komendy'],
    usageModes: ['Zespołowo'],
    levels: ['GK', 'Chorągiew', 'Hufiec', 'Szczep'],
    targetKind: 'page',
    targetId: 'magnolia-kultury',
    type: 'tool',
  },
  {
    id: 'catalog:dziennik-nawykow',
    title: 'Dziennik nawyków',
    category: 'Przywództwo i rozwój',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca'],
    usageModes: ['Indywidualnie'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'model-przywodztwa-dziennik-nawykow',
    type: 'tool',
  },
  {
    id: 'catalog:dziennik-refleksji',
    title: 'Dziennik refleksji',
    category: 'Przywództwo i rozwój',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca'],
    usageModes: ['Indywidualnie'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'model-przywodztwa-dziennik-refleksji',
    type: 'tool',
  },
  {
    id: 'catalog:karty-doceniam',
    title: 'Karty „Doceniam”',
    category: 'Proces pracy z kadrą',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca', 'Zespoły kadry'],
    usageModes: ['Indywidualnie', 'Zespołowo'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'proces-pracy-z-kadra-3-podsumowanie-pracy',
    type: 'tool',
  },
  {
    id: 'catalog:mapowanie-postaw-pajeczynka',
    title: 'Mapowanie postaw - pajęczynka',
    category: 'Przywództwo i rozwój',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca', 'Zespoły kadry'],
    usageModes: ['Indywidualnie', 'Zespołowo'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'model-przywodztwa-pajeczynka',
    type: 'tool',
  },
  {
    id: 'catalog:poznajmy-sie-przez-postawy',
    title: 'Poznajmy się przez postawy - karty',
    category: 'Przywództwo i rozwój',
    audiences: ['Zespoły kadry'],
    usageModes: ['Zespołowo'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'model-przywodztwa-poznajmy-sie-przez-postawy',
    type: 'tool',
  },
  {
    id: 'catalog:narzedziownik-informacja-zwrotna',
    title: 'Narzędziownik „Jak skutecznie udzielać informacji zwrotnej?”',
    category: 'Proces pracy z kadrą',
    audiences: ['Kadra wychowawcza', 'Kadra wspierająca', 'Osoby kierujące zespołami', 'Mentorzy'],
    usageModes: ['Indywidualnie', 'Zespołowo'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'proces-pracy-z-kadra-3-podsumowanie-pracy-rozmowa-inf-zwrotna',
    type: 'tool',
  },
  {
    id: 'catalog:harcerskie-abc',
    title: 'Harcerskie ABC - kurs dla nowych wolontariuszy',
    category: 'Wprowadzenie do ZHP',
    audiences: ['Nowi wolontariusze', 'Mentorzy'],
    usageModes: ['Kurs / szkolenie', 'Z mentorem'],
    levels: allLevels,
    targetKind: 'page',
    targetId: 'proces-pracy-z-kadra-1-pozyskiwanie-z-zewnatrz',
    type: 'course',
  },
]

const excludedMaterialMarkers = [
  'broszur',
  'plakat',
  'ulotk',
  'czuwaj',
  'poradnik',
  'vademecum',
  'polityk',
  'harmonijka',
  'program rozwoju kultury organizacyjnej',
  'system pracy z kadra online',
]

const concreteToolMarkers = [
  'narzedz',
  'arkusz',
  'diagnoz',
  'dziennik',
  'habit tracker',
  'pajeczyn',
  'poznajmy sie',
  'karta',
  'karty',
  'check list',
  'checklista',
  'chceck list',
  'kontrakt',
  'formatka',
  'rejestr',
  'wniosek',
  'mapa mysli',
  'program proby',
  'plan wdrazania',
  'rozmowa z',
  'czy jestesmy gotowi',
  'start w harcerstwo',
  'harcerskie abc',
  'kurs',
  'formularz',
  'matryca',
  'scenariusz',
  'kwestionariusz',
  'magnolia',
]

function itemText(item) {
  return normalized([item.title, item.fileName, item.path, item.url, item.targetId].filter(Boolean).join(' '))
}

function isConcreteTool(item) {
  const text = itemText(item)
  return !excludedMaterialMarkers.some((marker) => text.includes(marker))
    && concreteToolMarkers.some((marker) => text.includes(marker))
}

function categoryFor(sourceId, item) {
  const text = itemText(item)
  if (text.includes('diagnoz')) return 'Diagnoza i ewaluacja'
  if (text.includes('stopni') || text.includes('proby')) return 'Stopnie i próby'
  if (text.includes('harcerskie abc') || text.includes('wolontariusz') || text.includes('start w harcerstwo') || text.includes('powrocie do zhp')) return 'Wprowadzenie do ZHP'
  if (text.includes('spzk')) return 'Wdrażanie SPzK'
  if (text.includes('druk domowy karty i instrukcja')) return 'Praca zespołu'
  if (sourceId.includes('model-przywodztwa') || text.includes('postaw') || text.includes('dziennik')) return 'Przywództwo i rozwój'
  if (sourceId.includes('praca-z-kadra-w-zespole') || text.includes('kontrakt') || text.includes('magnolia')) return 'Praca zespołu'
  if (sourceId.includes('proces-pracy-z-kadra')) return 'Proces pracy z kadrą'
  if (sourceId.includes('wdrazanie-spzk') || text.includes('wdrazania')) return 'Wdrażanie SPzK'
  const sourceCategory = String(item.categoryTitle ?? '')
  if (sourceCategory === 'Model przywództwa') return 'Przywództwo i rozwój'
  if (sourceCategory === 'Proces pracy z kadrą') return 'Proces pracy z kadrą'
  return 'Pozostałe narzędzia'
}

function audiencesFor(sourceId, item) {
  const text = itemText(item)
  if (text.includes('diagnoz')) return ['Komendy', 'Osoby kierujące zespołami']
  if (text.includes('wolontariusz') || text.includes('harcerskie abc') || text.includes('start w harcerstwo') || text.includes('powrocie do zhp')) return ['Nowi wolontariusze', 'Mentorzy']
  if (text.includes('druk domowy karty i instrukcja')) return ['Zespoły kadry', 'Osoby kierujące zespołami']
  if (sourceId.includes('praca-z-kadra-w-zespole') || text.includes('kontrakt') || text.includes('magnolia')) return ['Zespoły kadry', 'Osoby kierujące zespołami']
  if (sourceId.includes('proces-pracy-z-kadra')) return ['Kadra wychowawcza', 'Kadra wspierająca', 'Osoby kierujące zespołami']
  if (sourceId.includes('wdrazanie-spzk') || text.includes('wdrazania')) return ['Komendy', 'Osoby kierujące zespołami']
  return ['Kadra wychowawcza', 'Kadra wspierająca']
}

function usageModesFor(item) {
  const text = itemText(item)
  if (text.includes('kurs') || text.includes('szkolen')) return ['Kurs / szkolenie']
  if (text.includes('kontrakt') || text.includes('magnolia') || text.includes('poznajmy sie')) return ['Zespołowo']
  if (text.includes('diagnoz')) return ['Arkusz pracy', 'Zespołowo']
  if (text.includes('arkusz') || text.includes('formularz') || text.includes('formatka') || text.includes('rejestr') || text.includes('wniosek')) return ['Arkusz pracy']
  if (text.includes('karta') || text.includes('check') || text.includes('dziennik') || text.includes('tracker') || text.includes('pajeczyn')) return ['Materiał do użycia']
  return ['Indywidualnie']
}

function levelsFor(sourceId, item) {
  const text = itemText(item)
  if (text.includes('diagnoz') && text.includes('hufca')) return ['Hufiec']
  if (sourceId.includes('wdrazanie-spzk') || text.includes('wdrazania')) return ['GK', 'Chorągiew', 'Hufiec']
  return allLevels
}

function moduleFiles(modules) {
  const result = []
  for (const module of modules) {
    if (module.id === 'artykuly-z-czuwaj') continue
    for (const file of module.files ?? []) {
      if (file.type === 'image' || file.type === 'page' || !isConcreteTool(file)) continue
      const sourceId = file.sourceModuleId ?? module.id
      result.push({
        ...file,
        id: `file:${file.id ?? key(file.path || file.url || file.title)}`,
        category: categoryFor(sourceId, file),
        audiences: audiencesFor(sourceId, file),
        usageModes: usageModesFor(file),
        levels: levelsFor(sourceId, file),
        sourceModuleId: sourceId,
        sourceModuleTitle: file.sourceModuleTitle ?? module.title,
        kind: 'file',
      })
    }
  }
  return result
}

function linkedTools(pages, modules) {
  const result = []
  const filesById = new Map(modules.flatMap((module) => module.files ?? []).filter((file) => file.id).map((file) => [file.id, file]))
  const staticPageTargets = new Set(staticTools.filter((tool) => tool.targetKind === 'page').map((tool) => tool.targetId))
  const broadPageTargets = new Set(['model-przywodztwa', 'proces-pracy-z-kadra', 'praca-z-kadra-w-zespole', 'ewaluacja', 'mapa-strony'])
  const collect = (page, block) => {
    if (block.type === 'section') {
      for (const column of block.columns ?? []) for (const child of column.blocks ?? []) collect(page, child)
      return
    }
    const candidates = block.type === 'links'
      ? block.items ?? []
      : block.type === 'image' && block.action
        ? [block.action]
        : []
    for (const candidate of candidates) {
      if (!candidate || typeof candidate === 'string' || !isConcreteTool(candidate)) continue
      if (!candidate.path && !candidate.url && !(candidate.targetKind && candidate.targetId)) continue
      const title = String(candidate.title || '').trim()
      if (!title || normalized(title) === 'otworz material') continue
      if (candidate.targetKind === 'page' && (staticPageTargets.has(candidate.targetId) || broadPageTargets.has(candidate.targetId))) continue
      const resolvedFile = candidate.targetKind === 'file' ? filesById.get(candidate.targetId) : undefined
      const resolved = resolvedFile ? { ...resolvedFile, ...candidate, path: candidate.path ?? resolvedFile.path, url: candidate.url ?? resolvedFile.url } : candidate
      result.push({
        ...resolved,
        id: `page-link:${page.id}:${key(`${title}|${resolved.path ?? resolved.url ?? resolved.targetId ?? ''}`)}`,
        title,
        category: categoryFor(page.id, resolved),
        audiences: audiencesFor(page.id, resolved),
        usageModes: usageModesFor(resolved),
        levels: levelsFor(page.id, resolved),
        sourceModuleId: page.moduleId,
        sourceModuleTitle: page.title,
        type: resolved.type || (resolved.url && /edu\.zhp\.pl/i.test(resolved.url) ? 'course' : 'tool'),
        kind: 'page-link',
      })
    }
  }
  for (const page of pages) for (const block of page.blocks ?? []) collect(page, block)
  return result
}

function analysisTools(analyses) {
  return analyses.map((analysis) => ({
    id: `analysis:${analysis.id}`,
    title: analysis.title,
    description: analysis.description,
    category: 'Analizy planistyczne',
    audiences: ['Kadra planująca'],
    usageModes: ['Planowanie'],
    levels: allLevels,
    targetKind: 'planning',
    targetId: analysis.id,
    type: 'analysis',
    kind: 'analysis',
  }))
}

function targetKey(tool) {
  if (!tool.kind) return key(tool.id)
  if (tool.path) return `path:${key(tool.path.normalize('NFC'))}`
  if (tool.url) return `url:${key(tool.url)}`
  if (tool.targetKind && tool.targetId) return `target:${key(`${tool.targetKind}:${tool.targetId}`)}`
  return key(tool.id)
}

const modules = json('modules.json')
const pages = json('pages.json')
const analyses = json('planning/analysis-tools.json')
const candidates = [
  ...staticTools,
  ...analysisTools(analyses),
  ...moduleFiles(modules),
  ...linkedTools(pages, modules),
].map((tool) => ({ ...tool, title: cleanToolTitle(tool.title) }))

const preferredFiles = new Map()
for (const tool of candidates) {
  const duplicateKey = fileDuplicateKey(tool)
  if (!duplicateKey) continue
  const preferred = preferredFiles.get(duplicateKey)
  if (!preferred || duplicatePenalty(tool) < duplicatePenalty(preferred)) preferredFiles.set(duplicateKey, tool)
}

const seen = new Set()
const catalog = candidates
  .filter((tool) => {
    const duplicateKey = fileDuplicateKey(tool)
    if (duplicateKey && preferredFiles.get(duplicateKey) !== tool) return false
    const target = targetKey(tool)
    if (!target || seen.has(target)) return false
    seen.add(target)
    return true
  })
  .map((tool) => ({
    ...tool,
    kind: tool.kind ?? 'static',
    favoriteId: tool.kind === 'file' ? undefined : `id:${tool.id}`,
    audience: tool.audiences.join(', '),
    mode: tool.usageModes.join(', '),
    level: tool.levels.join(', '),
  }))
  .sort((left, right) => left.category.localeCompare(right.category, 'pl') || left.title.localeCompare(right.title, 'pl'))

writeFileSync(resolve(contentRoot, 'tools-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

const sourceCounts = Object.groupBy(catalog, (tool) => tool.kind ?? 'static')
const summary = Object.fromEntries(Object.entries(sourceCounts).map(([source, tools]) => [source, tools.length]))
const fileTypes = Object.groupBy(catalog.filter((tool) => tool.kind === 'file'), (tool) => extname(tool.path ?? '').slice(1) || tool.type || 'link')
console.log(`Katalog narzędzi: ${catalog.length} pozycji; źródła: ${JSON.stringify(summary)}; pliki: ${JSON.stringify(Object.fromEntries(Object.entries(fileTypes).map(([type, tools]) => [type, tools.length])))}.`)
