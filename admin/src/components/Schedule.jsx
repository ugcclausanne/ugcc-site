import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/GithubDeviceAuth.jsx'
import { getJsonFile, listContentDir, putFile, getRepo, getBranchSha, createBranch, createPR, enableAutoMerge, listContentDir as ls, deleteFile } from '../services/github.js'
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
            if (json) results.push({ uid: entry.name, ...json })
          } catch {}
        } else if (entry.type === 'file' && entry.name.endsWith('.json')) {
          try {
            const json = await getJsonFile(owner, repo, `data/schedule/${entry.name}`, token)
            if (json) results.push({ uid: entry.name.replace(/\.json$/,' '), ...json })
          } catch {}
        }
      }
      setItems(results)
    } catch (e) {
      setError('Не вдалося завантажити розклад')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const total = items.length
    const byKind = items.reduce((acc, it) => {
      acc[it.kind || it.type || ''] = (acc[it.kind || it.type || ''] || 0) + 1
      return acc
    }, {})
    return { total, byKind }
  }, [items])

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <button onClick={load} disabled={loading}>Оновити</button>
        <button onClick={() => alert('TODO: форма додавання')}>Додати подію</button>
        <span>Всього: {counts.total}</span>
        <span>Літургії: {counts.byKind['liturgy'] || 0}</span>
        <span>Оголошення: {counts.byKind['announcement'] || 0}</span>
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
              <button title="Видалити" onClick={() => alert('TODO: видалення')}>🗑️</button>
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
    category: 'liturgy',
    title: '',
    date: '',
    time: '',
    location: '',
    details: '',
    images: []
  }
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
  const [pending, setPending] = useState([])
  const [status, setStatus] = useState('')
  const LIBRE = import.meta.env.VITE_LIBRE_TRANSLATE_URL || ''

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
      const branch = `content/schedule-${uid}-${Date.now()}`
      await createBranch(owner, repo, branch, sha, token)

      setStatus('Завантажуємо зображення…')
      for (const f of pending) {
        const buf = await f.arrayBuffer()
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        const p = `${st.base}/images/${f.name}`
        await putFile(owner, repo, p, b64, `upload image ${f.name}`, token, undefined, branch)
      }

      // Delete marked images (from existing ones) — reuse 'pending' as uploads, add parallel removed
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
      await putFile(owner, repo, st.path, b64, `save schedule ${uid}`, token, undefined, branch)

      setStatus('Створюємо PR…')
      const pr = await createPR(owner, repo, `Content: schedule ${uid}`, branch, base, 'Edit via admin', token)
      await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
      setStatus(`PR створено: #${pr.number}. Авто-мердж після перевірок.`)
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
      t.details = await translateLibre(LIBRE, src.details, l, src.language)
      if (src.location) t.location = await translateLibre(LIBRE, src.location, l, src.language)
      st.setState((s)=>({ ...s, langs: { ...s.langs, [l]: t } }))
      await new Promise(r=>setTimeout(r,150))
    }
  }

  if (st.loading) return <div style={{ marginTop: 24 }}>Завантаження…</div>

  const data = st.langs[lang]
  const images = (data.images || []).map((n) => ({ name: n, url: `/data/schedule/${uid}/images/${n}` }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)' }}>
      <div style={{ background: '#fff', maxWidth: 1100, margin: '40px auto', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Редагування події: {uid}</h2>
          <button onClick={onClose}>Закрити</button>
        </div>
        <Tabs tabs={['uk','en','fr']} value={lang} onChange={setLang} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label>Мова
              <input value={data.language} readOnly />
            </label>
            <label>Категорія
              <select value={data.category||'liturgy'} onChange={(e)=>onChange('category', e.target.value)}>
                <option value="liturgy">liturgy</option>
                <option value="announcement">announcement</option>
              </select>
            </label>
            <label>Заголовок
              <input value={data.title||''} onChange={(e)=>onChange('title', e.target.value)} />
            </label>
            <label>Дата
              <input type="date" value={data.date||''} onChange={(e)=>onChange('date', e.target.value)} />
            </label>
            <label>Час
              <input type="time" value={data.time||''} onChange={(e)=>onChange('time', e.target.value)} />
            </label>
            <label>Місце
              <input value={data.location||''} onChange={(e)=>onChange('location', e.target.value)} />
            </label>
            <label>Деталі
              <textarea rows={6} value={data.details||''} onChange={(e)=>onChange('details', e.target.value)} />
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
            <div style={{ opacity: .7, marginBottom: 8 }}>{data.date} {data.time}</div>
            <div>{data.location}</div>
            <div style={{ marginTop: 8 }}>{data.details}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap:'wrap' }}>
              {(data.images||[]).map((n, idx) => (
                <div key={n+idx} style={{ position:'relative' }}>
                  <img src={`/data/schedule/${uid}/images/${n}`} alt="img" style={{ height: 80 }} />
                  <button type="button" onClick={()=>{
                    setRemoved((r)=> r.includes(n)? r : [...r, n])
                    st.setState((s)=> ({ ...s, langs: { ...s.langs, [lang]: { ...s.langs[lang], images: (s.langs[lang].images||[]).filter(x=>x!==n) } } }))
                  }} title="Видалити" style={{ position:'absolute', top:2, right:2, fontSize:11 }}>✕</button>
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
  const uid = prompt('ID події (латиниця, без пробілів):')
  if (!uid) return
  const base = `data/schedule/${uid}`
  try {
    const r = await getRepo(owner, repo, token)
    const baseBranch = r.default_branch || 'main'
    const sha = await getBranchSha(owner, repo, baseBranch, token)
    const branch = `content/schedule-${uid}-${Date.now()}`
    await createBranch(owner, repo, branch, sha, token)
    const arr = [
      { language: 'uk', category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] },
      { language: 'en', category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] },
      { language: 'fr', category: 'liturgy', title: '', date: '', time: '', location: '', details: '', images: [] }
    ]
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(arr, null, 2))))
    await putFile(owner, repo, `${base}/index.json`, b64, `create schedule ${uid}`, token, undefined, branch)
    const pr = await createPR(owner, repo, `Content: create schedule ${uid}`, branch, baseBranch, 'Create via admin', token)
    await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
    after?.()
    alert(`PR створено: #${pr.number}`)
  } catch (e) {
    alert('Не вдалося створити подію: ' + e.message)
  }
}

async function delItem(owner, repo, token, uid, after) {
  if (!confirm(`Видалити подію ${uid}?`)) return
  const base = `data/schedule/${uid}`
  try {
    const r = await getRepo(owner, repo, token)
    const baseBranch = r.default_branch || 'main'
    const sha = await getBranchSha(owner, repo, baseBranch, token)
    const branch = `content/schedule-del-${uid}-${Date.now()}`
    await createBranch(owner, repo, branch, sha, token)
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
    const pr = await createPR(owner, repo, `Content: delete schedule ${uid}`, branch, baseBranch, 'Delete via admin', token)
    await enableAutoMerge(owner, repo, pr.node_id, token).catch(()=>{})
    after?.()
    alert(`PR створено: #${pr.number}`)
  } catch (e) {
    alert('Не вдалося видалити подію: ' + e.message)
  }
}
