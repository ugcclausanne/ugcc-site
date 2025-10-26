import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/GithubDeviceAuth.jsx'
import { getJsonFile, listContentDir, putFile, toBase64, getRepo, getBranchSha, createBranch, createPR, enableAutoMerge, listContentDir as ls, deleteFile } from '../services/github.js'
import { translateLibre } from '../services/translate.js'
import { Tabs } from './Tabs.jsx'

export function Articles() {
  const { token, owner, repo } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // { uid }
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
            if (json) results.push({ uid: entry.name, ...json })
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

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const total = items.length
    const byCat = items.reduce((acc, it) => {
      acc[it.category || ''] = (acc[it.category || ''] || 0) + 1
      return acc
    }, {})
    return { total, byCat }
  }, [items])

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button onClick={load} disabled={loading}>Оновити</button>
        <button onClick={() => createNew(owner, repo, token, load)}>Додати статтю</button>
        <span>Всього: {counts.total}</span>
        <span>Новини: {counts.byCat['news'] || 0}</span>
        <span>Духовне: {counts.byCat['spiritual'] || 0}</span>
        <span>Громада: {counts.byCat['community'] || 0}</span>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16, marginTop: 16 }}>
        {items.map((it) => (
          <article key={it.uid} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>{it.title || it.uid}</h3>
            <p style={{ opacity: 0.7 }}>{it.language} · {it.category}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button title="Переглянути" onClick={() => setEditing({ uid: it.uid })}>👁️</button>
              <button title="Редагувати" onClick={() => setEditing({ uid: it.uid })}>✏️</button>
              <button title="Видалити" onClick={() => delItem(owner, repo, token, it.uid, load)}>🗑️</button>
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
  return {
    language: lang,
    category: 'news',
    title: '',
    date: '',
    excerpt: '',
    content: '',
    images: []
  }
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
        if (Array.isArray(data)) {
          for (const it of data) langs[it.language] = { ...langs[it.language], ...it }
        }
        setState({ loading: false, langs, sha: undefined, error: '' })
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: 'Не вдалося завантажити елемент' }))
      }
    })()
    return () => { ok = false }
  }, [owner, repo, token, uid])
  return { ...state, base, path, setState }
}

