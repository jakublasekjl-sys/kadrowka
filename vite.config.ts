import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const contentRoot = resolve(__dirname, '../package/content-package')
const packageMetadata = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version?: string }
const buildDate = new Date().toISOString()

function contentPathKey(path: string) {
  return path.replaceAll('\\', '/').normalize('NFC').toLocaleLowerCase('pl')
}

function buildContentFileIndex(root: string) {
  const index = new Map<string, string>()
  if (!existsSync(root)) return index
  const pending = [root]
  while (pending.length) {
    const directory = pending.pop()!
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = resolve(directory, entry.name)
      if (entry.isDirectory()) pending.push(fullPath)
      else if (entry.isFile()) index.set(contentPathKey(relative(root, fullPath)), fullPath)
    }
  }
  return index
}

function externalContentPlugin(): Plugin {
  const filesRoot = resolve(contentRoot, 'files')
  const fileIndex = buildContentFileIndex(filesRoot)
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  }

  return {
    name: 'kadrowka-external-content',
    configureServer(server) {
      server.middlewares.use('/content/files', (request, response, next) => {
        const url = request.url?.split('?')[0] ?? ''
        let relative = ''
        try {
          relative = decodeURIComponent(url).replace(/^[/\\]+/, '')
        } catch {
          response.statusCode = 400
          response.end()
          return
        }
        if (relative.includes('\0') || relative.split(/[\\/]/).some((part) => part === '..')) {
          response.statusCode = 403
          response.end()
          return
        }
        if (/\.aspx$/i.test(relative)) {
          response.statusCode = 404
          response.end()
          return
        }
        const requestedPath = resolve(filesRoot, relative)
        const allowedRoot = filesRoot + sep
        if (!requestedPath.startsWith(allowedRoot)) {
          next()
          return
        }
        const filePath = existsSync(requestedPath)
          ? requestedPath
          : fileIndex.get(contentPathKey(relative))
        if (!filePath) {
          next()
          return
        }
        const stat = statSync(filePath)
        if (!stat.isFile()) {
          next()
          return
        }
        response.setHeader(
          'Content-Type',
          mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        )
        response.setHeader('Content-Length', String(stat.size))
        createReadStream(filePath).pipe(response)
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version ?? '0.0.0'),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [
    react(),
    externalContentPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-v2.png',
        'kadrowka-logo-v2.png',
        'icons/icon-192-v2.png',
        'icons/icon-512-v2.png',
        'icons/icon-maskable-512-v2.png',
        'icons/apple-touch-icon-180-v2.png',
      ],
      manifest: {
        name: 'Kadrówka',
        short_name: 'Kadrówka',
        description: 'Aplikacja dla kadry ZHP',
        theme_color: '#5B2A86',
        background_color: '#f8f6fa',
        lang: 'pl',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-v2.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512-v2.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        globIgnores: ['runtime-config.json', 'staticwebapp.config.json'],
        navigateFallbackDenylist: [/^\/content\/files\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/content/files/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kadrowka-materialy-v3',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true },
            },
          },
          {
            urlPattern: /^https:\/\/[^/]+\.blob\.core\.windows\.net\/.+\/releases\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kadrowka-materialy-v3',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ],
})
