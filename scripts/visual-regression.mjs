import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(projectRoot, 'dist')
const contentFilesRoot = resolve(projectRoot, '../package/content-package/files')
const visualRoot = resolve(projectRoot, 'test/visual')
const baselineRoot = resolve(visualRoot, 'baseline')
const currentRoot = resolve(visualRoot, 'current')
const updateBaselines = process.argv.includes('--update')

const viewports = [
  { id: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { id: 'desktop-1366x768', width: 1366, height: 768, mobile: false },
]

const views = [
  { id: 'start', path: '/' },
  { id: 'model-przywodztwa', path: '/page/model-przywodztwa' },
  {
    id: 'model-materialy',
    path: '/page/model-przywodztwa',
    prepare: `(() => {
      const button = Array.from(document.querySelectorAll('.experience-tabs button'))
        .find((element) => element.textContent?.trim() === 'Materiały')
      if (!button) throw new Error('Brak zakładki Materiały w Modelu przywództwa.')
      button.click()
      return new Promise((resolve) => setTimeout(resolve, 450))
    })()`,
  },
  { id: 'narzedzia', path: '/tools' },
  { id: 'planowanie', path: '/planning' },
  { id: 'pulpit', path: '/dashboard' },
  { id: 'ustawienia', path: '/settings' },
  { id: 'instalacja', path: '/install' },
  { id: 'samouczek', path: '/tutorial' },
]

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
}

function safePath(root, pathname) {
  const target = resolve(root, pathname.replace(/^[/\\]+/, ''))
  return target === root || target.startsWith(`${root}${sep}`) ? target : null
}

function startStaticServer() {
  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      const contentPath = pathname.startsWith('/content/files/')
        ? safePath(contentFilesRoot, pathname.slice('/content/files/'.length))
        : null
      const distPath = safePath(distRoot, pathname)
      let filePath = contentPath && existsSync(contentPath) ? contentPath : distPath

      if (filePath && existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = resolve(filePath, 'index.html')
      }
      if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
        filePath = resolve(distRoot, 'index.html')
      }

      response.statusCode = 200
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Content-Type', mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
      response.end(readFileSync(filePath))
    } catch (error) {
      response.statusCode = 500
      response.end(error instanceof Error ? error.message : 'Błąd serwera testowego')
    }
  })

  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('Nie udało się ustalić portu testowego.'))
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${address.port}` })
    })
  })
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)
  const executable = candidates.find((candidate) => existsSync(candidate))
  if (!executable) throw new Error('Nie znaleziono Chrome ani Edge. Ustaw zmienną CHROME_PATH.')
  return executable
}

async function startChrome() {
  const profile = mkdtempSync(resolve(tmpdir(), 'kadrowka-visual-'))
  const chrome = spawn(findChrome(), [
    '--headless=new',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    '--font-render-hinting=none',
    '--no-first-run',
    '--no-default-browser-check',
    '--run-all-compositor-stages-before-draw',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })

  const endpoint = await new Promise((resolvePromise, reject) => {
    let stderr = ''
    const timeout = setTimeout(() => reject(new Error(`Chrome nie uruchomił portu diagnostycznego.\n${stderr}`)), 15000)
    chrome.stderr.setEncoding('utf8')
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (!match) return
      clearTimeout(timeout)
      resolvePromise(match[1])
    })
    chrome.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Chrome zakończył pracę przed testem (kod ${code}).\n${stderr}`))
    })
  })

  return { chrome, endpoint, profile }
}

class CdpClient {
  constructor(endpoint) {
    this.socket = new WebSocket(endpoint)
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.ready = new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }
      const key = `${message.sessionId ?? 'browser'}:${message.method}`
      const listeners = this.listeners.get(key)
      if (!listeners?.length) return
      this.listeners.delete(key)
      for (const listener of listeners) listener.resolve(message.params)
    })
  }

  async send(method, params = {}, sessionId) {
    await this.ready
    const id = this.nextId++
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject })
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  waitFor(method, sessionId, timeoutMs = 15000) {
    const key = `${sessionId ?? 'browser'}:${method}`
    return new Promise((resolvePromise, reject) => {
      const listener = { resolve: resolvePromise, reject }
      const listeners = this.listeners.get(key) ?? []
      listeners.push(listener)
      this.listeners.set(key, listeners)
      setTimeout(() => {
        const active = this.listeners.get(key) ?? []
        this.listeners.set(key, active.filter((item) => item !== listener))
        reject(new Error(`Przekroczono czas oczekiwania na ${method}.`))
      }, timeoutMs)
    })
  }

  close() {
    this.socket.close()
  }
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Błąd JavaScript w testowanej stronie.')
  return result.result?.value
}

