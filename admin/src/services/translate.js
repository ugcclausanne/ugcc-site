export async function translateLibre(baseUrl, text, target, source) {
  const t = (text || '').toString()
  if (!t.trim()) return t
  const url = (baseUrl || '').replace(/\/$/, '') + '/translate'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: t, source: source || 'auto', target, format: 'text' })
    })
    if (!res.ok) return t
    const data = await res.json()
    const out = data && data.translatedText
    return out && out.trim() ? out : t
  } catch {
    return t
  }
}

