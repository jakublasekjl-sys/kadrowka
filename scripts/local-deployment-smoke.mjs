import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const port = Number(process.argv[2] ?? 4181)
const url = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['scripts/serve-release.mjs', String(port)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
server.stdout.on('data', (data) => { serverOutput += data.toString() })
server.stderr.on('data', (data) => { serverOutput += data.toString() })

try {
  let ready = false
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) break
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(300) })
      if (response.ok) { ready = true; break }
    } catch { /* Server may not be listening yet. */ }
    await delay(100)
  }
  if (!ready) throw new Error(`Serwer testowy nie uruchomił się: ${serverOutput.trim()}`)
  process.argv[2] = url
  await import('./deployment-smoke.mjs')
  await import('./materials-deployment-audit.mjs')
} finally {
  if (server.exitCode === null) {
    server.kill()
    await new Promise((resolveExit) => server.once('exit', resolveExit))
  }
}
