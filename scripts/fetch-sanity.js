// Load env from .env if present
try { require('dotenv').config() } catch {}

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const client = require('./sanityClient')
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)))

const ALL_LANGS = ['uk', 'en', 'fr']

const PROVIDER = process.env.TRANSLATE_PROVIDER || '' // 'deepl' | 'google' | 'libre'
const DEEPL_KEY = process.env.DEEPL_API_KEY || ''
const GOOGLE_KEY = process.env.GOOGLE_API_KEY || ''
const LIBRE_URL = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com'
const LIBRE_FALLBACK_URL = process.env.LIBRE_TRANSLATE_FALLBACK_URL || 'https://libretranslate.de'
const TRANSLATE_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS || 200)

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

// Persistent translation cache stored in repo: data/translation-cache.json
const cachePath = path.join(__dirname, '..', 'data', 'translation-cache.json')
function readCache() {
  try { return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) } catch { return {} }
}
function writeCache(obj) {
  fs.writeFileSync(cachePath, JSON.stringify(obj, null, 2))
}
function hashKey(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16)
}
function makeKey(item, type) {
  const srcLang = (item.language || 'uk').toLowerCase()
  const ts = String(item.timestamp || '')
  const cat = String(item.category || type)
  const baseText = type === 'article'
    ? [item.title, item.excerpt, item.content].join('\n')
    : [item.title, item.details, item.location].join('\n')
  return `${type}:${srcLang}:${ts}:${cat}:${hashKey(baseText)}`
}

const qArticles = `*[_type=="article"] | order(timestamp desc){
  _id,
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

    // Assign stable slug shared across languages, based on timestamp (fallback to _id)
    const seenSlugs = new Map()
    function slugFromTs(item) {
      const ts = String(item.timestamp || '').replace(' ', 'T')
      const d = new Date(ts)
      const base = (!isNaN(d) ? `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCHours()).padStart(2,'0')}${String(d.getUTCMinutes()).padStart(2,'0')}` : '') || (item._id ? String(item._id).slice(0,8) : 'item')
      const groupKey = `${base}|${item.category||''}`
      const count = (seenSlugs.get(groupKey) || 0) + 1
      seenSlugs.set(groupKey, count)
      return count > 1 ? `${base}-${count}` : base
    }
    for (const a of articles) a.slug = slugFromTs(a)
    for (const s of schedule) s.slug = slugFromTs(s)

    // Auto-translate into missing languages (in-memory for site JSON)
    async function ensureTranslations(items, type) {
      const cache = readCache()
      let cacheTouched = false
      const out = [...items]
      // group key: timestamp + category + title (source language)
      for (const item of items) {
        const srcLang = (item.language || 'uk').toLowerCase()
        const baseKey = makeKey(item, type)
        const targets = ALL_LANGS.filter((l) => l !== srcLang)
        // Check existing items with the same timestamp+category+title in other languages
        for (const tgt of targets) {
          const exists = out.find((x) =>
            (x.timestamp || '') === (item.timestamp || '') &&
            (x.category || '') === (item.category || '') &&
            (x.language || '') === tgt
          )
          if (exists) continue
          // 1) Try cache first
          const key = `${baseKey}->${tgt}`
          const cached = cache[key]
          if (cached) {
            out.push({ ...item, ...cached, slug: item.slug, language: tgt, auto_translated: true })
            continue
          }
          // 2) If provider configured, translate now and store
          const provider = (PROVIDER || '').toLowerCase()
          const canTranslate = (provider === 'deepl' && !!DEEPL_KEY) || (provider === 'google' && !!GOOGLE_KEY) || (provider === 'libre')
          if (canTranslate) {
            const translated = { ...item, slug: item.slug, language: tgt, auto_translated: true }
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
            out.push(translated)
            // store minimal diff in cache
            const store = type === 'article'
              ? { title: translated.title, excerpt: translated.excerpt, content: translated.content }
              : { title: translated.title, details: translated.details, location: translated.location }
            cache[key] = store
            cacheTouched = true
          }
        }
      }
      if (cacheTouched) writeCache(cache)
      return out
    }

    const beforeA = articles.length
    const beforeS = schedule.length
    articles = await ensureTranslations(articles, 'article')
    schedule = await ensureTranslations(schedule, 'schedule')
    const dataDir = path.join(__dirname, '..', 'data')
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
