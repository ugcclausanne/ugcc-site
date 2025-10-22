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
      const url = `${LIBRE_URL.replace(/\/$/, '')}/translate`
      const payload = { q: t, source: source || 'auto', target, format: 'text' }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(`Libre ${res.status}`)
      const data = await res.json()
      return (data.translatedText) || t
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
            out.push({ ...item, ...cached, language: tgt, auto_translated: true })
            continue
          }
          // 2) If provider configured, translate now and store
          if (PROVIDER && (DEEPL_KEY || GOOGLE_KEY)) {
            const translated = { ...item, language: tgt, auto_translated: true }
            if (type === 'article') {
              translated.title = await translate(item.title, tgt, srcLang)
              translated.excerpt = await translate(item.excerpt, tgt, srcLang)
              translated.content = await translate(item.content, tgt, srcLang)
            } else {
              translated.title = await translate(item.title, tgt, srcLang)
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

    articles = await ensureTranslations(articles, 'article')
    schedule = await ensureTranslations(schedule, 'schedule')
    const dataDir = path.join(__dirname, '..', 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, {recursive: true})
    fs.writeFileSync(path.join(dataDir, 'articles.json'), JSON.stringify(articles, null, 2))
    fs.writeFileSync(path.join(dataDir, 'schedule.json'), JSON.stringify(schedule, null, 2))
    console.log(`Wrote ${articles.length} articles and ${schedule.length} schedule items`)
  } catch (e) {
    console.error('Failed to fetch from Sanity:', e.message)
    process.exit(1)
  }
}

main()
