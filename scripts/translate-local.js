// Auto-translate missing language entries inside per-item index.json using Libre Translate
// Env: LIBRE_TRANSLATE_URL (default https://libretranslate.com)

require('dotenv').config()
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'data')
const LIBRE_URL = (process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '')

const ALL_LANGS = ['uk', 'en', 'fr']

async function postJSON(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

async function translateText(text, target, source) {
  const t = (text || '').toString()
  if (!t.trim()) return t
  try {
    const data = await postJSON(`${LIBRE_URL}/translate`, { q: t, source: source || 'auto', target, format: 'text' })
    const out = data && data.translatedText
    return out && out.trim() ? out : t
  } catch {
    return t
  }
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '')) } catch { return null }
}

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8')
}

async function ensureTranslationsForFile(filePath, kind) {
  const arr = readJSON(filePath)
  if (!arr) return false
  const items = Array.isArray(arr) ? arr : [arr]
  // Use the first non-empty as source; prefer uk
  const byLang = new Map()
  for (const it of items) byLang.set((it.language || 'uk').toLowerCase(), it)
  const source = byLang.get('uk') || items[0]
  if (!source) return false

  const targets = ALL_LANGS.filter((l) => !byLang.has(l))
  if (!targets.length) return false

  const out = [...items]
  for (const tgt of targets) {
    const clone = { ...source, language: tgt, auto_translated: true }
    if (kind === 'article') {
      clone.title = await translateText(source.title, tgt, source.language)
      clone.excerpt = await translateText(source.excerpt, tgt, source.language)
      clone.content = await translateText(source.content, tgt, source.language)
    } else {
      clone.title = await translateText(source.title, tgt, source.language)
      clone.details = await translateText(source.details, tgt, source.language)
      if (source.location) clone.location = await translateText(source.location, tgt, source.language)
    }
    out.push(clone)
    // avoid hammering the API too fast
    await new Promise((r) => setTimeout(r, 200))
  }
  writeJSON(filePath, out)
  return true
}

async function walkKind(kind) {
  const base = path.join(DATA, kind)
  if (!fs.existsSync(base)) return 0
  let changed = 0
  for (const uid of fs.readdirSync(base)) {
    const dir = path.join(base, uid)
    if (!fs.statSync(dir).isDirectory()) continue
    const idx = path.join(dir, 'index.json')
    if (!fs.existsSync(idx)) continue
    const ok = await ensureTranslationsForFile(idx, kind === 'articles' ? 'article' : 'schedule')
    if (ok) changed++
  }
  return changed
}

;(async function main(){
  const a = await walkKind('articles')
  const s = await walkKind('schedule')
  console.log(`translate-local: updated ${a} article files and ${s} schedule files`)
})().catch((e) => {
  console.error('translate-local failed:', e.message)
  process.exitCode = 1
})

