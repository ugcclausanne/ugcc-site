import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Ensure site CSS loads both in DEV and PROD.
// In DEV we point to the real filesystem via /@fs so that assets from the repo root are available.
if (import.meta.env.DEV) {
  const base = `/@fs/${__FS_ROOT__}/assets/css/`
  const files = ['fonts.css','styles.css','header.css','footer.css','cards.css','overrides.css','admin.css']
  for (const f of files) {
    const href = base + f
    if (!document.querySelector(`link[href="${href}"]`)) {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      document.head.appendChild(l)
    }
  }
} else {
  const base = `/assets/css/`
  const files = ['fonts.css','styles.css','header.css','footer.css','cards.css','overrides.css','admin.css']
  for (const f of files) {
    const href = base + f
    if (!document.querySelector(`link[href="${href}"]`)) {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      document.head.appendChild(l)
    }
  }
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
