import type { ContentBundle, PlanningAnalysisTool, PlanningQuestion } from '../types/content'

export type PlanningProfile = 'gromada' | 'druzyna' | 'zespol_kadry' | 'haliz'
export type PlanningFieldKind = 'info' | 'text' | 'question' | 'aspect' | 'analysisSelector' | 'goalTasks' | 'yearSchedule' | 'daySchedule' | 'noteList' | 'review'

export interface PlanningField {
  kind: PlanningFieldKind
  key: string
  label?: string
  text?: string
  hint?: string
  minLines?: number
  variants?: string[]
  title?: string
  description?: string
  items?: string[]
  defaultDays?: number
}

export interface PlanningStep { id: string; title: string; fields: PlanningField[] }
export interface PlanningDraft {
  name: string
  profile: PlanningProfile
  stepIndex: number
  skipped: string[]
  answers: Record<string, string>
  selectedAnalysisToolIds: string[]
}
export interface DraftEntry { id: string; name: string; profile: PlanningProfile; updatedAt: string }

const text = (key: string, label: string, hint = '', minLines = 2): PlanningField => ({ kind:'text',key,label,hint,minLines })
const info = (key: string, value: string): PlanningField => ({ kind:'info',key,text:value })
const goalTasks = (): PlanningField => ({ kind:'goalTasks',key:'cele_zadania',label:'Cele i zadania' })
const yearSchedule = (label: string): PlanningField => ({ kind:'yearSchedule',key:'harmonogram_roczny',label })
const daySchedule = (label: string): PlanningField => ({ kind:'daySchedule',key:'harmonogram_dzienny',label,defaultDays:14 })
const analysis: PlanningField = { kind:'analysisSelector',key:'analizy',label:'Wybierz narzędzia i przejdź przez ich pytania' }
const review: PlanningField = { kind:'review',key:'review' }

const visionIntro = 'Zacznij od wizji. Opisz, jak ma wyglądać środowisko za rok, dwa lub trzy lata i co ma być wtedy wyraźnie lepsze niż dziś. Wizja może wracać w kolejnych planach, jeśli nadal jest aktualna.'
const goalsGuide = 'Cele powinny mówić, jaka zmiana ma się wydarzyć. Zapiszcie je konkretnie, ambitnie i realnie, a pod każdym celem dopiszcie działania: zbiórki, wyjazdy, służbę, tropy, sprawności albo zadania zastępów i szóstek.'
const scheduleGuide = 'Przenieś do harmonogramu tylko te działania, które wynikają z celów. W każdym miesiącu zapisz temat, formę pracy, osoby odpowiedzialne i najważniejsze uwagi organizacyjne.'

