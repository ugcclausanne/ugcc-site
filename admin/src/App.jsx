import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './auth/GithubDeviceAuth.jsx'
import { Articles } from './components/Articles.jsx'
import { Schedule } from './components/Schedule.jsx'

function Shell() {
  const { token, startLogin, user, logout, status, setTokenDirect } = useAuth()
  const [tab, setTab] = useState('articles')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const h = (e) => setNotice(e.detail || '')
    window.addEventListener('admin:notice', h)
    return () => window.removeEventListener('admin:notice', h)
  }, [])

  if (!token) {
    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: 24 }}>
        <h1>РђРґРјС–РЅРїР°РЅРµР»СЊ UGCC</h1>
        <p>Р”Р»СЏ СЂРѕР±РѕС‚Рё СѓРІС–Р№РґС–С‚СЊ С‡РµСЂРµР· GitHub.</p>
        <button onClick={startLogin}>РЈРІС–Р№С‚Рё С‡РµСЂРµР· GitHub</button>
        {status && (
          <div style={{ marginTop: 16 }}>
            {status.message}
            {status.verification_uri && (
              <p>
                1) Р’С–РґРєСЂРёР№С‚Рµ{' '}
                <a href={status.verification_uri} target="_blank" rel="noreferrer">
                  {status.verification_uri}
                </a>
                <br />
                2) Р’РІРµРґС–С‚СЊ РєРѕРґ: <strong>{status.user_code}</strong>
              </p>
            )}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setManualOpen((v) => !v)} style={{ fontSize: 12 }}>
            {manualOpen ? 'РЎС…РѕРІР°С‚Рё РІРІРµРґРµРЅРЅСЏ С‚РѕРєРµРЅР° РІСЂСѓС‡РЅСѓ' : 'РђР±Рѕ РІРІРµСЃС‚Рё С‚РѕРєРµРЅ РІСЂСѓС‡РЅСѓ'}
          </button>
          {manualOpen && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13, opacity: 0.8 }}>
                РЎС‚РІРѕСЂС–С‚СЊ Personal Access Token Сѓ GitHub (РґРѕСЃС‚Р°С‚РЅСЊРѕ <code>public_repo</code> РґР»СЏ РїСѓР±Р»С–С‡РЅРѕРіРѕ СЂРµРїРѕР·РёС‚РѕСЂС–СЋ)
                С– РІСЃС‚Р°РІС‚Рµ Р№РѕРіРѕ С‚СѓС‚. РўРѕРєРµРЅ Р·Р±РµСЂС–РіР°С”С‚СЊСЃСЏ С‚С–Р»СЊРєРё Сѓ РІР°С€РѕРјСѓ Р±СЂР°СѓР·РµСЂС–.
              </p>
              <input type="password" placeholder="ghp_xxx" value={manualToken} onChange={(e)=>setManualToken(e.target.value)} style={{ width: '100%' }} />
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setTokenDirect(manualToken)} disabled={!manualToken}>Р—Р±РµСЂРµРіС‚Рё С‚РѕРєРµРЅ</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      {notice && (
        <div style={{ background:'#fff4d6', border:'1px solid #f0d589', padding:8, marginBottom:12, borderRadius:6 }}>
          {notice}
          <button style={{ float:'right' }} onClick={()=>setNotice('')}>вњ•</button>
        </div>
      )}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>UGCC Admin</h1>
        <div>
          <span style={{ marginRight: 12 }}>{user?.login}</span>
          <button onClick={logout}>Р’РёР№С‚Рё</button>
        </div>
      </header>

      <nav style={{ marginTop: 16, marginBottom: 16 }}>
        <button onClick={() => setTab('articles')} disabled={tab === 'articles'}>РЎС‚Р°С‚С‚С–</button>
        <button onClick={() => setTab('schedule')} disabled={tab === 'schedule'} style={{ marginLeft: 8 }}>Р РѕР·РєР»Р°Рґ</button>
      </nav>

      {tab === 'articles' ? <Articles /> : <Schedule />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './auth/GithubDeviceAuth.jsx'
import { Articles } from './components/Articles.jsx'
import { Schedule } from './components/Schedule.jsx'

function Shell() {
  const { token, startLogin, user, logout, status, setTokenDirect } = useAuth()
  const [tab, setTab] = useState('articles')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const h = (e) => setNotice(e.detail || '')
    window.addEventListener('admin:notice', h)
    return () => window.removeEventListener('admin:notice', h)
  }, [])

  if (!token) {
    return (
      <div className="container">
        <h1>РђРґРјС–РЅРїР°РЅРµР»СЊ UGCC</h1>
        <p>Р”Р»СЏ СЂРѕР±РѕС‚Рё СѓРІС–Р№РґС–С‚СЊ С‡РµСЂРµР· GitHub.</p>
        <button className="btn" onClick={startLogin}>РЈРІС–Р№С‚Рё С‡РµСЂРµР· GitHub</button>
        {status && (
          <div className="badge" style={{ display: 'block', marginTop: 12 }}>
            {status.message}
            {status.verification_uri && (
              <p>
                1) Р’С–РґРєСЂРёР№С‚Рµ{' '}
                <a href={status.verification_uri} target="_blank" rel="noreferrer">{status.verification_uri}</a>
                <br />
                2) Р’РІРµРґС–С‚СЊ РєРѕРґ: <strong>{status.user_code}</strong>
              </p>
            )}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setManualOpen((v) => !v)}>
            {manualOpen ? 'РЎС…РѕРІР°С‚Рё РІРІРµРґРµРЅРЅСЏ С‚РѕРєРµРЅР° РІСЂСѓС‡РЅСѓ' : 'РђР±Рѕ РІРІРµСЃС‚Рё С‚РѕРєРµРЅ РІСЂСѓС‡РЅСѓ'}
          </button>
          {manualOpen && (
            <div style={{ marginTop: 8 }}>
              <p>РЎС‚РІРѕСЂС–С‚СЊ Personal Access Token Сѓ GitHub (РґР»СЏ РїСѓР±Р»С–С‡РЅРѕРіРѕ СЂРµРїРѕР·РёС‚РѕСЂС–СЋ РґРѕСЃС‚Р°С‚РЅСЊРѕ public_repo) С– РІСЃС‚Р°РІС‚Рµ Р№РѕРіРѕ С‚СѓС‚. РўРѕРєРµРЅ Р·Р±РµСЂС–РіР°С”С‚СЊСЃСЏ Р»РёС€Рµ Сѓ РІР°С€РѕРјСѓ Р±СЂР°СѓР·РµСЂС–.</p>
              <input type="password" placeholder="ghp_xxx" value={manualToken} onChange={(e)=>setManualToken(e.target.value)} />
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => setTokenDirect(manualToken)} disabled={!manualToken}>Р—Р±РµСЂРµРіС‚Рё С‚РѕРєРµРЅ</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      {notice && (
        <div className="badge" style={{ display: 'block', marginTop: 12, marginBottom: 12 }}>
          {notice}
          <button className="btn" onClick={()=>setNotice('')}>вњ•</button>
        </div>
      )}

      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>UGCC Admin</h1>
        <div>
          <span style={{ marginRight: 12 }}>{user?.login}</span>
          <button className="btn" onClick={logout}>Р’РёР№С‚Рё</button>
        </div>
      </header>

      <nav style={{ marginTop: 16, marginBottom: 16 }}>
        <button className="btn" onClick={() => setTab('articles')} disabled={tab === 'articles'}>РЎС‚Р°С‚С‚С–</button>
        <button className="btn" onClick={() => setTab('schedule')} disabled={tab === 'schedule'} style={{ marginLeft: 8 }}>Р РѕР·РєР»Р°Рґ</button>
      </nav>

      {tab === 'articles' ? <Articles /> : <Schedule />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

