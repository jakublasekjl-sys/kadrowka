import { Award, BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Compass, FolderOpen, Heart, Network, NotebookPen, PlayCircle, Route, TrendingUp, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BlockRenderer } from './BlockRenderer'
import { ContentLinkButton } from './ContentLink'
import { OfflineModuleDownload } from './OfflineModuleDownload'
import { myWorkKeys, saveJson, savePageNote, useJsonPreference } from '../db/myWork'
import type { ContentBlock, ContentBundle, ContentLink, ContentPage } from '../types/content'
import { collectMaterials, processGroups, processTitles, readingBlocks, relatedLinks, resolvedPage, teamAreaTitles } from '../content/moduleExperience'

export interface ExperienceTab { id: string; label: string; icon: ReactNode; content: ReactNode }

function cleanLearningBlocks(page: ContentPage) {
  return readingBlocks(page)
}

const implementationPageIds = [
  'wdrazanie-spzk-w-zhp-2',
  'plakaty-o-spzk',
  'wydzielona-strona-plakaty-o-spzk',
  'wydzielona-strona-mapa-mysli',
] as const

function ImplementationPages({ content }: { content: ContentBundle }) {
  const pages = implementationPageIds.map((id) => resolvedPage(content, id)).filter(Boolean) as ContentPage[]
  return <div className="learning-list">{pages.map((page, index) => <LearningAccordion page={page} title={page.title.replace(/^Wydzielona strona\s*/i, '')} initiallyOpen={index === 0} key={page.id} />)}</div>
}

function BlockAccordion({ title, blocks, open = false }: { title: string; blocks: ContentBlock[]; open?: boolean }) {
  return <details className="learning-accordion" open={open}><summary><span>{title}</span></summary><div className="learning-content"><BlockRenderer blocks={blocks} /></div></details>
}

function ImplementationRead({ page }: { page: ContentPage }) {
  const blocks = readingBlocks(page)
  return <div className="page-stack tight">
    <BlockRenderer blocks={blocks.slice(0, 7)} />
    <div className="learning-list">
      <BlockAccordion title="I etap wdrażania" blocks={blocks.slice(7, 9)} open />
      <BlockAccordion title="II etap wdrażania" blocks={blocks.slice(9, 11)} />
      <BlockAccordion title="III etap wdrażania" blocks={blocks.slice(11, 13)} />
      <BlockAccordion title="IV etap wdrażania" blocks={blocks.slice(13, 16)} />
      <BlockAccordion title="Kluczowe formy kształcenia" blocks={blocks.slice(16, 19)} />
      <BlockAccordion title="Warsztat kadra+" blocks={blocks.slice(19, 26)} />
      <BlockAccordion title="Train the Trainers" blocks={blocks.slice(26)} />
    </div>
  </div>
}

function LearningAccordion({ page, title, initiallyOpen = false }: { page: ContentPage; title: string; initiallyOpen?: boolean }) {
  return <details className="learning-accordion" open={initiallyOpen}>
    <summary><span>{title}</span><small>{page.summary}</small></summary>
    <div className="learning-content"><BlockRenderer blocks={cleanLearningBlocks(page)} /><Link className="secondary-action" to={`/page/${page.id}`}>Otwórz podstronę osobno</Link></div>
  </details>
}

function TeamAreas({ content }: { content: ContentBundle }) {
  const pages = Object.keys(teamAreaTitles).map((id) => resolvedPage(content, id)).filter(Boolean) as ContentPage[]
  return <div className="learning-list">{pages.map((page, index) => <LearningAccordion page={page} title={teamAreaTitles[page.id]} initiallyOpen={index === 0} key={page.id} />)}</div>
}

function ProcessStage({ content, groupIndex }: { content: ContentBundle; groupIndex: number }) {
  const group = processGroups[groupIndex]
  const pages = [group.parentId, ...group.childIds].map((id) => resolvedPage(content, id)).filter(Boolean) as ContentPage[]
  return <div className="learning-list">{pages.map((page, index) => <LearningAccordion page={page} title={index === 0 ? group.title : processTitles[page.id] ?? page.title} initiallyOpen={index === 0} key={page.id} />)}</div>
}

const postureSpecs = [
  ['Postawa refleksyjna', 7, 8, 0],
  ['Postawa kreatywnego i krytycznego myślenia', 7, 8, 1],
  ['Postawa równości', 7, 8, 2],
  ['Postawa współpracy', 9, 10, 0],
  ['Postawa otwartości na świat', 9, 10, 1],
  ['Postawa odpowiedzialności w działaniu', 9, 10, 2],
] as const

function columnBlocks(page: ContentPage, blockIndex: number, columnIndex: number) {
  return page.blocks?.[blockIndex]?.columns?.[columnIndex]?.blocks ?? []
}

