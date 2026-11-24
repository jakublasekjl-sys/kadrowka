const controlCharacters = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/

export function safeExternalUrl(value) {
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

export function safeContentPath(value) {
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

export function isSafeArchivePath(value) {
  const candidate = String(value ?? '').replaceAll('\\', '/')
  if (!candidate || candidate.startsWith('/') || /^[a-z]:/i.test(candidate) || controlCharacters.test(candidate)) return false
  return candidate.split('/').every((segment) => segment && segment !== '.' && segment !== '..')
}

export function decodeSingleQuotedJsString(source) {
  let output = ''
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character !== '\\') {
      output += character
      continue
    }
    index += 1
    if (index >= source.length) throw new Error('Niepelna sekwencja ucieczki w danych SharePoint.')
    const escaped = source[index]
    const simple = { "'": "'", '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', 0: '\0' }
    if (Object.hasOwn(simple, escaped)) {
      output += simple[escaped]
      continue
    }
    if (escaped === '\n') continue
    if (escaped === '\r') {
      if (source[index + 1] === '\n') index += 1
      continue
    }
    if (escaped === 'x') {
      const hex = source.slice(index + 1, index + 3)
      if (!/^[0-9a-f]{2}$/i.test(hex)) throw new Error('Nieprawidlowa sekwencja szesnastkowa w danych SharePoint.')
      output += String.fromCodePoint(Number.parseInt(hex, 16))
      index += 2
      continue
    }
    if (escaped === 'u') {
      if (source[index + 1] === '{') {
        const end = source.indexOf('}', index + 2)
        const hex = end < 0 ? '' : source.slice(index + 2, end)
        if (!/^[0-9a-f]{1,6}$/i.test(hex)) throw new Error('Nieprawidlowa sekwencja Unicode w danych SharePoint.')
        output += String.fromCodePoint(Number.parseInt(hex, 16))
        index = end
        continue
      }
      const hex = source.slice(index + 1, index + 5)
      if (!/^[0-9a-f]{4}$/i.test(hex)) throw new Error('Nieprawidlowa sekwencja Unicode w danych SharePoint.')
      output += String.fromCodePoint(Number.parseInt(hex, 16))
      index += 4
      continue
    }
    output += escaped
  }
  return output
}

export function assertSafeArchive(entries, options = {}) {
  const maxEntries = options.maxEntries ?? 10_000
  const maxTotalBytes = options.maxTotalBytes ?? 2 * 1024 ** 3
  if (entries.length > maxEntries) throw new Error(`Paczka zawiera zbyt wiele plikow: ${entries.length}.`)
  let total = 0
  for (const entry of entries) {
    if (!isSafeArchivePath(entry.path)) throw new Error(`Niebezpieczna sciezka w paczce: ${entry.path}`)
    if (entry.encrypted) throw new Error(`Paczka zawiera zaszyfrowany plik: ${entry.path}`)
    if (entry.symlink) throw new Error(`Paczka zawiera niedozwolone dowiazanie symboliczne: ${entry.path}`)
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error(`Nieprawidlowy rozmiar pliku: ${entry.path}`)
    total += entry.size
    if (entry.size > 1024 ** 2 && entry.compressedSize > 0 && entry.size / entry.compressedSize > 500) {
      throw new Error(`Podejrzany stopien kompresji pliku: ${entry.path}`)
    }
  }
  if (total > maxTotalBytes) throw new Error(`Rozpakowana paczka jest zbyt duza: ${total} B.`)
}
