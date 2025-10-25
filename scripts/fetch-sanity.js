// Load env from .env if present
try { require('dotenv').config() } catch {}

const fs = require('node:fs')
const path = require('node:path')
const client = require('./sanityClient')
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)))

const ALL_LANGS = ['uk', 'en', 'fr']
// Prefer existing local translations and preserve entries not present in CMS
const PREFER_LOCAL = String(process.env.PREFER_LOCAL ?? 'true').toLowerCase() !== 'false'
const SAFE_MERGE = String(process.env.SAFE_MERGE ?? 'true').toLowerCase() !== 'false'

const PROVIDER = process.env.TRANSLATE_PROVIDER || '' // 'deepl' | 'google' | 'libre'
const DEEPL_KEY = process.env.DEEPL_API_KEY || ''
const GOOGLE_KEY = process.env.GOOGLE_API_KEY || ''
const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com'
const LIBRE_FALLBACK_URL = process.env.LIBRE_TRANSLATE_FALLBACK_URL || 'https://libretranslate.de'
const TRANSLATE_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS || 600)
// Map of prior _id -> slug read from existing data (filled later if files exist)
const idToSlug = new Map()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function translate(text, target, source) {
  const t = (text || '').toString()
  if (!t.trim()) return t
  try {
    if (PROVIDER.toLowerCase() === 'deepl' && DEEPL_KEY) {
      const endpoint = DEEPL_KEY.toLowerCase().includes(':fx') || DEEPL_KEY.startsWith('DEEPL_AUTH_KEY')
        ? 'https://api-free.deepl.com/v2/translate'
        : 'https://api.deepl.com/v2/translate'
      const params = new URLSearchParams()
      params.append('text', t)
      params.append('target_lang', target.toUpperCase())
      if (source) params.append('source_lang', source.toUpperCase())
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })
      if (!res.ok) throw new Error(`DeepL ${res.status}`)
      const data = await res.json()
      return (data.translations && data.translations[0] && data.translations[0].text) || t
    }
    if (PROVIDER.toLowerCase() === 'google' && GOOGLE_KEY) {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`
      const body = { q: t, target, source }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`Google ${res.status}`)
      const data = await res.json()
      return (data.data && data.data.translations && data.data.translations[0] && data.data.translations[0].translatedText) || t
    }
    if (PROVIDER.toLowerCase() === 'libre') {
      const payload = { q: t, source: source || 'auto', target, format: 'text' }
      const call = async (base) => {
        const url = `${base.replace(/\/$/, '')}/translate`
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error(`Libre ${res.status}`)
        const data = await res.json()
        return data.translatedText || t
      }
      try {
        const out = await call(LIBRE_URL)
        if (out && out.trim()) return out
      } catch {}
      const fallback = await call(LIBRE_FALLBACK_URL)
      return fallback
    }
  } catch (e) {
    console.warn(`Translate fail (${source || 'auto'}→${target}):`, e.message)
  }
  return t
}

// No separate cache file. We reuse translations already present in data/articles.json and data/schedule.json

const qArticles = `*[_type=="article"] | order(timestamp desc){
  _id,
  _updatedAt,
  _rev,
  "timestamp": coalesce(timestamp, ""),
  "email": coalesce(email, ""),
  "title": coalesce(title, ""),
  "excerpt": coalesce(excerpt, ""),
  "category": coalesce(category, ""),
  "language": coalesce(language, "uk"),
  "image": coalesce(image.asset->url, ""),
  // plain text from Portable Text to match site's current JSON
  "content": coalesce(pt::text(content), ""),
  "author": coalesce(author, ""),
  "auto_translated": defined(auto_translated) && auto_translated
}`

const qSchedule = `*[_type=="schedule"] | order(timestamp desc){
  _id,
  _updatedAt,
  _rev,
  "timestamp": coalesce(timestamp, ""),
  "date": coalesce(date, ""),
  "time": coalesce(time, ""),
  "category": coalesce(category, ""),
  "title": coalesce(title, ""),
  "details": coalesce(details, ""),
  "location": coalesce(location, ""),
  "language": coalesce(language, "uk"),
  "before_time": coalesce(before_time, ""),
  "before_details": coalesce(before_details, ""),
  "after_time": coalesce(after_time, ""),
  "after_details": coalesce(after_details, ""),
  "image": coalesce(image.asset->url, ""),
  "link": coalesce(link, ""),
  "auto_translated": defined(auto_translated) && auto_translated
}`

async function main() {
  try {
    if (!client) {
      console.error('Sanity client not configured. Set SANITY_PROJECT_ID.')
      process.exit(1)
    }
    let [articles, schedule] = await Promise.all([
      client.fetch(qArticles),
      client.fetch(qSchedule),
    ])

    // No slugs — rely only on _id for identity and URL building

    // Load existing site data to reuse prior translations
    const dataDir = path.join(__dirname, '..', 'data')
    let existingArticles = []
    let existingSchedule = []
    try { const p = path.join(dataDir, 'articles.json'); if (fs.existsSync(p)) existingArticles = JSON.parse(fs.readFileSync(p, 'utf-8')) } catch {}
    try { const p = path.join(dataDir, 'schedule.json'); if (fs.existsSync(p)) existingSchedule = JSON.parse(fs.readFileSync(p, 'utf-8')) } catch {}
    const key = (o) => `${(o._id||'')}|${(o.language||'uk').toLowerCase()}`
    const idxA = new Map(existingArticles.map(x => [key(x), x]))
    const idxS = new Map(existingSchedule.map(x => [key(x), x]))

    // Auto-translate into missing languages (in-memory for site JSON)
    async function ensureTranslations(items, type) {
      const out = [...items]; const present = new Set(out.map(key))
      // Ensure all target languages exist. First try existing data, then translate.
      for (const item of items) {
        const srcLang = (item.language || 'uk').toLowerCase()
        const targets = ALL_LANGS.filter((l) => l !== srcLang)
        // Check by _id + language
        for (const tgt of targets) {
          const exists = out.find((x) => (x._id||'') === (item._id||'') && (x.language||'') === tgt)
          if (exists) continue
          // 1) Try existing site data first
          const idx = type === 'article' ? idxA : idxS
          const prior = idx.get(`${item._id||''}|${tgt}`)
          if (prior) { out.push(prior); continue }
          // 2) Else translate now
          const provider = (PROVIDER || '').toLowerCase()
          const canTranslate = (provider === 'deepl' && !!DEEPL_KEY) || (provider === 'google' && !!GOOGLE_KEY) || (provider === 'libre')
          if (canTranslate) {
            const translated = { ...item, language: tgt, auto_translated: true }
            if (type === 'article') {
              translated.title = await translate(item.title, tgt, srcLang)
              await sleep(TRANSLATE_DELAY_MS)
              translated.excerpt = await translate(item.excerpt, tgt, srcLang)
              await sleep(TRANSLATE_DELAY_MS)
              translated.content = await translate(item.content, tgt, srcLang)
            } else {
              translated.title = await translate(item.title, tgt, srcLang)
              await sleep(TRANSLATE_DELAY_MS)
              translated.details = await translate(item.details, tgt, srcLang)
              // optional location translation
              translated.location = item.location ? await translate(item.location, tgt, srcLang) : item.location
            }
            out.push(translated); present.add(key(translated))
          }
        }
      }
      return out
    }

    // Merge with existing: keep newest by _updatedAt/_rev; also keep existing entries not returned by CMS if SAFE_MERGE
    function mergeWithExisting(items, type){
      const existingIdx = type === 'article' ? idxA : idxS
      const res = new Map()
      if (SAFE_MERGE) {
        const arr = type === 'article' ? existingArticles : existingSchedule
        for (const x of arr) res.set(key(x), x)
      }
      for (const it of items){
        const k = key(it)
        const prior = existingIdx.get(k)
        if (!prior) { res.set(k, it); continue }
        const a = String(prior._updatedAt||'')
        const b = String(it._updatedAt||'')
        const newer = (b && (!a || b > a)) || (it._rev && it._rev !== prior._rev)
        res.set(k, newer ? it : prior)
      }
      return Array.from(res.values())
    }

    const beforeA = articles.length
    const beforeS = schedule.length
    articles = mergeWithExisting(await ensureTranslations(articles, 'article'), 'article')
    schedule = mergeWithExisting(await ensureTranslations(schedule, 'schedule'), 'schedule')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, {recursive: true})
    fs.writeFileSync(path.join(dataDir, 'articles.json'), JSON.stringify(articles, null, 2))
    fs.writeFileSync(path.join(dataDir, 'schedule.json'), JSON.stringify(schedule, null, 2))
    const addedA = articles.length - beforeA
    const addedS = schedule.length - beforeS
    const provider = (PROVIDER || '').toLowerCase() || 'none'
    console.log(`Wrote ${articles.length} articles (+${addedA}) and ${schedule.length} schedule items (+${addedS}). Translator: ${provider}`)
  } catch (e) {
    console.error('Failed to fetch from Sanity:', e.message)
    process.exit(1)
  }
}

main()
