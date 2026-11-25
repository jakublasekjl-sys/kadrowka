import { z } from 'zod'
import type { RuntimeConfig } from '../types/content'
import { readJsonResponse } from '../security/jsonResponse.ts'

const runtimeConfigSchema = z.object({
  schemaVersion: z.literal(1),
  environment: z.enum(['local', 'development', 'production']),
  adminPanelEnabled: z.boolean(),
  azure: z.object({
    enabled: z.boolean(),
    tenantId: z.string().max(128),
    clientId: z.string().max(128),
    storageAccountName: z.string().regex(/^[a-z0-9]{0,24}$/),
    containerName: z.string().regex(/^[a-z0-9-]{1,63}$/),
    publicBaseUrl: z.string().max(2048),
    catalogReleaseId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/i).optional(),
  }),
}).superRefine((config, context) => {
  if (!config.azure.enabled) return
  const { azure } = config
  if ((config.adminPanelEnabled || azure.tenantId || azure.clientId)
    && (!z.uuid().safeParse(azure.tenantId).success || !z.uuid().safeParse(azure.clientId).success)) {
    context.addIssue({ code: 'custom', message: 'Identyfikatory Entra muszą być poprawnymi UUID.' })
  }
  if (!/^[a-z0-9]{3,24}$/.test(azure.storageAccountName)
    || !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(azure.containerName)) {
    context.addIssue({ code: 'custom', message: 'Nieprawidłowa nazwa konta Storage lub kontenera.' })
  }
  const expectedUrl = `https://${azure.storageAccountName}.blob.core.windows.net/${azure.containerName}`
  if (azure.publicBaseUrl.replace(/\/+$/, '') !== expectedUrl) {
    context.addIssue({ code: 'custom', message: 'Publiczny adres Blob musi wskazywać skonfigurowany kontener.' })
  }
})

let configPromise: Promise<RuntimeConfig> | null = null
const cacheKey = 'kadrowka_runtime_config_v1'

function normalizedConfig(config: RuntimeConfig): RuntimeConfig {
  return {
    ...config,
    azure: {
      ...config.azure,
      publicBaseUrl: config.azure.publicBaseUrl.trim().replace(/\/+$/, ''),
    },
  }
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  return normalizedConfig(runtimeConfigSchema.parse(value))
}

export function isAzureRuntimeReady(config: RuntimeConfig) {
  const azure = config.azure
  return azure.enabled
    && Boolean(azure.storageAccountName && azure.containerName && azure.publicBaseUrl)
}

export function isAzureAdminReady(config: RuntimeConfig) {
  return isAzureRuntimeReady(config) && Boolean(config.azure.tenantId && config.azure.clientId)
}

export function isAdminPanelAvailable(config: RuntimeConfig) {
  return config.adminPanelEnabled && (config.environment === 'local' || isAzureAdminReady(config))
}

export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  configPromise ??= (async () => {
    let response: Response
    try {
      response = await fetch('/runtime-config.json', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
    } catch {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) return parseRuntimeConfig(JSON.parse(cached) as unknown)
      } catch { /* Offline cache is optional. */ }
      throw new Error('Nie udało się wczytać konfiguracji aplikacji. Połącz się z internetem i spróbuj ponownie.')
    }
    if (!response.ok) throw new Error(`Nie udało się wczytać konfiguracji aplikacji (HTTP ${response.status}).`)
    const config = parseRuntimeConfig(await readJsonResponse<unknown>(response, 8 * 1024, 'runtime-config.json'))
    try { localStorage.setItem(cacheKey, JSON.stringify(config)) } catch { /* Private mode may block localStorage. */ }
    return config
  })()
  return configPromise
}