function LeadershipPostures({ page }: { page: ContentPage }) {
  return <div className="learning-list">{postureSpecs.map(([title, overview, detail, column], index) => {
    const blocks: ContentBlock[] = [...columnBlocks(page, overview, column), ...columnBlocks(page, detail, column)]
    return <details className="learning-accordion" open={index === 0} key={title}><summary><span>{title}</span></summary><div className="learning-content"><BlockRenderer blocks={blocks} /></div></details>
  })}</div>
}

function ReadingSection({ title, blocks, open = false }: { title: string; blocks: ContentBlock[]; open?: boolean }) {
  const normalizedTitle = title.toLocaleLowerCase('pl').replace(/[^a-ząćęłńóśźż0-9]+/g, '')
  const first = blocks[0]
  const firstTitle = first?.type === 'heading' ? (first.text ?? '').toLocaleLowerCase('pl').replace(/[^a-ząćęłńóśźż0-9]+/g, '') : ''
  const content = firstTitle === normalizedTitle ? blocks.slice(1) : blocks
  return <details className="reading-section" open={open}>
    <summary><h2>{title}</h2><ChevronDown aria-hidden="true" /></summary>
    <div className="reading-section-content"><BlockRenderer blocks={content} /></div>
  </details>
}

function ModuleReading({ page }: { page: ContentPage }) {
  const blocks = readingBlocks(page)
  if (page.id !== 'model-przywodztwa' || blocks.length < 7) return <div className="module-reading"><BlockRenderer blocks={blocks} /></div>
  return <div className="module-reading">
    <BlockRenderer blocks={blocks.slice(0, 2)} />
    <div className="reading-section-list">
      <ReadingSection title="Skąd pochodzi Model przywództwa?" blocks={blocks.slice(2, 3)} open />
      <ReadingSection title="Przywództwo w praktyce" blocks={blocks.slice(3, 5)} />
      <ReadingSection title="Model praktyki" blocks={blocks.slice(5, 6)} />
      <ReadingSection title="Wierzymy, że" blocks={blocks.slice(6)} />
    </div>
  </div>
}

const quickQuestions: Record<string, string[]> = {
  'model-przywodztwa': ['Która postawa jest dziś najmocniej widoczna w mojej pracy?','Które zachowanie chcę ćwiczyć przez najbliższy tydzień?','Jaką jedną praktykę warto omówić z zespołem kadry?'],
  'proces-pracy-z-kadra': ['Z którą osobą z kadry powinienem/powinnam teraz świadomie pracować?','Na jakim etapie procesu jest ta osoba?','Jaki najbliższy krok rozwojowy ma konkretny termin i osobę wspierającą?'],
  'praca-z-kadra-w-zespole': ['Która praktyka zespołu najbardziej pomaga nam działać?','Co dziś tworzy najwięcej chaosu: role, decyzje, komunikacja czy odpowiedzialność?','Jaką jedną zasadę pracy sprawdzimy przez dwa tygodnie?'],
  ewaluacja: ['Co chcemy sprawdzić przed działaniem, a nie dopiero po fakcie?','Kogo trzeba zapytać, żeby wnioski nie były jednostronne?','Który wniosek musi trafić do kolejnego planu?'],
}

function ApplyPanel({ page }: { page: ContentPage }) {
  const notesRaw = useJsonPreference<Record<string, string>>(myWorkKeys.notes, {})
  const typesRaw = useJsonPreference<Record<string, string>>(myWorkKeys.noteTypes, {})
  const notes = notesRaw ?? {}
  const types = typesRaw ?? {}
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState('Pozostała notatka')
  const [saved, setSaved] = useState(false)
  const savedNote = notes[page.id] ?? ''
  const savedType = types[page.id] ?? 'Pozostała notatka'
  useEffect(() => { setNote(savedNote); setNoteType(savedType) }, [savedNote, savedType])
  const questions = quickQuestions[page.id] ?? ['Do jakiej decyzji, rozmowy albo planu potrzebuję tej strony?','Który fragment warto pokazać zespołowi?','Jaki jeden wniosek zapisuję do dalszej pracy?']
  async function save() { await savePageNote(page.id, note, noteType, page.title); setSaved(true); window.setTimeout(() => setSaved(false), 1600) }
  return <div className="apply-layout"><section className="application-card"><h2>Pytania do zastosowania</h2><ul>{questions.map((question) => <li key={question}>{question}</li>)}</ul></section><section className="note-panel"><div className="note-heading"><NotebookPen aria-hidden="true" /><h2>Moja notatka</h2></div><div className="segmented-control">{['Pozostała notatka','Wniosek do planu'].map((type) => <button type="button" className={noteType === type ? 'active' : ''} onClick={() => setNoteType(type)} key={type}>{type}</button>)}</div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Wpisz wniosek, pytanie lub decyzję do dalszej pracy" rows={6}/><button className="secondary-action" type="button" onClick={() => void save()}>{saved ? <Check aria-hidden="true" /> : <NotebookPen aria-hidden="true" />}{saved ? 'Zapisano' : 'Zapisz notatkę'}</button></section></div>
}

