import { closeSync, openSync, readSync } from 'node:fs'
import { extname } from 'node:path'
import { readZipCatalog } from './content-package-utils.mjs'

export const allowedMaterialExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.docx', '.xlsx', '.pptx', '.ppsx'])

function header(path, length = 1024) {
  const descriptor = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const bytes = readSync(descriptor, buffer, 0, length, 0)
    return buffer.subarray(0, bytes)
  } finally {
    closeSync(descriptor)
  }
}

export function validateMaterialSignature(path) {
  const extension = extname(path).toLocaleLowerCase('en')
  if (!allowedMaterialExtensions.has(extension)) throw new Error(`Niedozwolony typ materialu: ${path}`)
  const bytes = header(path)
  const ascii = bytes.toString('latin1')
  const starts = (...values) => values.some((value) => bytes.subarray(0, value.length).equals(Buffer.from(value, 'latin1')))

  if (extension === '.pdf' && !ascii.includes('%PDF-')) throw new Error(`Plik PDF ma nieprawidlowa sygnature: ${path}`)
  if (extension === '.png' && !starts('\x89PNG\r\n\x1a\n')) throw new Error(`Plik PNG ma nieprawidlowa sygnature: ${path}`)
  if (['.jpg', '.jpeg'].includes(extension) && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new Error(`Plik JPEG ma nieprawidlowa sygnature: ${path}`)
  if (extension === '.gif' && !starts('GIF87a', 'GIF89a')) throw new Error(`Plik GIF ma nieprawidlowa sygnature: ${path}`)
  if (extension === '.webp' && !(ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP')) throw new Error(`Plik WEBP ma nieprawidlowa sygnature: ${path}`)

  if (['.docx', '.xlsx', '.pptx', '.ppsx'].includes(extension)) {
    if (!starts('PK\x03\x04', 'PK\x05\x06', 'PK\x07\x08')) throw new Error(`Plik Office ma nieprawidlowa sygnature: ${path}`)
    const entries = readZipCatalog(path).map((entry) => entry.path.toLocaleLowerCase('en'))
    const required = extension === '.docx' ? 'word/document.xml'
      : extension === '.xlsx' ? 'xl/workbook.xml'
        : 'ppt/presentation.xml'
    if (!entries.includes('[content_types].xml') || !entries.includes(required)) throw new Error(`Plik Office nie ma oczekiwanej struktury: ${path}`)
    if (entries.some((entry) => /(?:^|\/)vbaproject\.bin$/i.test(entry))) throw new Error(`Plik Office zawiera niedozwolone makra: ${path}`)
  }
}
