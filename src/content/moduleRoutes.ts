import type { ContentModule } from '../types/content'

const directPages: Record<string, string> = {
  'model-przywodztwa': 'model-przywodztwa',
  'proces-pracy-z-kadra': 'proces-pracy-z-kadra',
  'praca-z-kadra-w-zespole': 'praca-z-kadra-w-zespole',
  ewaluacja: 'ewaluacja',
  'wdrazanie-spzk': 'wdrazanie-systemu-pracy-z-kadra-w-zhp',
  'system-stopni-instruktorskich-w-zhp': 'system-stopni-instruktorskich-w-zhp',
}

const directUrls: Record<string, string> = {
  'funkcje-w-zhp': 'https://gkzhp.sharepoint.com/sites/platforma-kadry',
  'system-ksztalcenia-w-zhp': 'https://apps.powerapps.com/play/3aa72b2f-ee91-473f-833b-6f0085a13c18?tenantId=e1368d1e-3975-4ce6-893d-fc351fd44dcd&ID=4065',
}

export function moduleRoute(module: ContentModule) {
  if (directUrls[module.id]) return { target: directUrls[module.id], external: true }
  if (directPages[module.id]) return { target: `/page/${directPages[module.id]}`, external: false }
  return { target: `/module/${module.id}`, external: false }
}