function MaterialsPanel({ content, links, page }: { content: ContentBundle; links: ContentLink[]; page: ContentPage }) {
  const linkedPaths = new Set(links.map((item) => item.path).filter((path): path is string => Boolean(path)))
  const moduleIds = new Set([page.id, page.moduleId].filter((id): id is string => Boolean(id)))
  const assets = content.assets.filter((asset) => linkedPaths.has(asset.path)
    || Boolean(asset.moduleId && moduleIds.has(asset.moduleId))
    || Boolean(asset.moduleIds?.some((moduleId) => moduleIds.has(moduleId))))
  const moduleTitle = content.modules.find((module) => moduleIds.has(module.id))?.title ?? page.title
  return <div className="page-stack tight">
    <OfflineModuleDownload assets={assets} moduleTitle={moduleTitle} contentVersion={content.materialCatalog.releaseId} />
    <div className="content-links material-list">{links.map((item, index) => <ContentLinkButton item={item} key={`${item.targetId ?? item.path ?? item.url}-${index}`} />)}</div>
  </div>
}

function RelatedPanel({ links }: { links: ContentLink[] }) {
  return <div className="related-grid">{links.map((item, index) => <ContentLinkButton item={item} key={item.targetId ?? index} />)}</div>
}

function SsiPages({ content, currentId }: { content: ContentBundle; currentId: string }) {
  const pages = content.pages.filter((page) => page.id === 'system-stopni-instruktorskich-w-zhp' || page.id.startsWith('ssi-'))
  return <div className="learning-list">{pages.filter((page) => page.id !== currentId).map((page) => <Link className="list-row compact" to={`/page/${page.id}`} key={page.id}><div><h3>{page.title}</h3>{page.summary && <p>{page.summary}</p>}</div></Link>)}</div>
}

function extractRequirements(page: ContentPage) {
  const items: Array<{ id: string; title: string }> = []
  let inRequirements = false
  for (const block of page.blocks ?? []) {
    if (block.type !== 'heading') continue
    const level = Number(block.level ?? 0)
    const title = block.text?.trim() ?? ''
    if (level <= 3) {
      if (title.toLocaleLowerCase('pl') === 'wymagania') { inRequirements = true; continue }
      if (inRequirements) break
    }
    if (inRequirements && level >= 4 && title) {
      const index = items.length + 1
      const key = title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/gi,'l').toLocaleLowerCase('pl').replace(/[^a-z0-9]+/g,'')
      items.push({ id:`${page.id}:${index}:${key}`, title })
    }
  }
  return items
}

function SsiDegrees({ content }: { content: ContentBundle }) {
  const degrees = [['ssi-przewodniczka-przewodnik','Przewodniczka / przewodnik'],['ssi-podharcmistrzyni-podharcmistrz','Podharcmistrzyni / podharcmistrz'],['ssi-harcmistrzyni-harcmistrz','Harcmistrzyni / harcmistrz']] as const
  const completed = useJsonPreference<string[]>(myWorkKeys.ssiChecks, []) ?? []
  const selected = new Set(completed)
  async function toggle(id: string) { if (selected.has(id)) selected.delete(id); else selected.add(id); await saveJson(myWorkKeys.ssiChecks, [...selected]) }
  async function clear(requirements:Array<{id:string}>){const ids=new Set(requirements.map((item)=>item.id));await saveJson(myWorkKeys.ssiChecks,completed.filter((id)=>!ids.has(id)))}
  return <div className="learning-list">{degrees.map(([id,title], degreeIndex) => { const page = resolvedPage(content,id); if (!page) return null; const requirements=extractRequirements(page); const done=requirements.filter((item)=>selected.has(item.id)).length; return <details className="learning-accordion" open={degreeIndex===0} key={id}><summary><span>{title}</span><small>{done} z {requirements.length} wymagań</small></summary><div className="requirement-list">{requirements.map((requirement)=> <label key={requirement.id}><input type="checkbox" checked={selected.has(requirement.id)} onChange={()=>void toggle(requirement.id)}/><span>{requirement.title}</span></label>)}{done>0&&<button className="text-button danger" type="button" onClick={()=>void clear(requirements)}>Wyczyść zaznaczenia</button>}</div></details> })}</div>
}

