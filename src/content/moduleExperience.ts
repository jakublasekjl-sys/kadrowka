import type { ContentBlock, ContentBundle, ContentLink, ContentPage } from '../types/content'
import { normalizeText } from '../utils/content'

export interface ProcessGroup {
  label: string
  title: string
  parentId: string
  childIds: string[]
}

export const processGroups: ProcessGroup[] = [
  {
    label: 'Pozyskiwanie', title: 'Pozyskiwanie', parentId: 'proces-pracy-z-kadra-1-pozyskiwanie',
    childIds: ['proces-pracy-z-kadra-1-pozyskiwanie-z-zewnatrz','proces-pracy-z-kadra-1-pozyskiwanie-z-wewnatrz','proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-do-pelnienia-roli','proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-funkcja-do-zespolu','proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-nastepca','proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-nowa-funkcja'],
  },
  {
    label: 'Rozwój przez działanie', title: 'Rozwój przez działanie', parentId: 'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie',
    childIds: ['proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-inf-zwrotna','proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-kodeksinstruktorski-zobowiazanieinstruktorskie','proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-ksiazki-media','proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-mianakadry','proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-opis-funkcji','proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-prawoiprzyrzeczenie','proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-wsp-mentor'],
  },
  {
    label: 'Podsumowanie', title: 'Podsumowanie pracy', parentId: 'proces-pracy-z-kadra-3-podsumowanie-pracy',
    childIds: ['proces-pracy-z-kadra-3-podsumowanie-pracy-analiza-realizowanych-dzialan','proces-pracy-z-kadra-3-podsumowanie-pracy-docenianie-podziekowanie','proces-pracy-z-kadra-3-podsumowanie-pracy-podsumowanie-pracy','proces-pracy-z-kadra-3-podsumowanie-pracy-rozmowa-inf-zwrotna','proces-pracy-z-kadra-3-podsumowanie-pracy-samoocena-refl','proces-pracy-z-kadra-3-podsumowanie-pracy-wielostronna-inf-zwr','proces-pracy-z-kadra-3-podsumowanie-pracy-wyznaczanie-dalszego-rozwoju'],
  },
  { label: 'Motywowanie', title: 'Motywowanie', parentId: 'proces-pracy-z-kadra-4-motywowanie', childIds: [] },
]

export const teamAreaTitles: Record<string, string> = {
  'praca-z-kadra-w-zespole-misjaiwartosci': 'Misja i wartości',
  'praca-z-kadra-w-zespole-wyznaczaniecelow': 'Wyznaczanie celów',
  'praca-z-kadra-w-zespole-rozwojosobisty': 'Rozwój osobisty',
  'praca-z-kadra-w-zespole-spotkania': 'Spotkania',
  'praca-z-kadra-w-zespole-komunikacja': 'Komunikacja',
  'praca-z-kadra-w-zespole-transparentnosc': 'Transparentność',
  'praca-z-kadra-w-zespole-dzieleniesieodpowiedzialnoscia': 'Dzielenie się odpowiedzialnością i zadaniami',
  'praca-z-kadra-w-zespole-podejmowaniedecyzji': 'Podejmowanie decyzji',
  'praca-z-kadra-w-zespole-pracazkonfliktem': 'Praca z konfliktem',
  'praca-z-kadra-w-zespole-wspieraniewdzialaniu': 'Wspieranie w działaniu',
  'praca-z-kadra-w-zespole-wdziecznoscidocenianie': 'Wdzięczność i docenianie',
  'praca-z-kadra-w-zespole-podsumowanie': 'Podsumowanie',
}

