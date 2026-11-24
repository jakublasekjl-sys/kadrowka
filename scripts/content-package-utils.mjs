import { closeSync, fstatSync, openSync, readSync } from 'node:fs'

const endSignature = 0x06054b50
const centralSignature = 0x02014b50

export function readZipCatalog(zipPath) {
  const descriptor = openSync(zipPath, 'r')
  try {
    const size = fstatSync(descriptor).size
    const tailSize = Math.min(size, 65_557)
    const tail = Buffer.alloc(tailSize)
    readSync(descriptor, tail, 0, tailSize, size - tailSize)

    let endOffset = -1
    for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
      if (tail.readUInt32LE(offset) === endSignature) {
        endOffset = offset
        break
      }
    }
    if (endOffset < 0) throw new Error('Nie znaleziono katalogu centralnego ZIP.')

    const entriesCount = tail.readUInt16LE(endOffset + 10)
    const centralSize = tail.readUInt32LE(endOffset + 12)
    const centralOffset = tail.readUInt32LE(endOffset + 16)
    if (entriesCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      throw new Error('Paczka ZIP64 nie jest obsługiwana przez kontrolę treści.')
    }

    const central = Buffer.alloc(centralSize)
    readSync(descriptor, central, 0, centralSize, centralOffset)
    const entries = []
    let offset = 0
    while (offset < central.length && entries.length < entriesCount) {
      if (central.readUInt32LE(offset) !== centralSignature) {
        throw new Error(`Nieprawidłowy wpis katalogu ZIP przy bajcie ${offset}.`)
      }
      const flags = central.readUInt16LE(offset + 8)
      const compressedSize = central.readUInt32LE(offset + 20)
      const size = central.readUInt32LE(offset + 24)
      const nameLength = central.readUInt16LE(offset + 28)
      const extraLength = central.readUInt16LE(offset + 30)
      const commentLength = central.readUInt16LE(offset + 32)
      const externalAttributes = central.readUInt32LE(offset + 38)
      const unixMode = externalAttributes >>> 16
      const nameBytes = central.subarray(offset + 46, offset + 46 + nameLength)
      const path = nameBytes.toString(flags & 0x800 ? 'utf8' : 'utf8').replaceAll('\\', '/')
      if (path && !path.endsWith('/')) entries.push({
        path,
        size,
        compressedSize,
        encrypted: Boolean(flags & 1),
        symlink: (unixMode & 0o170000) === 0o120000,
      })
      offset += 46 + nameLength + extraLength + commentLength
    }
    return entries
  } finally {
    closeSync(descriptor)
  }
}

export function pathKey(path) {
  return path.replaceAll('\\', '/').normalize('NFC').toLocaleLowerCase('pl')
}