const teamAspectContent: Record<string, { title: string; description: string }> = {
  a01: {
    title: 'Misja i wartości',
    description: 'Misja i wartości są fundamentem podczas budowania grupy posiadającej wspólne cele i punktem odniesienia dla kształtowania postaw członków zespołu.',
  },
  a02: {
    title: 'Wyznaczanie celów',
    description: 'Wyznaczanie celów jest związane z określeniem kierunku działania. Wymaga elastycznego planowania w zmieniającej się rzeczywistości. Uwzględnia szeroką perspektywę i odzwierciedla harcerskie wartości.',
  },
  a03: {
    title: 'Rozwój osobisty',
    description: 'Rozwój osobisty to doskonalenie umiejętności, zdobywanie wiedzy, rozwijanie zdolności, praca nad charakterem, nabywanie kompetencji w procesie samodoskonalenia i współpracy. Daje poczucie satysfakcji i pełni potencjału. To stwarzanie możliwości do rozwoju dla wszystkich członków zespołu.',
  },
  a04: {
    title: 'Spotkania',
    description: 'Spotkania to przestrzeń do osiągania postawionych celów, budowania relacji, efektywniejszego poznawania się i budowania wspólnoty. Uczestnicy znają cel spotkania, jego agendę, kontekst i planowany czas trwania.',
  },
  a05: {
    title: 'Komunikacja',
    description: 'Komunikacja to wymiana myśli oparta na relacji partnerskiej, przebiegająca w harcerskim duchu. Jest przestrzenią do wyrażania siebie i dzielenia się perspektywą. Prowadzona jest z szacunkiem i zrozumieniem dla odmiennych punktów widzenia. Istotne jest również poszukiwanie optymalnych kanałów komunikacyjnych.',
  },
  a06: {
    title: 'Transparentność i przepływ informacji',
    description: 'Transparentność i przepływ informacji to działanie w sposób odpowiedzialny, uczciwy, budujący wzajemne zaufanie i dobrą opinię o zespole. To także ułatwianie dostępu do zrozumiałych i kompletnych informacji. Zakłada konsultowanie przygotowanych materiałów oraz gotowość do wprowadzania zmian.',
  },
  a07: {
    title: 'Dzielenie się odpowiedzialnością i zadaniami',
    description: 'Dzielenie się odpowiedzialnością i zadaniami to sposób działania, który uwzględnia kompetencje, doświadczenie oraz potrzeby członków zespołu. Zachodzi w sposób budujący poczucie własnej wartości, przynależności oraz odpowiedzialności za wspólne działania.',
  },
  a08: {
    title: 'Podejmowanie decyzji',
    description: 'Podejmowanie decyzji uwzględnia różne perspektywy oraz potencjał członków zespołu. Gwarantuje możliwość wyrażania swojego zdania przez wszystkich, których decyzja dotyczy. Jest procesem prowadzonym w sposób angażujący i dający poczucie sprawczości.',
  },
  a09: {
    title: 'Praca z konfliktem',
    description: 'Praca z konfliktem zaczyna się od dostrzeżenia konfliktu oraz przewidywania jego możliwych konsekwencji. To identyfikacja i analiza jego przyczyn poprzez wysłuchanie wszystkich stron. Zarządzanie konfliktem w sposób konstruktywny rozwija kompetencje członków zespołu i często przekłada się na wypracowanie lepszego rozwiązania.',
  },
  a10: {
    title: 'Wspieranie w działaniu',
    description: 'Wspieranie w działaniu to zapewnianie pomocy i zasobów, które pozwalają innym na przezwyciężanie trudności, realizację zadań i osiąganie celów. Tworzy atmosferę pełną akceptacji i zrozumienia. To także wzajemna troska i umiejętność wsłuchiwania się w potrzeby innych i adekwatnego reagowania na nie.',
  },
  a11: {
    title: 'Wdzięczność i docenianie',
    description: 'Wdzięczność i docenianie są wyrazem poszanowania dla pracy i zaangażowania w osiąganie celów oraz budowanie wspólnoty. Wskazują i umacniają pozytywne postawy w zespole. Stwarzają okazję do świętowania sukcesów i prezentowania ich na zewnątrz.',
  },
  a12: {
    title: 'Podsumowanie pracy i informacja zwrotna',
    description: 'Podsumowanie pracy i informacja zwrotna kończą dany etap refleksją nad dotychczasowym działaniem. Pozwalają na wyciągnięcie wniosków i sformułowanie wskazówek na przyszłość. Kształtują postawę szczerości i otwartości na konstruktywną opinię.',
  },
}

function questionFields(questions: PlanningQuestion[]): PlanningField[] {
  return questions.map((question) => ({ kind:'question',key:question.id,label:question.question,variants:question.variants ?? [] }))
}

