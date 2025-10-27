import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Import site CSS directly so Vite resolves paths correctly
import '../../assets/css/fonts.css'
import '../../assets/css/styles.css'
import '../../assets/css/header.css'
import '../../assets/css/footer.css'
import '../../assets/css/cards.css'
import '../../assets/css/overrides.css'

const root = createRoot(document.getElementById('root'))
root.render(<App />)
