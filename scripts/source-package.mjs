import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const localZip = resolve(projectRoot, 'source/content-package.zip')
const legacyZip = resolve(projectRoot, '../kadra_zhp_offline/assets/starter_content/content-package.zip')
export const sourcePackageZip = process.env.KADROWKA_CONTENT_ZIP
  ? resolve(process.env.KADROWKA_CONTENT_ZIP)
  : existsSync(localZip) ? localZip : legacyZip
export const expectedSourcePackageSha256 = 'b30eddb545b9d2904890d1787337cae5ce0ff68123dfd5153abd7057726c0f9d'

export async function verifySourcePackage() {
  if (!existsSync(sourcePackageZip)) {
    throw new Error('Brak paczki treści. Pobierz ją do source/content-package.zip albo ustaw KADROWKA_CONTENT_ZIP.')
  }
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(sourcePackageZip)) hash.update(chunk)
  const actual = hash.digest('hex')
  if (actual !== expectedSourcePackageSha256) {
    throw new Error(`Niezgodna suma SHA-256 paczki treści: ${actual}. Zweryfikuj źródło przed zmianą oczekiwanego skrótu.`)
  }
  return { path: sourcePackageZip, sha256: actual }
}