async function waitForApp(client, sessionId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await evaluate(
      client,
      sessionId,
      `Boolean(document.querySelector('main .page-stack')) && !document.querySelector('.loading-state')`,
    )
    if (ready) {
      await evaluate(client, sessionId, `document.fonts?.ready ?? Promise.resolve()`)
      await delay(250)
      return
    }
    await delay(100)
  }
  throw new Error('Aplikacja nie zakończyła renderowania widoku.')
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function run() {
  if (!existsSync(resolve(distRoot, 'index.html'))) {
    throw new Error('Brak katalogu dist. Najpierw uruchom build aplikacji.')
  }
  mkdirSync(baselineRoot, { recursive: true })
  rmSync(currentRoot, { recursive: true, force: true })
  mkdirSync(currentRoot, { recursive: true })

  const { server, baseUrl } = await startStaticServer()
  const { chrome, endpoint, profile } = await startChrome()
  const client = new CdpClient(endpoint)
  const failures = []
  const captured = []

  try {
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true })
    await client.send('Page.enable', {}, sessionId)
    await client.send('Runtime.enable', {}, sessionId)

    for (const viewport of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
      }, sessionId)

      for (const view of views) {
        const load = client.waitFor('Page.loadEventFired', sessionId)
        const separator = view.path.includes('?') ? '&' : '?'
        await client.send('Page.navigate', { url: `${baseUrl}${view.path}${separator}visual-test=${view.id}` }, sessionId)
        await load
        await waitForApp(client, sessionId)
        if (view.prepare) await evaluate(client, sessionId, view.prepare)
        await evaluate(client, sessionId, `(() => {
          const style = document.createElement('style')
          style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
          document.head.append(style)
          if (location.pathname === '/settings') {
            const versionValues = document.querySelectorAll('.settings-section dl dd')
            if (versionValues[0]) versionValues[0].textContent = 'wersja-testowa'
            if (versionValues[1]) versionValues[1].textContent = 'data-testowa'
          }
          if (location.pathname === '/dashboard') {
            const summaryValues = document.querySelectorAll('.summary-tile strong')
            const stableCounts = ['0', '0', '0', '1', '0']
            summaryValues.forEach((value, index) => {
              value.textContent = stableCounts[index] ?? '0'
            })
          }
          window.scrollTo(0, 0)
          return true
        })()`)
        await evaluate(
          client,
          sessionId,
          `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
        )
        await delay(100)

        if (view.id === 'model-materialy') {
          // The offline counter races with automatic image caching; keep the screenshot deterministic.
          await evaluate(client, sessionId, `(() => {
            const panel = document.querySelector('.module-offline-control')
            const detail = panel?.querySelector('div span')
            const button = panel?.querySelector('button.secondary-action')
            if (detail) detail.textContent = '78 plików, do 174.8 MB. Pobieranie jest opcjonalne.'
            const label = button && Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)
            if (label) label.textContent = ' Pobierz moduł'
            return true
          })()`)
        }

        const layout = await evaluate(client, sessionId, `(() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          brokenImages: Array.from(document.images)
            .filter((image) => image.complete && image.naturalWidth === 0)
            .map((image) => image.getAttribute('src'))
            .filter(Boolean)
            .slice(0, 10),
        }))()`)
        if (layout.scrollWidth > layout.innerWidth + 1) {
          failures.push(`${view.id}/${viewport.id}: przewijanie poziome ${layout.scrollWidth}px przy ekranie ${layout.innerWidth}px.`)
        }
        if (layout.brokenImages.length) {
          failures.push(`${view.id}/${viewport.id}: niedostępne obrazy: ${layout.brokenImages.join(', ')}.`)
        }

        const screenshot = await client.send('Page.captureScreenshot', {
          format: 'png',
          fromSurface: true,
          captureBeyondViewport: false,
        }, sessionId)
        const fileName = `${view.id}--${viewport.id}.png`
        const currentPath = resolve(currentRoot, fileName)
        const baselinePath = resolve(baselineRoot, fileName)
        writeFileSync(currentPath, Buffer.from(screenshot.data, 'base64'))
        captured.push(fileName)

        if (updateBaselines || !existsSync(baselinePath)) {
          if (updateBaselines) copyFileSync(currentPath, baselinePath)
          else failures.push(`${fileName}: brak obrazu wzorcowego. Uruchom test z parametrem --update.`)
        } else if (sha256(currentPath) !== sha256(baselinePath)) {
          failures.push(`${fileName}: obraz różni się od wzorca.`)
        }
      }
    }
  } finally {
    try {
      await client.send('Browser.close')
    } catch {
      chrome.kill()
    }
    await delay(500)
    client.close()
    if (chrome.exitCode === null) chrome.kill()
    server.close()
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      console.warn(`Windows nadal blokuje tymczasowy profil Chrome: ${profile}`)
    }
  }

  const expected = new Set(viewports.flatMap((viewport) => views.map((view) => `${view.id}--${viewport.id}.png`)))
  const obsolete = readdirSync(baselineRoot).filter((name) => name.endsWith('.png') && !expected.has(name))
  if (obsolete.length) failures.push(`Nieaktualne obrazy wzorcowe: ${obsolete.join(', ')}.`)

  if (failures.length) {
    console.error(`Test wizualny wykrył ${failures.length} problemów:\n- ${failures.join('\n- ')}`)
    console.error(`Bieżące zrzuty: ${relative(projectRoot, currentRoot)}`)
    process.exitCode = 1
    return
  }

  console.log(
    updateBaselines
      ? `Zapisano ${captured.length} obrazów wzorcowych w ${relative(projectRoot, baselineRoot)}.`
      : `Test wizualny: OK (${captured.length} widoków, bez przepełnień i uszkodzonych obrazów).`,
  )
}

await run()