function Editor({ uid, lang, setLang, onClose, onSaved }) {
  const { token, owner, repo } = useAuth()
  const st = useItem(owner, repo, token, uid)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState([]) // files to upload on save
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

      // Delete marked images (from existing ones)
      if (removed.length) {
        setStatus('Видаляємо зображення…')
        try {
          const ims = await ls(owner, repo, `${st.base}/images`, token)
          const map = new Map(ims.map((im) => [im.name, im.sha]))
          for (const name of removed) {
            const sha = map.get(name)
            if (sha) await deleteFile(owner, repo, `${st.base}/images/${name}`, `delete image ${name}`, token, sha, branch)
          }
        } catch {}
      }

      setStatus('Зберігаємо JSON…')
      const arr = ['uk', 'en', 'fr'].map((k) => {
        const entry = { ...st.langs[k] }
        if (removed.length && Array.isArray(entry.images)) {
          entry.images = entry.images.filter((n) => !removed.includes(n))
        }
        return entry
      })
      const json = JSON.stringify(arr, null, 2)
      const b64 = btoa(unescape(encodeURIComponent(json)))
      await putFile(owner, repo, st.path, b64, `save article ${uid}`, token, undefined, branch)

      setStatus('Створюємо PR…')
      const pr = await createPR(owner, repo, `Content: article ${uid}`, branch, base, 'Edit via admin', token)
      await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
      setStatus(`PR створено: #${pr.number}. Авто-мердж після перевірок.`)
      window.dispatchEvent(new CustomEvent('admin:notice', { detail: 'Зміни збережено. Публікація відбудеться автоматично після перевірок.' }))
      onSaved?.()
    } finally {
      setBusy(false)
    }
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

  if (st.loading) return <div style={{ marginTop: 24 }}>Завантаження…</div>

  const data = st.langs[lang]
  const images = (data.images || []).map((n) => ({ name: n, url: `/data/articles/${uid}/images/${n}` }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)' }}>
      <div style={{ background: '#fff', maxWidth: 1100, margin: '40px auto', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Редагування статті: {uid}</h2>
          <button onClick={onClose}>Закрити</button>
        </div>
        <Tabs tabs={['uk','en','fr']} value={lang} onChange={setLang} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label>Мова
              <input value={data.language} readOnly />
            </label>
            <label>Категорія
              <select value={data.category||'news'} onChange={(e)=>onChange('category', e.target.value)}>
                <option value="news">news</option>
                <option value="spiritual">spiritual</option>
                <option value="community">community</option>
              </select>
            </label>
            <label>Заголовок
              <input value={data.title||''} onChange={(e)=>onChange('title', e.target.value)} />
            </label>
            <label>Дата
              <input type="date" value={data.date||''} onChange={(e)=>onChange('date', e.target.value)} />
            </label>
            <label>Короткий опис
              <textarea value={data.excerpt||''} onChange={(e)=>onChange('excerpt', e.target.value)} />
            </label>
            <label>Текст
              <textarea rows={8} value={data.content||''} onChange={(e)=>onChange('content', e.target.value)} />
            </label>
            <div style={{ marginTop: 8 }}>
              <input type="file" multiple onChange={(e)=>onUpload(e.target.files)} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={busy}>Зберегти (PR)</button>
              <button onClick={translateMissing} disabled={busy} style={{ marginLeft: 8 }}>Translate missing</button>
              {status && <span style={{ marginLeft: 8, fontSize: 12, opacity: .8 }}>{status}</span>}
            </div>
          </div>
          <div>
            <h4>Прев’ю</h4>
            {images[0] ? (
              <img src={images[0].url} alt="hero" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 240, background: '#f0f0f0', display:'flex',alignItems:'center',justifyContent:'center' }}>(нема зображення)</div>
            )}
            <h3 style={{ margin: '12px 0 4px' }}>{data.title||'(без назви)'}</h3>
            <div style={{ opacity: .7, marginBottom: 8 }}>{data.date}</div>
            <div dangerouslySetInnerHTML={{ __html: (data.content||'').replace(/\n/g,'<br/>') }} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap:'wrap' }}>
              {(data.images||[]).map((n, idx) => (
                <div key={n+idx} style={{ position:'relative' }}>
                  <img src={`/data/articles/${uid}/images/${n}`} alt="img" style={{ height: 80 }} />
              <button type="button" onClick={()=>{
                    setRemoved((r)=> r.includes(n)? r : [...r, n])
                    st.setState((s)=> ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: (s.langs[lang].images||[]).filter(x=>x!==n) } } }))
                  }} title="Видалити" style={{ position:'absolute', top:2, right:2, fontSize:11 }}>✕</button>
                  <button type="button" onClick={()=>{
                    // make this image first (hero) for current lang
                    st.setState((s)=>{
                      const imgs = (s.langs[lang].images||[]).filter(x=>x!==n)
                      return { ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: [n, ...imgs] } } }
                    })
                  }} title="Зробити головним" style={{ position:'absolute', bottom:2, right:2, fontSize:11 }}>★</button>
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
  const uid = prompt('ID статті (латиниця, без пробілів):')
  if (!uid) return
  const base = `data/articles/${uid}`
  try {
    const r = await getRepo(owner, repo, token)
    const baseBranch = r.default_branch || 'main'
    const sha = await getBranchSha(owner, repo, baseBranch, token)
    const branch = `content/article-${uid}-${Date.now()}`
    await createBranch(owner, repo, branch, sha, token)
    const arr = [
      { language: 'uk', category: 'news', title: '', date: '', excerpt: '', content: '', images: [] },
      { language: 'en', category: 'news', title: '', date: '', excerpt: '', content: '', images: [] },
      { language: 'fr', category: 'news', title: '', date: '', excerpt: '', content: '', images: [] }
    ]
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(arr, null, 2))))
    await putFile(owner, repo, `${base}/index.json`, b64, `create article ${uid}`, token, undefined, branch)
    const pr = await createPR(owner, repo, `Content: create article ${uid}`, branch, baseBranch, 'Create via admin', token)
    await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
    after?.()
    alert(`PR створено: #${pr.number}`)
  } catch (e) {
    alert('Не вдалося створити статтю: ' + e.message)
  }
}

async function delItem(owner, repo, token, uid, after) {
  if (!confirm(`Видалити статтю ${uid}?`)) return
  const base = `data/articles/${uid}`
  try {
    const r = await getRepo(owner, repo, token)
    const baseBranch = r.default_branch || 'main'
    const sha = await getBranchSha(owner, repo, baseBranch, token)
    const branch = `content/article-del-${uid}-${Date.now()}`
    await createBranch(owner, repo, branch, sha, token)
    // delete index.json
    const meta = await ls(owner, repo, base, token)
    for (const entry of meta) {
      if (entry.type === 'file') {
        await deleteFile(owner, repo, `${base}/${entry.name}`, `delete ${entry.name}`, token, entry.sha, branch)
      } else if (entry.type === 'dir' && entry.name === 'images') {
        const ims = await ls(owner, repo, `${base}/images`, token)
        for (const im of ims) {
          await deleteFile(owner, repo, `${base}/images/${im.name}`, `delete image ${im.name}`, token, im.sha, branch)
        }
      }
    }
    const pr = await createPR(owner, repo, `Content: delete article ${uid}`, branch, baseBranch, 'Delete via admin', token)
    await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
    after?.()
    alert(`PR створено: #${pr.number}`)
  } catch (e) {
    alert('Не вдалося видалити статтю: ' + e.message)
  }
}
