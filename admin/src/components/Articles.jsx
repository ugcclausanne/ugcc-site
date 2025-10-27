import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/GithubDeviceAuth.jsx'
import { getJsonFile, listContentDir, putFile, getRepo, getBranchSha, createBranch, createPR, enableAutoMerge, listContentDir as ls, deleteFile } from '../services/github.js'
import { translateLibre } from '../services/translate.js'
import { Tabs } from './Tabs.jsx'

export function Articles() {
  const { token, owner, repo } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [lang, setLang] = useState('uk')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const dirs = await listContentDir(owner, repo, 'data/articles', token)
      const results = []
      for (const entry of dirs) {
        if (entry.type === 'dir') {
          const p = `data/articles/${entry.name}/index.json`
          try {
            const json = await getJsonFile(owner, repo, p, token)
            if (json) {
              let preview = json
              if (Array.isArray(json)) {
                const map = {}
                for (const it of json) if (it && it.language) map[(it.language||'').toLowerCase()] = it
                preview = map.uk || json[0]
              }
              results.push({ uid: entry.name, ...(preview||{}) })
            }
          } catch {}
        }
      }
      setItems(results)
    } catch (e) {
      setError('Не вдалося завантажити статті')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const total = items.length
    const byCat = items.reduce((acc, it) => { acc[it.category||'']=(acc[it.category||'']||0)+1; return acc }, {})
    return { total, byCat }
  }, [items])

  return (
    <div>
      <div className="admin-toolbar">
        <button className="btn" onClick={load} disabled={loading}>Оновити</button>
        <button className="btn" onClick={() => createNew(owner, repo, token, load)}>Додати статтю</button>
        <span>Всього: {counts.total}</span>
        <span>Новини: {counts.byCat['news'] || 0}</span>
        <span>Духовне: {counts.byCat['spiritual'] || 0}</span>
        <span>Громада: {counts.byCat['community'] || 0}</span>
      </div>

      {error && <p className="badge" style={{ display: 'inline-block' }}>{error}</p>}

      <div className="admin-grid">
        {items.map((it) => (
          <article key={it.uid} className="card-article">
            <h3 className="card-title">{it.title || it.uid}</h3>
            <div className="meta">{it.language} · {it.category}</div>
            <div className="admin-toolbar">
              <button className="btn" title="Переглянути" onClick={() => setEditing({ uid: it.uid })}>👁️</button>
              <button className="btn" title="Редагувати" onClick={() => setEditing({ uid: it.uid })}>✏️</button>
              <button className="btn" title="Видалити" onClick={() => delItem(owner, repo, token, it.uid, load)}>🗑️</button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <Editor uid={editing.uid} lang={lang} setLang={setLang} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  )
}

function emptyLang(lang) {
  return { language: lang, category: 'news', title: '', date: '', excerpt: '', content: '', images: [] }
}

function useItem(owner, repo, token, uid) {
  const base = `data/articles/${uid}`
  const path = `${base}/index.json`
  const [state, setState] = useState({ loading: true, langs: { uk: emptyLang('uk'), en: emptyLang('en'), fr: emptyLang('fr') }, sha: undefined, error: '' })
  useEffect(() => {
    let ok = true
    ;(async () => {
      try {
        const data = await getJsonFile(owner, repo, path, token)
        if (!ok) return
        const langs = { uk: emptyLang('uk'), en: emptyLang('en'), fr: emptyLang('fr') }
        if (Array.isArray(data)) { for (const it of data) langs[(it.language||'').toLowerCase()] = { ...langs[(it.language||'').toLowerCase()], ...it } }
        setState({ loading: false, langs, sha: undefined, error: '' })
      } catch { setState((s)=>({ ...s, loading:false, error:'Не вдалося завантажити елемент'})) }
    })()
    return () => { ok = false }
  }, [owner, repo, token, uid])
  return { ...state, base, path, setState }
}

function Editor({ uid, lang, setLang, onClose, onSaved }) {
  const { token, owner, repo } = useAuth()
  const st = useItem(owner, repo, token, uid)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState([])
  const [status, setStatus] = useState('')
  const LIBRE = import.meta.env.VITE_LIBRE_TRANSLATE_URL || ''
  const [removed, setRemoved] = useState([])

  const onChange = (field, value) => {
    st.setState((s) => ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], [field]: value } } }))
  }

  const onUpload = async (files) => {
    if (!files?.length) return
    const arr = Array.from(files)
    setPending((p)=>[...p, ...arr])
    st.setState((s) => ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: [...(s.langs[lang].images||[]), ...arr.map(f=>f.name)] } } }))
  }

  const translateMissing = async () => {
    const langs = ['uk','en','fr']
    const src = st.langs.uk || st.langs[langs.find(l=>st.langs[l]?.title)]
    if (!src) return
    for (const l of langs) {
      if (st.langs[l]?.title) continue
      const t = { ...st.langs[l], language: l }
      t.title = await translateLibre(LIBRE, src.title, l, src.language)
      t.excerpt = await translateLibre(LIBRE, src.excerpt, l, src.language)
      t.content = await translateLibre(LIBRE, src.content, l, src.language)
      st.setState((s)=>({ ...s, langs: { ...s.langs, [l]: t } }))
      await new Promise(r=>setTimeout(r,150))
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      setStatus('Готуємо гілку…')
      const r = await getRepo(owner, repo, token)
      const base = r.default_branch || 'main'
      const sha = await getBranchSha(owner, repo, base, token)
      const branch = `content/article-${uid}-${Date.now()}`
      await createBranch(owner, repo, branch, sha, token)

      setStatus('Завантажуємо зображення…')
      for (const f of pending) {
        const buf = await f.arrayBuffer()
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        const p = `${st.base}/images/${f.name}`
        await putFile(owner, repo, p, b64, `upload image ${f.name}`, token, undefined, branch)
      }

      if (removed.length) {
        try {
          const ims = await ls(owner, repo, `${st.base}/images`, token)
          const map = new Map(ims.map((im)=>[im.name, im.sha]))
          for (const name of removed) { const sha = map.get(name); if (sha) await deleteFile(owner, repo, `${st.base}/images/${name}`, `delete image ${name}`, token, sha, branch) }
        } catch {}
      }

      setStatus('Зберігаємо JSON…')
      const arr = ['uk','en','fr'].map((k)=>{ const entry = { ...st.langs[k] }; if (removed.length && Array.isArray(entry.images)) entry.images = entry.images.filter((n)=>!removed.includes(n)); return entry })
      const json = JSON.stringify(arr, null, 2)
      const b64 = btoa(unescape(encodeURIComponent(json)))
      await putFile(owner, repo, st.path, b64, `save article ${uid}`, token, undefined, branch)

      setStatus('Створюємо PR…')
      const pr = await createPR(owner, repo, `Content: article ${uid}`, branch, base, 'Edit via admin', token)
      await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
      setStatus(`PR створено: #${pr.number}. Авто-мердж після перевірок.`)
      window.dispatchEvent(new CustomEvent('admin:notice', { detail: 'Зміни збережено. Публікація відбудеться автоматично після перевірок.' }))
      onSaved?.()
    } finally { setBusy(false) }
  }

  if (st.loading) return <div className=\"badge\">Завантаження…</div>

  const data = st.langs[lang]
  const images = (data.images || []).map((n) => ({ name: n, url: `/data/articles/${uid}/images/${n}` }))

  return (
    <div className=\"admin-overlay\">
      <div className=\"admin-modal\">
        <div className=\"admin-toolbar\" style={{ justifyContent:'space-between' }}>
          <h2>Редагування статті: {uid}</h2>
          <button className=\"btn\" onClick={onClose}>Закрити</button>
        </div>
        <Tabs tabs={['uk','en','fr']} value={lang} onChange={setLang} />

        <div className=\"admin-grid\" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label>Мова<input value={data.language} readOnly /></label>
            <label>Категорія
              <select value={data.category||'news'} onChange={(e)=>onChange('category', e.target.value)}>
                <option value=\"news\">news</option>
                <option value=\"spiritual\">spiritual</option>
                <option value=\"community\">community</option>
              </select>
            </label>
            <label>Заголовок<input value={data.title||''} onChange={(e)=>onChange('title', e.target.value)} /></label>
            <label>Дата<input type=\"date\" value={data.date||''} onChange={(e)=>onChange('date', e.target.value)} /></label>
            <label>Короткий опис<textarea value={data.excerpt||''} onChange={(e)=>onChange('excerpt', e.target.value)} /></label>
            <label>Текст<textarea rows={8} value={data.content||''} onChange={(e)=>onChange('content', e.target.value)} /></label>
            <div className=\"admin-toolbar\"><input type=\"file\" multiple onChange={(e)=>onUpload(e.target.files)} /></div>
            <div className=\"admin-toolbar\">
              <button className=\"btn\" onClick={save} disabled={busy}>Зберегти (PR)</button>
              <button className=\"btn\" onClick={translateMissing} disabled={busy}>Translate missing</button>
              {status && <span className=\"badge\">{status}</span>}
            </div>
          </div>
          <div>
            <h4>Прев’ю</h4>
            {images[0] ? (
              <img src={images[0].url} alt=\"hero\" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
            ) : (
              <div className=\"badge\">(нема зображення)</div>
            )}
            <h3 style={{ margin: '12px 0 4px' }}>{data.title||'(без назви)'}</h3>
            <div style={{ opacity: .7, marginBottom: 8 }}>{data.date}</div>
            <div dangerouslySetInnerHTML={{ __html: (data.content||'').replace(/\\n/g,'<br/>') }} />
            <div className=\"admin-thumbs\">
              {(data.images||[]).map((n, idx) => (
                <div key={n+idx} className=\"admin-thumb\">
                  <img src={\`/data/articles/${uid}/images/${n}\`} alt=\"img\" />
                  <button type=\"button\" className=\"btn btn-remove\" onClick={()=>{ setRemoved((r)=> r.includes(n)? r : [...r, n]); st.setState((s)=> ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: (s.langs[lang].images||[]).filter(x=>x!==n) } } })) }} title=\"Видалити\">✕</button>
                  <button type=\"button\" className=\"btn btn-hero\" onClick={()=>{ st.setState((s)=>{ const imgs=(s.langs[lang].images||[]).filter(x=>x!==n); return { ...s, langs:{ ...s.langs, [lang]: { ...s.langs[lang], images:[n, ...imgs] } } } }) }} title=\"Зробити головним\">★</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
