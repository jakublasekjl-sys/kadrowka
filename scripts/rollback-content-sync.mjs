import { existsSync, renameSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'public/content')
const rollback = resolve(root, '.content-sync-rollback')
const current = resolve(root, '.content-sync-current')
if (!existsSync(rollback)) throw new Error('Brak poprzedniej paczki treści do przywrócenia.')
if (dirname(current) !== root) throw new Error('Nieprawidłowa ścieżka robocza wycofania.')
rmSync(current, { recursive: true, force: true })
if (existsSync(target)) renameSync(target, current)
try {
  renameSync(rollback, target)
  renameSync(current, rollback)
  console.log('Przywrócono poprzednią paczkę treści. Nowsza paczka pozostaje dostępna do ponownego wycofania.')
} catch (error) {
  if (existsSync(current) && !existsSync(target)) renameSync(current, target)
  throw error
}
