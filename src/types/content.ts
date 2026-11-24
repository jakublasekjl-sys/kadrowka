export interface ContentManifest {
  packageId: string
  title: string
  version: string
  pagesCount: number
  modulesCount: number
  filesCount: number
  searchItemsCount: number
  [key: string]: unknown
}

export interface ContentLink {
  title?: string
  url?: string
  path?: string
  targetKind?: string
  targetId?: string
  type?: string
  [key: string]: unknown
}

export interface ContentTextRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  link?: ContentLink
}

export interface ContentBlock {
  type: string
  text?: string
  runs?: ContentTextRun[]
  level?: number
  path?: string
  src?: string
  alt?: string
  caption?: string
  action?: ContentLink
  title?: string
  ordered?: boolean
  items?: Array<string | ContentLink>
  columns?: Array<{ blocks?: ContentBlock[] }>
  [key: string]: unknown
}

export interface ContentAsset {
  path: string
  size: number
  compressedSize?: number
  moduleId?: string
  moduleIds?: string[]
}

export type MaterialPlacementKind = 'module' | 'page' | 'tool' | 'document'

export interface MaterialPlacement {
  kind: MaterialPlacementKind
  targetId: string
  section?: string
}

export interface MaterialCatalogRecord {
  id: string
  title: string
  legacyPaths: string[]
  storagePath: string
  sha256: string
  size: number
  mimeType: string
  assetKind: 'document' | 'image'
  moduleIds: string[]
  placements: MaterialPlacement[]
  metadata?: {
    category?: string
    audiences?: string[]
    usageModes?: string[]
    levels?: string[]
    description?: string
  }
}

export interface MaterialCatalog {
  schemaVersion: 1
  releaseId: string
  generatedAt: string
  contentVersion: string
  materialCount: number
  totalBytes: number
  materials: MaterialCatalogRecord[]
}

export interface MaterialCatalogPointer {
  schemaVersion: 1
  releaseId: string
  catalogPath: string
  publishedAt: string
  previousReleaseId?: string
}

export interface AzureRuntimeConfig {
  enabled: boolean
  tenantId: string
  clientId: string
  storageAccountName: string
  containerName: string
  publicBaseUrl: string
}

export interface RuntimeConfig {
  schemaVersion: 1
  environment: 'local' | 'development' | 'production'
  adminPanelEnabled: boolean
  azure: AzureRuntimeConfig
}

export interface ContentDiagnostics {
  generatedAt: string
  packageVersion: string
  status: 'ok' | 'warning' | 'error'
  errors: string[]
  warnings: string[]
  notes?: string[]
  counts: {
    pages: number
    modules: number
    searchItems: number
    assets: number
    archiveAssets?: number
    excludedSourceSnapshots?: number
    referencedAssets: number
    richTextBlocks?: number
    imageBlocks?: number
    imageActions?: number
    tools?: number
    totalAssetBytes: number
  }
}

export interface ContentPage {
  id: string
  title: string
  moduleId?: string
  summary?: string
  subtitle?: string
  sourceUrl?: string
  blocks?: ContentBlock[]
  images?: ContentLink[]
  quickLinks?: ContentLink[]
  [key: string]: unknown
}

export interface ContentFile extends ContentLink {
  id?: string
  favoriteId?: string
  fileName?: string
  category?: string
  categoryId?: string
  categoryTitle?: string
  audience?: string
  audiences?: string[]
  mode?: string
  usageModes?: string[]
  stage?: string
  level?: string
  levels?: string[]
  description?: string
  sourceModule?: string
  sourceModuleId?: string
  sourceModuleTitle?: string
  kind?: string
}

export interface ContentModule {
  id: string
  title: string
  shortTitle?: string
  description?: string
  icon?: string
  pages?: ContentLink[]
  files?: ContentFile[]
  [key: string]: unknown
}

export interface SearchItem extends ContentLink {
  id?: string
  kind?: string
  subtitle?: string
  text?: string
  moduleId?: string
  scope?: 'read' | 'tool' | 'material' | 'work'
}

export interface PlanningAnalysisTool {
  id: string
  title: string
  description: string
  profiles?: string[]
  prompts: Array<{ key: string; label: string }>
}

export interface PlanningQuestion {
  id: string
  question: string
  variants?: string[]
}

export interface TeamAspect {
  id: string
  title: string
  [key: string]: unknown
}

export interface PlanningConfig {
  title?: string
  profiles: Array<{ id: string; title: string }>
  visibilityRules?: Record<string, string[]>
}

export interface ScheduleConfig {
  [profile: string]: { items?: string[] }
}

export interface HomeContent {
  title?: string
  subtitle?: string
  description?: string
  [key: string]: unknown
}

export interface ContentBundle {
  manifest: ContentManifest
  home: HomeContent
  modules: ContentModule[]
  pages: ContentPage[]
  curatedPages: Record<string, unknown>[]
  documents: ContentFile[]
  search: SearchItem[]
  analysisTools: PlanningAnalysisTool[]
  tools: ContentFile[]
  planningConfig: PlanningConfig
  scheduleConfig: ScheduleConfig
  gromadaQuestions: PlanningQuestion[]
  druzynaQuestions: PlanningQuestion[]
  teamAspects: TeamAspect[]
  czuwajCategories: Record<string, string[]>
  assets: ContentAsset[]
  diagnostics: ContentDiagnostics
  materialCatalog: MaterialCatalog
  materialCatalogSource: 'local' | 'azure'
  materialCatalogWarning?: string
  runtimeConfig: RuntimeConfig
}
