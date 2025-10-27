import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/GithubDeviceAuth.jsx'
import { getJsonFile, listContentDir, putFile, getRepo, getBranchSha, createBranch, createPR, enableAutoMerge, deleteFile } from '../services/github.js'
import { translateLibre } from '../services/translate.js'
import { Tabs } from './Tabs.jsx'

export function Schedule() {
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
      const dirs = await listContentDir(owner, repo, 'data/schedule', token)
      const results = []
      for (const entry of dirs) {
        if (entry.type === 'dir') {
          const p = `data/schedule/${entry.name}/index.json`
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
      setError('Не вдалося завантажити список')
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
        <button className="btn" onClick={() => createNew(owner, repo, token, load)}>Додати подію</button>
        <span>Всього: {counts.total}</span>
        <span>Літургії: {counts.byCat['liturgy'] || 0}</span>
        <span>Оголошення: {counts.byCat['announcement'] || 0}</span>
      </div>

      {error && <p className="badge block">{error}</p>}

      <div className="admin-grid">
        {items.map((it) => (
          <article key={it.uid} className="card-article">
            <h3 className="card-title">{it.title || it.uid}</h3>
            <div className="meta">{it.language} • {it.category} • {it.date} {it.time}</div>
            <div className="admin-toolbar">
              <button className="btn" title="Переглянути" onClick={() => setEditing({ uid: it.uid })}>👁️</button>
              <button className="btn" title="Редагувати" onClick={() => setEditing({ uid: it.uid })}>✎</button>
              <button className="btn" title="Видалити" onClick={() => delItem(owner, repo, token, it.uid, load)}>🗑</button>
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
  return { language: lang, category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] }
}

function useItem(owner, repo, token, uid) {
  const base = `data/schedule/${uid}`
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
      } catch { setState((s)=>({ ...s, loading:false, error:'Не вдалося завантажити подію'})) }
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
  const [status, setStatus] = useState(null)
  const LIBRE = import.meta.env.VITE_LIBRE_TRANSLATE_URL || ''
  const [removed, setRemoved] = useState([])

  const onChange = (field, value) => {
    st.setState((s) => ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], [field]: value } } }))
  }

  const onUpload = async (files) => {
    if (!files || !files.length) return
    const repoInfo = await getRepo(owner, repo, token)
    const base = repoInfo.default_branch
    const baseSha = await getBranchSha(owner, repo, base, token)
    const branch = `content/schedule/${uid}/${Date.now()}`
    await createBranch(owner, repo, branch, baseSha, token).catch(()=>{})
    const updates = []
    for (const f of files) {
      const buf = await f.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      const name = f.name
      await putFile(owner, repo, `${st.base}/images/${name}`, b64, `upload image ${name}`, token, undefined, branch)
      updates.push(name)
    }
    st.setState((s) => ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: [...(s.langs[lang].images||[]), ...updates] } } }))
    setStatus({ text: 'Зображення завантажено (через PR)' })
  }

  const translateMissing = async () => {
    if (!LIBRE) return
    const base = st.langs.uk
    const keys = ['title','details','location']
    const upd = { en: { ...st.langs.en }, fr: { ...st.langs.fr } }
    for (const k of keys) {
      if (!upd.en[k]) upd.en[k] = await translateLibre(LIBRE, base[k], 'en', 'uk')
      if (!upd.fr[k]) upd.fr[k] = await translateLibre(LIBRE, base[k], 'fr', 'uk')
    }
    st.setState((s)=>({ ...s, langs: { uk: s.langs.uk, en: { ...s.langs.en, ...upd.en }, fr: { ...s.langs.fr, ...upd.fr } } }))
  }

  const save = async () => {
    setBusy(true)
    try {
      const repoInfo = await getRepo(owner, repo, token)
      const base = repoInfo.default_branch
      const baseSha = await getBranchSha(owner, repo, base, token)
      const branch = `content/schedule/${uid}/${Date.now()}`
      await createBranch(owner, repo, branch, baseSha, token).catch(()=>{})

      if (removed.length) {
        try {
          const imagesDir = await listContentDir(owner, repo, `${st.base}/images`, token)
          const map = new Map(imagesDir.map((im)=>[im.name, im.sha]))
          for (const name of removed) { const sha = map.get(name); if (sha) await deleteFile(owner, repo, `${st.base}/images/${name}`, `delete image ${name}`, token, sha, branch) }
        } catch {}
      }

      setStatus({ text: 'Оновлення JSON…' })
      const arr = ['uk','en','fr'].map((k)=>{ const entry = { ...st.langs[k] }; if (removed.length && Array.isArray(entry.images)) entry.images = entry.images.filter((n)=>!removed.includes(n)); return entry })
      const json = JSON.stringify(arr, null, 2)
      const b64 = btoa(unescape(encodeURIComponent(json)))
      await putFile(owner, repo, st.path, b64, `save schedule ${uid}`, token, undefined, branch)

      setStatus({ text: 'Створення PR…' })
      const pr = await createPR(owner, repo, `Content: schedule ${uid}`, branch, base, 'Edit via admin', token)
      await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
      const prUrl = `https://github.com/${owner}/${repo}/pull/${pr.number}`
      setStatus({ text: 'PR створено, публікація після мерджу.', prNumber: pr.number, prUrl })
      window.dispatchEvent(new CustomEvent('admin:notice', { detail: `PR створено: #${pr.number}` }))
      onSaved?.()
    } finally { setBusy(false) }
  }

  const confirmDeleteImage = (n) => {
    if (!confirm('Видалити це зображення з галереї?')) return
    setRemoved((r)=> r.includes(n)? r : [...r, n])
    st.setState((s)=> ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: (s.langs[lang].images||[]).filter(x=>x!==n) } } }))
  }

  const makeHero = (n) => {
    st.setState((s)=>{ const imgs=(s.langs[lang].images||[]).filter(x=>x!==n); return { ...s, langs:{ ...s.langs, [lang]: { ...s.langs[lang], images:[n, ...imgs] } } } })
  }

  if (st.loading) return <div className="badge">Завантаження…</div>

  const data = st.langs[lang]
  const images = (data.images || []).map((n) => ({ name: n, url: `/data/schedule/${uid}/images/${n}` }))

  return (
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-toolbar justify-between">
          <h2>Редагування події: {uid}</h2>
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
        <Tabs tabs={['uk','en','fr']} value={lang} onChange={setLang} />

        <div className="admin-grid grid-2">
          <div>
            <label>Мова<input value={data.language} readOnly /></label>
            <label>Категорія
              <select value={data.category||'liturgy'} onChange={(e)=>onChange('category', e.target.value)}>
                <option value="liturgy">liturgy</option>
                <option value="announcement">announcement</option>
              </select>
            </label>
            <label>Заголовок<input value={data.title||''} onChange={(e)=>onChange('title', e.target.value)} /></label>
            <label>Дата<input type="date" value={data.date||''} onChange={(e)=>onChange('date', e.target.value)} /></label>
            <label>Час<input type="time" value={data.time||''} onChange={(e)=>onChange('time', e.target.value)} /></label>
            <label>Місце<input value={data.location||''} onChange={(e)=>onChange('location', e.target.value)} /></label>
            <label>Деталі<textarea rows={6} value={data.details||''} onChange={(e)=>onChange('details', e.target.value)} /></label>
            <div className="admin-toolbar"><input type="file" multiple onChange={(e)=>onUpload(e.target.files)} /></div>
            <div className="admin-toolbar">
              <button className="btn" onClick={save} disabled={busy}>Зберегти (PR)</button>
              <button className="btn" onClick={translateMissing} disabled={busy}>Перекласти відсутні</button>
              {status && (
                <span className="admin-status">
                  {status.text}
                  {status.prUrl ? <a href={status.prUrl} target="_blank" rel="noreferrer">PR #{status.prNumber}</a> : null}
                </span>
              )}
            </div>
          </div>
          <div>
            <h4>Превʼю</h4>
            {images[0] ? (
              <img src={images[0].url} alt="hero" className="preview-hero" />
            ) : (
              <div className="badge">(Немає зображень)</div>
            )}
            <h3 className="mt-md mb-xs">{data.title||'(без назви)'}</h3>
            <div className="muted mb-sm">{data.date} {data.time} • {data.location}</div>
            <div dangerouslySetInnerHTML={{ __html: (data.details||'').replace(/\n/g,'<br/>') }} />
            <div className="admin-thumbs">
              {(data.images||[]).map((n, idx) => (
                <div key={n+idx} className="admin-thumb">
                  <img src={`/data/schedule/${uid}/images/${n}`} alt="img" />
                  <button type="button" className="btn btn-remove" onClick={()=>confirmDeleteImage(n)} title="Видалити">✕</button>
                  <button type="button" className="btn btn-hero" onClick={()=>makeHero(n)} title="Зробити головним">★</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function createNew(owner, repo, token, after) {
  const uid = prompt('UID нової події (латиниця, цифри, -):')
  if (!uid) return
  const base = `data/schedule/${uid}`
  const path = `${base}/index.json`
  const repoInfo = await getRepo(owner, repo, token)
  const defaultBranch = repoInfo.default_branch
  const baseSha = await getBranchSha(owner, repo, defaultBranch, token)
  const branch = `content/schedule/${uid}/${Date.now()}`
  await createBranch(owner, repo, branch, baseSha, token).catch(()=>{})
  const arr = [
    { language: 'uk', category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] },
    { language: 'en', category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] },
    { language: 'fr', category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] }
  ]
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(arr, null, 2))))
  await putFile(owner, repo, path, b64, `create schedule ${uid}`, token, undefined, branch)
  const pr = await createPR(owner, repo, `Content: new schedule ${uid}`, branch, defaultBranch, 'Create via admin', token)
  await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
  window.dispatchEvent(new CustomEvent('admin:notice', { detail: `PR створено: #${pr.number}` }))
  after?.()
}

