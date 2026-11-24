import { contentAssetUrl } from './contentRepository'
import type { ContentAsset } from '../types/content'
import { isStorageQuotaError } from '../db/storageErrors'

const cacheName = 'kadrowka-materialy-v3'
const legacyCacheNames = ['kadrowka-materialy-v1', 'kadrowka-materialy-v2']
const versionKey = 'kadrowka_offline_materials_version'

export class MaterialAccessError extends Error {
  readonly code: 'offline' | 'missing' | 'network' | 'storage'

  constructor(
    message: string,
    code: 'offline' | 'missing' | 'network' | 'storage',
  ) {
    super(message)
    this.name = 'MaterialAccessError'
    this.code = code
  }
}

export interface OfflineStatus {
  cachedCount: number
  cachedBytes: number
  totalCount: number
  totalBytes: number
}

function absoluteAssetUrl(path: string) {
  const target = contentAssetUrl(path)
  if (!target) throw new MaterialAccessError('Materiał ma nieprawidłową ścieżkę i nie może zostać otwarty.', 'missing')
  return new URL(target, window.location.href).href
}

function isUnexpectedHtml(response: Response, path: string) {
  const contentType = response.headers.get('content-type')?.toLocaleLowerCase('en') ?? ''
  return !/\.(?:html?|aspx)(?:$|[?#])/i.test(path) && contentType.includes('text/html')
}

export async function isOfflineAssetCached(path: string) {
  if (!('caches' in window)) return false
  const cache = await caches.open(cacheName)
  const url = absoluteAssetUrl(path)
  const response = await cache.match(url)
  if (!response) return false
  if (isUnexpectedHtml(response, path)) {
    await cache.delete(url)
    return false
  }
  return true
}

export async function prepareAssetForOpen(path: string) {
  if (/\.aspx(?:$|[?#])/i.test(path)) {
    throw new MaterialAccessError(
      'Ten odnośnik prowadzi do technicznej kopii strony zamiast materiału. Zgłoś problem w Kadrówce.',
      'missing',
    )
  }
  if (await isOfflineAssetCached(path)) return 'cached' as const
  if (!navigator.onLine) {
    throw new MaterialAccessError(
      'Ten materiał nie jest zapisany na urządzeniu. Połącz się z internetem albo pobierz materiały modułu.',
      'offline',
    )
  }

  try {
    const response = await fetch(contentAssetUrl(path), { method: 'HEAD', cache: 'no-store' })
    if (response.status === 404 || isUnexpectedHtml(response, path)) {
      throw new MaterialAccessError(
        'Tego pliku nie znaleziono na serwerze. Spróbuj ponownie lub zgłoś problem w Kadrówce.',
        'missing',
      )
    }
    if (!response.ok && response.status !== 405) {
      throw new MaterialAccessError(
        `Nie udało się otworzyć materiału (kod ${response.status}). Spróbuj ponownie.`,
        'network',
      )
    }
    return 'online' as const
  } catch (error) {
    if (error instanceof MaterialAccessError) throw error
    throw new MaterialAccessError(
      'Nie udało się połączyć z serwerem materiałów. Sprawdź internet i spróbuj ponownie.',
      'network',
    )
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export async function ensureOfflineCacheVersion(version: string) {
  if (!('caches' in window)) throw new Error('Ta przeglądarka nie obsługuje pamięci materiałów offline.')
  let storedVersion: string | null = null
  try { storedVersion = localStorage.getItem(versionKey) } catch { /* Try the cache without version metadata. */ }
  if (storedVersion && storedVersion !== version) {
    await Promise.all([cacheName, ...legacyCacheNames].map((name) => caches.delete(name)))
  } else {
    await caches.open(cacheName)
    await Promise.all(legacyCacheNames.map((name) => caches.delete(name)))
  }
  try { localStorage.setItem(versionKey, version) } catch { /* Private mode may block localStorage. */ }
}

export async function offlineStatus(assets: ContentAsset[]): Promise<OfflineStatus> {
  if (!('caches' in window)) return { cachedCount: 0, cachedBytes: 0, totalCount: assets.length, totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0) }
  const cache = await caches.open(cacheName)
  const cached = (await Promise.all(assets.map(async (asset) => {
    const url = absoluteAssetUrl(asset.path)
    const response = await cache.match(url)
    if (!response) return null
    if (isUnexpectedHtml(response, asset.path)) {
      await cache.delete(url)
      return null
    }
    return asset
  }))).filter((asset): asset is ContentAsset => Boolean(asset))
  return {
    cachedCount: cached.length,
    cachedBytes: cached.reduce((sum, asset) => sum + asset.size, 0),
    totalCount: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
  }
}

export async function downloadOfflineAssets(
  assets: ContentAsset[],
  onProgress: (completed: number, total: number, failed: number) => void,
  signal?: AbortSignal,
) {
  if (!('caches' in window)) throw new Error('Ta przeglądarka nie obsługuje pamięci materiałów offline.')
  const cache = await caches.open(cacheName)
  let next = 0
  let completed = 0
  let failed = 0
  let storageFull = false
  const failures: string[] = []
  const workers = Array.from({ length: Math.min(4, assets.length) }, async () => {
    while (next < assets.length && !signal?.aborted && !storageFull) {
      const asset = assets[next++]
      const url = absoluteAssetUrl(asset.path)
      try {
        const cachedResponse = await cache.match(url)
        if (cachedResponse && isUnexpectedHtml(cachedResponse, asset.path)) await cache.delete(url)
        if (!cachedResponse || isUnexpectedHtml(cachedResponse, asset.path)) {
          const response = await fetch(url, { signal, cache: 'no-store' })
          if (!response.ok || isUnexpectedHtml(response, asset.path)) throw new Error(String(response.status))
          await cache.put(url, response.clone())
        }
      } catch (error) {
        if (signal?.aborted) break
        if (isStorageQuotaError(error)) storageFull = true
        failed += 1
        failures.push(asset.path)
      } finally {
        if (!signal?.aborted) {
          completed += 1
          onProgress(completed, assets.length, failed)
        }
      }
    }
  })
  await Promise.all(workers)
  if (storageFull) {
    throw new MaterialAccessError('Brakuje miejsca na zapisanie materiałów offline. Usuń część pobranych materiałów lub zwolnij miejsce na urządzeniu.', 'storage')
  }
  if (signal?.aborted) {
    const error = new Error('Pobieranie zostało zatrzymane.')
    error.name = 'AbortError'
    throw error
  }
  return failures
}

export async function clearOfflineMaterials() {
  await caches.delete(cacheName)
}

export async function checkAssetAvailability(
  assets: ContentAsset[],
  onProgress: (completed: number, total: number, failed: number) => void,
) {
  let next = 0
  let completed = 0
  let failed = 0
  const failures: string[] = []
  const workers = Array.from({ length: Math.min(6, assets.length) }, async () => {
    while (next < assets.length) {
      const asset = assets[next++]
      try {
        const response = await fetch(contentAssetUrl(asset.path), { method: 'HEAD', cache: 'no-store' })
        if (!response.ok || isUnexpectedHtml(response, asset.path)) throw new Error(String(response.status))
      } catch {
        failed += 1
        failures.push(asset.path)
      } finally {
        completed += 1
        onProgress(completed, assets.length, failed)
      }
    }
  })
  await Promise.all(workers)
  return failures
}
