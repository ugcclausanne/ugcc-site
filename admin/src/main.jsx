import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Ensure site CSS loads: always use absolute /assets paths.
{
  const base = `/assets/css/`
  const files = ['fonts.css','styles.css','header.css','footer.css','cards.css','overrides.css','admin.css']
  for (const f of files) {
    const href = base + f
    if (!document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = href
      document.head.appendChild(l)
    }
  }
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