export function planningSteps(profile: PlanningProfile, content: ContentBundle): PlanningStep[] {
  if (profile === 'haliz') return [
    { id:'start',title:'Podstawowe informacje HALiZ',fields:[
      info('haliz_intro','Plan HALiZ prowadzi przez kolonię, obóz lub zimowisko bez tworzenia listy uczestników. Najpierw zbierz podstawowe dane wypoczynku, potem doprecyzuj program, przygotowanie organizacyjne i harmonogram dnia.'),
      text('typ_formy','Typ formy','Kolonia / obóz / zimowisko'),text('nazwa_wypoczynku','Nazwa wypoczynku','Np. Obóz 42 DH „Szlak północy”'),text('organizator','Organizator / jednostka ZHP','Hufiec, szczep, gromada, drużyna albo związek drużyn'),text('miejsce_baza','Miejsce i baza wypoczynku','Miejscowość, baza, warunki zakwaterowania'),text('termin','Termin wypoczynku','Daty wyjazdu i powrotu'),text('komendant','Komendantka/komendant i kontakt','Imię, nazwisko, telefon lub e-mail roboczy'),text('kadra_role','Kadra i role','Kto odpowiada za program, logistykę, zdrowie, finanse?'),text('charakterystyka_grupy','Charakterystyka grupy bez listy uczestników','Wiek, metodyka, doświadczenie, potrzeby, ważne ograniczenia.',3),
    ]},
    { id:'cele',title:'Założenia programu',fields:[
      info('program_wskazowka','Program nie powinien być samą listą atrakcji. Zacznij od potrzeb grupy i celów wychowawczych, a dopiero potem dobierz fabułę, obrzędowość, bloki programu i konkretne formy pracy.'),text('cele','Cele wychowawcze i programowe','Co ma się zmienić u uczestników po kolonii, obozie lub zimowisku?'),goalTasks(),text('fabula','Fabuła / obrzędowość / motyw przewodni','Motyw, nazwy dni, symbole, zwyczaje, role fabularne.'),text('bloki_programowe','Główne bloki programu i aktywności','Np. techniki harcerskie, służba, zwiady, wycieczka, pionierka, ogniska.',3),text('instrumenty_metodyczne','Instrumenty metodyczne, stopnie, sprawności, tropy lub wyzwania','Które instrumenty będą naturalnie realizowane w programie?',3),
    ]},
    { id:'organizacja',title:'Przygotowanie organizacyjne',fields:[
      info('organizacja_wskazowka','W części organizacyjnej zbierz sprawy, które muszą być jasne przed wyjazdem: baza, transport, kadra, dokumenty, regulaminy, bezpieczeństwo i komunikacja z rodzicami. Wpisuj konkrety, terminy i osoby odpowiedzialne.'),text('harmonogram_przygotowan','Harmonogram przygotowań','Co trzeba zrobić przed wyjazdem, do kiedy i przez kogo?'),text('baza_logistyka','Baza, transport i logistyka','Dojazd, sprzęt, magazyn, wyżywienie, łączność, rezerwy.'),text('dokumenty','Dokumenty, zgłoszenie, ubezpieczenie','Zgłoszenie wypoczynku, zgody, polisy, dokumentacja kadry.'),text('regulaminy','Regulaminy i zasady bezpieczeństwa','Np. ppoż., drogi, kąpiel, warta, zastęp służbowy, Safe From Harm.',3),text('komunikacja','Komunikacja z rodzicami i środowiskiem','Zebranie, kanał kontaktu, zasady informacji w trakcie wyjazdu.'),
    ]},
    { id:'analizy',title:'Analizy',fields:[analysis] },
    { id:'harmonogram',title:'Harmonogram dzienny',fields:[
      info('harmonogram_haliz_wskazowka','Rozpisz każdy dzień na rano, popołudnie i wieczór. Przy każdym bloku zapisz temat, formę, osobę odpowiedzialną i uwagi organizacyjne: sprzęt, wariant pogodowy, bezpieczeństwo albo powiązanie z fabułą.'),daySchedule('Harmonogram obozu / kolonii / zimowiska'),text('ramowy_plan_dnia','Ramowy plan dnia i stałe punkty','Np. pobudka, apel, zajęcia, cisza poobiednia, ognisko, odprawa kadry.',3),text('podsumowania','Kiedy zaplanować odprawy, podsumowania i ewaluację?','Np. codzienna odprawa kadry po ciszy nocnej i krótka ewaluacja dnia z zastępowymi.'),
    ]},
    { id:'podsumowanie',title:'Podsumowanie',fields:[review] },
  ]

  if (profile === 'zespol_kadry') return [
    {id:'kontekst',title:'Kontekst zespołu',fields:[info('wizja_intro',visionIntro),text('wizja','Jak ma wyglądać zespół po tym okresie?','Opiszcie widoczną zmianę w pracy zespołu.',4),text('typ','Jaki zespół planujesz?','Np. komenda hufca, zespół programowy, namiestnictwo.'),text('uczestnicy','Kogo zaprosić do planowania?','Osoby decyzyjne, wykonawcy, odbiorcy działań, sojusznicy.'),text('zakres','Na jaki okres przygotowujecie plan?','Np. kwartał, rok harcerski, kadencja.')]},
    {id:'diagnoza12',title:'Diagnoza 12 aspektów',fields:content.teamAspects.map((item)=>({kind:'aspect',key:item.id,title:teamAspectContent[item.id]?.title??item.title,description:teamAspectContent[item.id]?.description}))},
    {id:'analizy',title:'Analizy',fields:[analysis]},
    {id:'cele',title:'Cele i priorytety',fields:[text('priorytety','Które aspekty są najważniejsze teraz?','Wybierzcie 2-4 obszary, które realnie zmienicie w tym okresie.'),text('cele','Jakie cele zespołu wynikają z diagnozy?','Nazwijcie zmianę, nie tylko zadanie do wykonania.'),text('sukces','Po czym poznacie, że plan działa?','Wskaźniki, zachowania, decyzje lub efekty widoczne w pracy zespołu.')]},
    {id:'praktyki',title:'Praktyki zespołu',fields:[text('praktyki','Jakie praktyki zespołu wprowadzacie?','Np. stała odprawa, podział odpowiedzialności, informacja zwrotna, docenianie.'),text('odpowiedzialni','Kto bierze odpowiedzialność za praktyki?','Wpisz osoby, role i termin pierwszego sprawdzenia.')]},
    {id:'rytm',title:'Rytm pracy i harmonogram',fields:[info('harmonogram_wskazowka',scheduleGuide),yearSchedule('Harmonogram miesięczny w skali roku'),{kind:'noteList',key:'harmonogram',label:'Rozpisz rytm pracy zespołu',items:content.scheduleConfig[profile]?.items ?? []}]},
    {id:'podsumowanie',title:'Podsumowanie',fields:[review]},
  ]

  const isGromada = profile === 'gromada'
  return [
    {id:'start',title:'Start',fields:[info('wizja_intro',visionIntro),info('wizja_wychowawcza',`Plan ma pomagać wychowywać młodych ludzi przez stawianie wyzwań. Razem z ${isGromada?'kadrą gromady':'radą drużyny'} nazwijcie, co oznacza dla was „wymarzona ${isGromada?'gromada':'drużyna'}” i jakie postawy, umiejętności i doświadczenia chcecie rozwijać.`),text('wizja','Jak ma wyglądać wasze środowisko?',isGromada?'Np. jaka ma być gromada, szóstki i aktywność zuchów.':'Np. jaka ma być drużyna, zastępy i samodzielność harcerzy.',4),text('zakres','Na jaki okres przygotowujecie plan?','Np. rok harcerski, półrocze, cykl programowy.'),text('kto','Kto bierze udział w planowaniu?',isGromada?'Np. kadra gromady, przyboczni, wybrane osoby wspierające.':'Np. rada drużyny, zastępowi, przyboczni, opiekunowie.'),text('kontekst','Co najbardziej wpływa na ten plan?','Np. liczebność, doświadczenie kadry, potrzeby wychowawcze, wydarzenia hufca.')]},
    {id:'diagnoza',title:isGromada?'Diagnoza gromady':'Diagnoza drużyny',fields:questionFields(isGromada?content.gromadaQuestions:content.druzynaQuestions)},
    {id:'analizy',title:'Analizy',fields:[analysis]},
    {id:'cele',title:'Cele i działania',fields:[info('cele_wskazowka',goalsGuide),text('cele','Jakie zmiany chcecie osiągnąć?','Zapiszcie cele wychowawcze i programowe wynikające z diagnozy.'),goalTasks(),text('dzialania',isGromada?'Jakie działania podejmie gromada i szóstki?':'Jakie działania podejmie drużyna, zastępy lub patrole?','Zbiórki, wyjazdy, służba, tropy, sprawności, projekty, zadania zespołów.'),text('odpowiedzialni','Kto odpowiada za poszczególne działania?','Wpisz osoby, zastępy lub role, nie tylko „kadra”.')]},
    {id:'harmonogram',title:'Harmonogram',fields:[info('harmonogram_wskazowka',scheduleGuide),yearSchedule('Harmonogram miesięczny w skali roku'),{kind:'noteList',key:'harmonogram',label:'Rozpiska miesięczna',items:content.scheduleConfig[profile]?.items ?? []},text('podsumowania','Kiedy zaplanować podsumowania?')]},
    {id:'podsumowanie',title:'Podsumowanie',fields:[review]},
  ]
}