export const processTitles: Record<string, string> = {
  'proces-pracy-z-kadra-1-pozyskiwanie': 'Pozyskiwanie',
  'proces-pracy-z-kadra-1-pozyskiwanie-z-zewnatrz': 'Pozyskiwanie z zewnątrz',
  'proces-pracy-z-kadra-1-pozyskiwanie-z-wewnatrz': 'Pozyskiwanie z wewnątrz',
  'proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-do-pelnienia-roli': 'Pozyskiwanie do pełnienia roli',
  'proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-funkcja-do-zespolu': 'Pozyskiwanie do funkcji w zespole',
  'proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-nastepca': 'Przygotowanie następcy',
  'proces-pracy-z-kadra-1-pozyskiwanie-wewnatrz-nowa-funkcja': 'Nowa funkcja',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie': 'Rozwój przez działanie',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-inf-zwrotna': 'Informacja zwrotna',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-kodeksinstruktorski-zobowiazanieinstruktorskie': 'Kodeks instruktorski i zobowiązanie',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-ksiazki-media': 'Książki i media',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-mianakadry': 'Miana kadry',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-opis-funkcji': 'Opis funkcji i zakres obowiązków',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-prawoiprzyrzeczenie': 'Prawo i Przyrzeczenie Harcerskie',
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-wsp-mentor': 'Wsparcie i mentoring',
  'proces-pracy-z-kadra-3-podsumowanie-pracy': 'Podsumowanie pracy',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-analiza-realizowanych-dzialan': 'Analiza realizowanych działań',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-docenianie-podziekowanie': 'Docenianie i podziękowanie',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-podsumowanie-pracy': 'Rozmowa podsumowująca',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-rozmowa-inf-zwrotna': 'Rozmowa i informacja zwrotna',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-samoocena-refl': 'Samoocena i refleksja',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-wielostronna-inf-zwr': 'Wielostronna informacja zwrotna',
  'proces-pracy-z-kadra-3-podsumowanie-pracy-wyznaczanie-dalszego-rozwoju': 'Wyznaczanie dalszego rozwoju',
  'proces-pracy-z-kadra-4-motywowanie': 'Motywowanie',
}

export const contentAliases: Record<string, string> = {
  'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-inf-zwrotna': 'proces-pracy-z-kadra-3-podsumowanie-pracy-rozmowa-inf-zwrotna',
  'wydzielona-strona-ssi': 'system-stopni-instruktorskich-w-zhp',
}

function blockText(block: ContentBlock): string {
  if (block.type === 'paragraph' || block.type === 'heading') return block.text ?? ''
  if (block.type === 'list') return (block.items ?? []).map((item) => typeof item === 'string' ? item : item.title).join(' ')
  if (block.type === 'links') return (block.items ?? []).map((item) => typeof item === 'string' ? item : item.title).join(' ')
  if (block.type === 'section') return (block.columns ?? []).flatMap((column) => column.blocks ?? []).map(blockText).join(' ')
  return ''
}

function hasNavigationLinks(block: ContentBlock) {
  const keys = new Set(['modelprzywodztwa','procespracyzkadra','pracazkadrawzespole','ewaluacja'])
  if (block.type === 'links') {
    const titles = (block.items ?? []).filter((item): item is ContentLink => typeof item !== 'string').map((item) => normalizeText(item.title).replaceAll(' ', ''))
    return titles.length > 0 && titles.every((title) => keys.has(title))
  }
  return block.type === 'section' && (block.columns ?? []).some((column) => (column.blocks ?? []).some(hasNavigationLinks))
}

function withoutNavigation(block: ContentBlock): ContentBlock | null {
  if (hasNavigationLinks(block) && block.type === 'links') return null
  if (block.type !== 'section') return block
  const columns = (block.columns ?? []).map((column) => ({ ...column, blocks: (column.blocks ?? []).map(withoutNavigation).filter(Boolean) as ContentBlock[] })).filter((column) => column.blocks.length)
  return columns.length ? { ...block, columns } : null
}

