import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateMaterialSignature } from './file-signature-utils.mjs'

export const sourceImageRepairs = [
  {
    from: 'files/pozostale-materialy/3703019478-Clipart---home-icon.jpeg',
    to: 'files/pozostale-materialy/3703019478-Clipart---home-icon.png',
    sha256: '1d094db9218b593b46222b9648826e959f65f603cd7f18d6255c89f1f2fa8d74',
  },
]

function assertExpectedImage(path, repair) {
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actual !== repair.sha256) throw new Error(`Obraz z paczki zrodlowej zmienil sie: ${repair.from}`)
}

export function applySourceImageRepairs(filesRoot) {
  for (const repair of sourceImageRepairs) {
    const oldPath = resolve(filesRoot, repair.from.replace(/^files\//, ''))
    const newPath = resolve(filesRoot, repair.to.replace(/^files\//, ''))
    if (existsSync(oldPath)) {
      if (existsSync(newPath)) throw new Error(`Dwa pliki maja docelowa nazwe: ${repair.to}`)
      assertExpectedImage(oldPath, repair)
      renameSync(oldPath, newPath)
    }
    if (!existsSync(newPath)) throw new Error(`Brak obrazu z paczki zrodlowej: ${repair.from}`)
    assertExpectedImage(newPath, repair)
    validateMaterialSignature(newPath)
  }
}