export function buildExperienceTabs(content: ContentBundle, page: ContentPage): ExperienceTab[] {
  const materials = collectMaterials(content, page)
  const related = relatedLinks(page.id)
  const isSsi = page.id === 'system-stopni-instruktorskich-w-zhp' || page.id.startsWith('ssi-')
  const tabs: ExperienceTab[] = []
  if (page.id !== 'system-stopni-instruktorskich-w-zhp') tabs.push({ id:'read',label:'Czytaj',icon:<BookOpen aria-hidden="true"/>,content:page.id === 'wdrazanie-systemu-pracy-z-kadra-w-zhp' ? <ImplementationRead page={page}/> : <ModuleReading page={page}/> })
  if (page.id === 'model-przywodztwa') tabs.push({id:'postures',label:'Postawy',icon:<Compass aria-hidden="true"/>,content:<LeadershipPostures page={page}/>})
  if (page.id === 'praca-z-kadra-w-zespole') tabs.push({id:'areas',label:'Obszary',icon:<Network aria-hidden="true"/>,content:<TeamAreas content={content}/>})
  if (page.id === 'proces-pracy-z-kadra') processGroups.forEach((group,index)=>tabs.push({id:`process-${index}`,label:group.label,icon:index===0?<UserPlus aria-hidden="true"/>:index===1?<TrendingUp aria-hidden="true"/>:index===2?<CheckCircle2 aria-hidden="true"/>:<Heart aria-hidden="true"/>,content:<ProcessStage content={content} groupIndex={index}/> }))
  if (page.id === 'wdrazanie-systemu-pracy-z-kadra-w-zhp') tabs.push({id:'implementation-pages',label:'Podstrony',icon:<Network aria-hidden="true"/>,content:<ImplementationPages content={content}/>})
  if (isSsi) { tabs.push({id:'ssi-pages',label:page.id === 'system-stopni-instruktorskich-w-zhp'?'Czytaj':'Strony',icon:<BookOpen aria-hidden="true"/>,content:<SsiPages content={content} currentId={page.id}/>}); tabs.push({id:'ssi-degrees',label:'Stopnie',icon:<Award aria-hidden="true"/>,content:<SsiDegrees content={content}/>}) }
  tabs.push({id:'apply',label:'Zastosuj',icon:<PlayCircle aria-hidden="true"/>,content:<ApplyPanel page={page}/>})
  if (materials.length) tabs.push({id:'materials',label:'Materiały',icon:<FolderOpen aria-hidden="true"/>,content:<MaterialsPanel content={content} links={materials} page={page}/>})
  if (related.length) tabs.push({id:'related',label:'Powiązane',icon:<Route aria-hidden="true"/>,content:<RelatedPanel links={related}/>})
  return tabs
}

export function ExperienceTabs({ tabs }: { tabs: ExperienceTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false })
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabButtons = useRef<Record<string, HTMLButtonElement | null>>({})
  const previousActive = useRef(active)
  useEffect(() => { if (!tabs.some((tab) => tab.id === active)) setActive(tabs[0]?.id ?? '') }, [active, tabs])
  useEffect(() => {
    const element = tabsRef.current
    if (!element) return
    const updateEdges = () => setScrollEdges({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    })
    updateEdges()
    element.addEventListener('scroll', updateEdges, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges)
    observer?.observe(element)
    window.addEventListener('resize', updateEdges)
    return () => {
      element.removeEventListener('scroll', updateEdges)
      observer?.disconnect()
      window.removeEventListener('resize', updateEdges)
    }
  }, [tabs])
  useEffect(() => {
    if (previousActive.current === active) return
    previousActive.current = active
    tabButtons.current[active]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [active])
  const current = useMemo(() => tabs.find((tab) => tab.id === active) ?? tabs[0], [active, tabs])
  function scrollTabs(direction: -1 | 1) { tabsRef.current?.scrollBy({ left: direction * Math.max(180, tabsRef.current.clientWidth * .65), behavior: 'smooth' }) }
  return <><div className={`experience-tabs-shell ${scrollEdges.left ? 'can-scroll-left' : ''} ${scrollEdges.right ? 'can-scroll-right' : ''}`}>
    {scrollEdges.left && <button className="tab-scroll-button previous" type="button" onClick={() => scrollTabs(-1)} aria-label="Poprzednie zakładki"><ChevronLeft aria-hidden="true" /></button>}
    <div className="experience-tabs" role="tablist" ref={tabsRef}>{tabs.map((tab)=><button ref={(element) => { tabButtons.current[tab.id] = element }} role="tab" aria-selected={active===tab.id} className={active===tab.id?'active':''} type="button" onClick={()=>setActive(tab.id)} key={tab.id}>{tab.icon}<span>{tab.label}</span></button>)}</div>
    {scrollEdges.right && <button className="tab-scroll-button next" type="button" onClick={() => scrollTabs(1)} aria-label="Następne zakładki"><ChevronRight aria-hidden="true" /></button>}
  </div><section className="experience-panel" role="tabpanel" key={current?.id}>{current?.id !== 'read' && <div className="experience-heading"><span>{current?.icon}</span><h2>{current?.label}</h2></div>}{current?.content}</section></>
}
