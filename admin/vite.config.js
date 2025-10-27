import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: '.',
  plugins: [react()],
  server: {
    fs: {
      // allow loading CSS from project root (../assets)
      allow: [path.resolve(__dirname, '..')]
    },
    // Dev helper: serve parent /assets/* via Vite's /@fs mapping
    middlewareMode: false,
    configureServer(server) {
      const rootDir = path.resolve(__dirname, '..')
      const toPosix = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')
      const fsRoot = toPosix(rootDir)
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next()
        if (req.url.startsWith('/assets/')) {
          req.url = `/@fs/${fsRoot}${req.url}`
        } else if (req.url.startsWith('/data/')) {
          req.url = `/@fs/${fsRoot}${req.url}`
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
