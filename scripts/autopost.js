/**
 * Autopost latest content to social networks.
 * Gated by env flags and tokens. Safe to include in CI.
 */
const { loadSections } = require('./utils/data')
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)))
const fs = require('node:fs')
const path = require('node:path')

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '')
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '')

const ENABLE_FB = /^true$/i.test(process.env.POST_TO_FACEBOOK || '')
const ENABLE_IG = /^true$/i.test(process.env.POST_TO_INSTAGRAM || '')
const ENABLE_WA = /^true$/i.test(process.env.POST_TO_WHATSAPP || '')

const FB_PAGE_ID = process.env.FB_PAGE_ID
const FB_PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN

const IG_USER_ID = process.env.IG_USER_ID
const IG_TOKEN = process.env.IG_ACCESS_TOKEN

const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID
const WA_TOKEN = process.env.WA_TOKEN
const WA_RECIPIENTS = (process.env.WA_RECIPIENTS || '').split(',').map(s=>s.trim()).filter(Boolean)

const STATE_FILE = path.join(__dirname, '..', '.autopost-state.json')

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) } catch { return { posted: {} } }
}
function writeState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)) }

function fullUrl(route) {
  const base = SITE_URL + (BASE_PATH || '')
  return base + route
}

async function postFacebook(message, link) {
  if (!ENABLE_FB || !FB_PAGE_ID || !FB_PAGE_TOKEN) return false
  const url = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`
  const body = new URLSearchParams({ message })
  if (link) body.append('link', link)
  const res = await fetch(url + `?access_token=${encodeURIComponent(FB_PAGE_TOKEN)}`, { method: 'POST', body })
  if (!res.ok) throw new Error(`FB ${res.status}`)
  return true
}

async function postInstagram(caption, imageUrl) {
  if (!ENABLE_IG || !IG_USER_ID || !IG_TOKEN || !imageUrl) return false
  const createUrl = `https://graph.facebook.com/v19.0/${IG_USER_ID}/media?access_token=${encodeURIComponent(IG_TOKEN)}`
  const create = await fetch(createUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: imageUrl, caption }) })
  if (!create.ok) throw new Error(`IG create ${create.status}`)
  const { id } = await create.json()
  const publishUrl = `https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish?access_token=${encodeURIComponent(IG_TOKEN)}`
  const publish = await fetch(publishUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creation_id: id }) })
  if (!publish.ok) throw new Error(`IG publish ${publish.status}`)
  return true
}

async function postWhatsApp(text) {
  if (!ENABLE_WA || !WA_PHONE_ID || !WA_TOKEN || WA_RECIPIENTS.length === 0) return false
  const url = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`
  let ok = true
  for (const to of WA_RECIPIENTS) {
    const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }) })
    ok = ok && res.ok
  }
  return ok
}

function normalizeText(s) { return (s || '').toString().replace(/\s+/g, ' ').trim() }

async function main() {
  const state = readState()
  const sections = await loadSections()
  const lang = 'uk' // default for social text
  const lists = [
    ...['news','spiritual','community'].flatMap(cat => (sections[lang] && sections[lang][cat]) || []),
  ].sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp)))

  const toPost = lists.slice(0, 5).filter(item => {
    const key = `${item.category}|${item.timestamp}|${normalizeText(item.title).slice(0,60)}`
    if (state.posted[key]) return false
    item.__key = key
    return true
  })

  for (const item of toPost) {
    const route = item.url.startsWith('/') ? item.url : '/' + item.url
    const url = SITE_URL ? fullUrl(route) : ''
    const title = normalizeText(item.title)
    const excerpt = normalizeText(item.excerpt || item.details || '')
    const message = [title, excerpt, url].filter(Boolean).join('\n\n')
    try { await postFacebook(message, url) } catch (e) { console.warn('FB post failed:', e.message) }
    try { await postInstagram([title, url].filter(Boolean).join('\n\n'), item.image) } catch (e) { console.warn('IG post failed:', e.message) }
    try { await postWhatsApp([title, url].filter(Boolean).join('\n\n')) } catch (e) { console.warn('WA post failed:', e.message) }
    state.posted[item.__key] = Date.now()
  }

  writeState(state)
  console.log(`Autoposted ${toPost.length} item(s).`)
}

main().catch((e) => { console.error(e); process.exit(1) })

