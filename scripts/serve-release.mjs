import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configuredBlobOrigin, pinBlobOriginInCsp } from './security-headers.mjs'

const root = resolve(fileURLToPath(new URL('../release/kadrowka-web/', import.meta.url)))
const port = Number(process.argv[2] ?? 4174)
if (!existsSync(resolve(root, 'index.html'))) throw new Error('Brak paczki release/kadrowka-web.')
const blobOrigin = configuredBlobOrigin(JSON.parse(readFileSync(resolve(root, 'runtime-config.json'), 'utf8')))

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function sendFile(response, path) {
  const stat = statSync(path)
  response.statusCode = 200
  if (path.endsWith('runtime-config.json') || path.endsWith('index.html') || path.endsWith('sw.js')) {
    response.setHeader('Cache-Control', 'no-store, max-age=0')
  }
  response.setHeader('Content-Type', contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream')
  response.setHeader('Content-Length', String(stat.size))
  if (response.req.method === 'HEAD') response.end()
  else createReadStream(path).pipe(response)
}

createServer((request, response) => {
  response.setHeader('Content-Security-Policy', pinBlobOriginInCsp("default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://login.microsoftonline.com; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; frame-src 'none'", blobOrigin))
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.statusCode = 405
    response.setHeader('Allow', 'GET, HEAD')
    response.end()
    return
  }
  let pathname = ''
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    response.statusCode = 400
    response.end()
    return
  }
  if (pathname.split('/').some((part) => part.startsWith('.')) || /^\/(?:src|scripts|test|docs|android|node_modules)(?:\/|$)/i.test(pathname)) {
    response.statusCode = 404
    response.end()
    return
  }
  const requestedPath = resolve(root, pathname.replace(/^[/\\]+/, ''))
  if (requestedPath !== root && !requestedPath.startsWith(root + sep)) {
    response.statusCode = 403
    response.end()
    return
  }
  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    sendFile(response, requestedPath)
    return
  }
  if (pathname === '/content/files' || pathname.startsWith('/content/files/')) {
    response.statusCode = 404
    response.end()
    return
  }
  if (/\.[a-z0-9]{1,10}$/i.test(pathname)) {
    response.statusCode = 404
    response.end()
    return
  }
  sendFile(response, resolve(root, 'index.html'))
}).listen(port, '127.0.0.1', () => {
  console.log(`Paczka działa pod adresem http://127.0.0.1:${port}`)
})
