import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const rootDir = path.resolve(__dirname, '..')
const toPosix = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')
const fsRoot = toPosix(rootDir)

export default defineConfig({
  root: '.',
  plugins: [react()],
  define: {
    __FS_ROOT__: JSON.stringify(fsRoot)
  },
  server: {
    fs: {
      // allow loading CSS from project root (../assets)
      allow: [path.resolve(__dirname, '..')]
    },
    // Dev helper: map /assets and /data to the repo root via proxy bypass (runs early)
    middlewareMode: false,
    proxy: {
      '/assets': {
        target: 'http://local-proxy',
        bypass(req) {
          if (!req.url) return false
          req.url = `/@fs/${fsRoot}${req.url}`
          return req.url
        }
      },
      '/data': {
        target: 'http://local-proxy',
        bypass(req) {
          if (!req.url) return false
          req.url = `/@fs/${fsRoot}${req.url}`
          return req.url
        }
      }
    },
    configureServer(server) {
      const guess = (p) => {
        const ext = p.toLowerCase().split('.').pop()
        switch (ext) {
          case 'css': return 'text/css'
          case 'js': return 'application/javascript'
          case 'json': return 'application/json'
          case 'svg': return 'image/svg+xml'
          case 'png': return 'image/png'
          case 'jpg':
          case 'jpeg': return 'image/jpeg'
          case 'webp': return 'image/webp'
          case 'gif': return 'image/gif'
          default: return 'application/octet-stream'
        }
      }
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const urlPath = req.url.split('?')[0]
        if (urlPath === '/favicon.ico' || urlPath.startsWith('/assets/') || urlPath.startsWith('/data/')) {
          const rel = decodeURIComponent(urlPath.replace(/^\/+/, ''))
          const abs = path.resolve(rootDir, rel)
          if (!abs.startsWith(rootDir)) return next() // safety
          fs.stat(abs, (err, stat) => {
            if (err || !stat || !stat.isFile()) return next()
            res.statusCode = 200
            res.setHeader('Content-Type', guess(abs))
            res.setHeader('Cache-Control', 'no-store')
            fs.createReadStream(abs).pipe(res)
          })
          return
        }
        next()
      })
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