async function delItem(owner, repo, token, uid, after) {
  if (!confirm('Видалити подію і всі зображення?')) return
  try {
    const repoInfo = await getRepo(owner, repo, token)
    const base = repoInfo.default_branch
    const baseSha = await getBranchSha(owner, repo, base, token)
    const branch = `content/schedule/${uid}/${Date.now()}`
    await createBranch(owner, repo, branch, baseSha, token).catch(()=>{})
    // Delete index.json
    const dir = await listContentDir(owner, repo, `data/schedule/${uid}`, token)
    const map = new Map(dir.map((f)=>[f.name, f.sha]))
    const idxSha = map.get('index.json')
    if (idxSha) await deleteFile(owner, repo, `data/schedule/${uid}/index.json`, `delete schedule ${uid}`, token, idxSha, branch)
    // Delete images if any
    try {
      const imgs = await listContentDir(owner, repo, `data/schedule/${uid}/images`, token)
      for (const im of imgs) {
        await deleteFile(owner, repo, `data/schedule/${uid}/images/${im.name}`, `delete image ${im.name}`, token, im.sha, branch)
      }
    } catch {}
    const pr = await createPR(owner, repo, `Content: delete schedule ${uid}`, branch, base, 'Delete via admin', token)
    await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
    window.dispatchEvent(new CustomEvent('admin:notice', { detail: `PR створено: #${pr.number} (видалення)` }))
  } finally {
    after?.()
  }
}

