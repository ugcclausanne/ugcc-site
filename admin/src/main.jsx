import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Import site CSS directly so Vite resolves paths correctly

const root = createRoot(document.getElementById('root'))
root.render(<App />)
