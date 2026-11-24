import type { ContentBundle } from '../types/content'
import { loadRuntimeConfig } from '../config/runtimeConfig'
import { readJsonResponse } from '../security/jsonResponse'
import {
  installMaterialResolver,
  loadActiveMaterialCatalog,
  mergeCatalogPlacements,
  parseMaterialCatalog,
  resolveMaterialUrl,
} from './materialCatalog'

const base = '/content'
const maxJsonBytes = 12 * 1024 * 1024

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${base}/${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Nie udało się wczytać ${path} (${response.status})`)
  }
  return readJsonResponse<T>(response, maxJsonBytes, path)
}

let bundlePromise: Promise<ContentBundle> | null = null

export function loadContentBundle(): Promise<ContentBundle> {
  bundlePromise ??= Promise.all([
    loadJson<ContentBundle['manifest']>('manifest.json'),
    loadJson<ContentBundle['home']>('home.json'),
    loadJson<ContentBundle['modules']>('modules.json'),
    loadJson<ContentBundle['pages']>('pages.json'),
    loadJson<ContentBundle['curatedPages']>('curated-pages.json'),
    loadJson<ContentBundle['documents']>('documents.json'),
    loadJson<ContentBundle['search']>('search/search-index.json'),
    loadJson<ContentBundle['analysisTools']>('planning/analysis-tools.json'),
    loadJson<ContentBundle['tools']>('tools-catalog.json'),
    loadJson<ContentBundle['planningConfig']>('planning/planning-config.json'),
    loadJson<ContentBundle['scheduleConfig']>('planning/schedule-config.json'),
    loadJson<ContentBundle['gromadaQuestions']>('planning/questions-gromada.json'),
    loadJson<ContentBundle['druzynaQuestions']>('planning/questions-druzyna.json'),
    loadJson<ContentBundle['teamAspects']>('planning/team-kadry-aspects.json'),
    loadJson<ContentBundle['czuwajCategories']>('czuwaj-categories.json'),
    loadJson<ContentBundle['assets']>('assets-index.json'),
    loadJson<ContentBundle['diagnostics']>('diagnostics.json'),
    loadJson<unknown>('materials-catalog.json'),
    loadRuntimeConfig(),
  ]).then(
    async ([manifest, home, modules, pages, curatedPages, documents, search, analysisTools, tools, planningConfig, scheduleConfig, gromadaQuestions, druzynaQuestions, teamAspects, czuwajCategories, assets, diagnostics, catalogSource, runtimeConfig]) => {
      const localCatalog = parseMaterialCatalog(catalogSource)
      const activeCatalog = await loadActiveMaterialCatalog(localCatalog, runtimeConfig)
      installMaterialResolver(activeCatalog.catalog, activeCatalog.source, runtimeConfig.azure.publicBaseUrl)
      const localAssets = new Map(assets.map((asset) => [asset.path.normalize('NFC').toLocaleLowerCase('pl'), asset]))
      const catalogAssets = activeCatalog.catalog.materials.map((material) => {
        const path = material.legacyPaths[0]
        const localAsset = localAssets.get(path.normalize('NFC').toLocaleLowerCase('pl'))
        return {
          path,
          size: material.size,
          compressedSize: localAsset?.compressedSize,
          moduleId: material.moduleIds[0],
          moduleIds: material.moduleIds,
        }
      })
      const content = mergeCatalogPlacements({
        manifest,
        home,
        modules,
        pages,
        curatedPages,
        documents,
        search,
        analysisTools,
        tools,
        planningConfig,
        scheduleConfig,
        gromadaQuestions,
        druzynaQuestions,
        teamAspects,
        czuwajCategories,
        assets: catalogAssets,
        diagnostics,
      }, activeCatalog.catalog)
      return {
        ...content,
        materialCatalog: activeCatalog.catalog,
        materialCatalogSource: activeCatalog.source,
        materialCatalogWarning: activeCatalog.warning,
        runtimeConfig,
      }
    },
  )
  return bundlePromise
}

export function contentAssetUrl(path?: string): string {
  return resolveMaterialUrl(path)
}
