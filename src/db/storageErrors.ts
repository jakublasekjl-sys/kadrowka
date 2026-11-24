let lastNoticeAt = 0

export function isStorageQuotaError(error: unknown) {
  if (error instanceof DOMException) {
    return ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error.name) || error.code === 22 || error.code === 1014
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /quota|storage.*full|disk.*full|brak.*miejsca/i.test(message)
}

export function reportStorageWriteError(error: unknown) {
  if (!isStorageQuotaError(error)) return
  const now = Date.now()
  if (now - lastNoticeAt < 5_000) return
  lastNoticeAt = now
  window.alert('Brakuje miejsca na zapisanie zmian. Pobierz kopię swojej pracy, zwolnij miejsce na urządzeniu i spróbuj ponownie.')
}