export const profileTitles: Record<PlanningProfile,string> = { gromada:'Gromada',druzyna:'Drużyna',zespol_kadry:'Zespół kadry',haliz:'HALiZ' }
export const profileDescriptions: Record<PlanningProfile,string> = {
  gromada:'Roczny lub okresowy plan pracy gromady, z diagnozą i celami wychowawczymi.',
  druzyna:'Plan pracy drużyny, zastępów lub patroli, od wizji po harmonogram działań.',
  zespol_kadry:'Plan pracy zespołu kadry: praktyki, odpowiedzialności, rytm i rozwój zespołu.',
  haliz:'Kolonia, obóz lub zimowisko: program, organizacja i harmonogram dzień po dniu.',
}

export function blankDraft(name='Plan roboczy', profile: PlanningProfile='gromada'): PlanningDraft { return {name,profile,stepIndex:0,skipped:[],answers:{},selectedAnalysisToolIds:[]} }
export function answerKey(profile: PlanningProfile, step: PlanningStep, field: PlanningField, suffix='value') { return `${profile}.${step.id}.${field.key}.${suffix}` }
export const yearMonths=['Wrzesień','Październik','Listopad','Grudzień','Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień']
export const yearColumns=['TEMAT/ZADANIE','FORMA PRACY','ODPOWIEDZIALNI','UWAGI']
export const dayPeriods=['Rano','Po południu','Wieczorem']
export const dayColumns=[{key:'topic',label:'Temat / zajęcia'},{key:'form',label:'Forma / opis'},{key:'responsible',label:'Osoba odpowiedzialna'},{key:'notes',label:'Uwagi'}]

export function toolsForProfile(tools: PlanningAnalysisTool[], profile: PlanningProfile) { return tools.filter((tool)=>!tool.profiles?.length||tool.profiles.includes(profile)) }
