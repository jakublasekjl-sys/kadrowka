const controlCharacters = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/
const routeIdPattern = /^[a-z0-9][a-z0-9_-]{0,199}$/i

export function safeRouteId(value: unknown): string {
  const candidate = String(value ?? '').trim()
  return routeIdPattern.test(candidate) ? candidate : ''
}

export function safeExternalUrl(value: unknown): string {
  const candidate = String(value ?? '').trim()
  if (!candidate || candidate.length > 4096 || controlCharacters.test(candidate)) return ''
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}

export function safeContentPath(value: unknown): string {
  const candidate = String(value ?? '').trim().replaceAll('\\', '/').normalize('NFC')
  if (!candidate.startsWith('files/') || candidate.length > 1024 || controlCharacters.test(candidate) || /[%?#:]/.test(candidate)) return ''
  const segments = candidate.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment !== segment.trim() || /[. ]$/.test(segment))) return ''
  for (const segment of segments) {
    try {
      const decoded = decodeURIComponent(segment)
      if (!decoded || decoded === '.' || decoded === '..' || /[/\\]/.test(decoded) || controlCharacters.test(decoded)) return ''
    } catch {
      return ''
    }
  }
  return candidate
}

export function contentPathUrl(value: unknown): string {
  const path = safeContentPath(value)
  return path ? `/content/${path.split('/').map(encodeURIComponent).join('/')}` : ''
}
