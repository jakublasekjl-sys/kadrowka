export async function readJsonResponse<T>(response: Response, maxBytes: number, label: string): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) throw new Error(`Nieprawidłowy typ danych: ${label}.`)
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error(`Plik JSON jest zbyt duży: ${label}.`)
  if (!response.body) throw new Error(`Pusta odpowiedź JSON: ${label}.`)

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new Error(`Plik JSON jest zbyt duży: ${label}.`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as T
  } catch {
    throw new Error(`Uszkodzony plik JSON: ${label}.`)
  }
}