export function readingBlocks(page: ContentPage): ContentBlock[] {
  const blocks = page.blocks ?? []
  if (page.id === 'proces-pracy-z-kadra') return blocks.slice(2, 4)
  if (page.id === 'praca-z-kadra-w-zespole') return [blocks[2], blocks[3], blocks[12]].filter(Boolean)
  if (page.id === 'ewaluacja') return blocks.slice(2, 5)
  if (page.id !== 'model-przywodztwa') {
    const output: ContentBlock[] = []
    for (const block of blocks) {
      const text = normalizeText(blockText(block))
      if (block.type === 'heading' && /dokumenty i materialy|artykuly z/.test(text)) break
      if (!output.length && block.type === 'image' && /972444126|1768063553/.test(block.path ?? '')) continue
      const cleaned = withoutNavigation(block)
      if (cleaned) output.push(cleaned)
    }
    return output
  }

  const output: ContentBlock[] = []
  let started = false
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]
    const text = normalizeText(blockText(block)).replaceAll(' ', '')
    if (text.includes('ponizejprzedstawiamynarzedziaorazmaterialy') || text.includes('tutajprzeczytaszartykuly') || text.includes('dokumentyimaterialydotyczacesystemupracyzkadrawzhp')) break
    if (!started && block.type === 'image') continue
    if (text.includes('zastanawiasienadswoimpostepowaniem') || text.includes('pierwszymkrokiemwrozwoju') || text.includes('kadralaczyrozneperspektywy') || text.includes('bycieliderkailideremwspolpracujacym')) continue
    const cleaned = withoutNavigation(block)
    if (!cleaned) continue
    if (!started && cleaned.type === 'image') continue
    if (blockIndex === 6 && cleaned.type === 'section') {
      const behaviorItems = cleaned.columns?.[0]?.blocks?.filter((item) => item.type === 'paragraph').slice(1).map((item) => item.text ?? '').filter(Boolean) ?? []
      output.push({ type:'section', columns:[{ blocks:[{type:'heading',level:3,text:'Kadra:'},{type:'list',items:behaviorItems}] }, ...(cleaned.columns?.slice(1) ?? [])] })
    } else if (blockIndex === 12 && cleaned.type === 'section') {
      const beliefItems = (cleaned.columns ?? []).flatMap((column) => column.blocks ?? []).filter((item) => item.type === 'paragraph').map((item) => item.text ?? '').filter(Boolean)
      output.push({ type:'heading',level:3,text:'Wierzymy, że:' }, { type:'list',items:beliefItems })
    } else {
      output.push(cleaned)
    }
    started = true
  }
  return output
}

export function collectMaterials(content: ContentBundle, page: ContentPage) {
  const links: ContentLink[] = []
  const collect = (block: ContentBlock) => {
    if (block.type === 'links') links.push(...(block.items ?? []).filter((item): item is ContentLink => typeof item !== 'string'))
    if (block.type === 'section') (block.columns ?? []).forEach((column) => (column.blocks ?? []).forEach(collect))
  }
  ;(page.blocks ?? []).forEach(collect)
  const module = content.modules.find((item) => item.id === page.moduleId)
  links.push(...(module?.files ?? []).filter((file) => !['image','page'].includes(file.type ?? '')))
  const seen = new Set<string>()
  return links.filter((item) => {
    const target = `${item.targetKind}|${item.targetId}|${item.path}|${item.url}|${item.title}`
    const material = !!(item.path || item.url || item.targetKind === 'file') && !['page','module'].includes(item.targetKind ?? '')
    return material && !seen.has(target) && !!seen.add(target)
  })
}

export function relatedLinks(pageId: string): ContentLink[] {
  if (pageId === 'model-przywodztwa') return [{ title:'Proces pracy z kadrą',targetKind:'page',targetId:'proces-pracy-z-kadra'},{title:'Praca z kadrą w zespole',targetKind:'page',targetId:'praca-z-kadra-w-zespole'},{title:'Ewaluacja',targetKind:'page',targetId:'ewaluacja'}]
  if (pageId.startsWith('proces-pracy-z-kadra')) return [{title:'Model przywództwa',targetKind:'page',targetId:'model-przywodztwa'},{title:'Praca z kadrą w zespole',targetKind:'page',targetId:'praca-z-kadra-w-zespole'},{title:'Ewaluacja',targetKind:'page',targetId:'ewaluacja'}]
  if (pageId === 'praca-z-kadra-w-zespole') return [{title:'Kultura Organizacyjna',url:'https://gkzhp.sharepoint.com/sites/KulturaOrganizacyjna'},{title:'Proces pracy z kadrą',targetKind:'page',targetId:'proces-pracy-z-kadra'},{title:'Model przywództwa',targetKind:'page',targetId:'model-przywodztwa'},{title:'Ewaluacja',targetKind:'page',targetId:'ewaluacja'}]
  if (pageId === 'ewaluacja') return [{title:'Proces pracy z kadrą',targetKind:'page',targetId:'proces-pracy-z-kadra'},{title:'Praca z kadrą w zespole',targetKind:'page',targetId:'praca-z-kadra-w-zespole'},{title:'Model przywództwa',targetKind:'page',targetId:'model-przywodztwa'}]
  return []
}

export function resolvedPage(content: ContentBundle, pageId: string) {
  return content.pages.find((page) => page.id === (contentAliases[pageId] ?? pageId))
}
