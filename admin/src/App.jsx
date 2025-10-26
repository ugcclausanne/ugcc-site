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
        <h1>Адмінпанель UGCC</h1>
        <p>Для роботи увійдіть через GitHub.</p>
        <button onClick={startLogin}>Увійти через GitHub</button>
        {status && (
          <div style={{ marginTop: 16 }}>
            {status.message}
            {status.verification_uri && (
              <p>
                1) Відкрийте{' '}
                <a href={status.verification_uri} target="_blank" rel="noreferrer">
                  {status.verification_uri}
                </a>
                <br />
                2) Введіть код: <strong>{status.user_code}</strong>
              </p>
            )}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setManualOpen((v) => !v)} style={{ fontSize: 12 }}>
            {manualOpen ? 'Сховати введення токена вручну' : 'Або ввести токен вручну'}
          </button>
          {manualOpen && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13, opacity: 0.8 }}>
                Створіть Personal Access Token у GitHub (достатньо <code>public_repo</code> для публічного репозиторію)
                і вставте його тут. Токен зберігається тільки у вашому браузері.
              </p>
              <input type="password" placeholder="ghp_xxx" value={manualToken} onChange={(e)=>setManualToken(e.target.value)} style={{ width: '100%' }} />
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setTokenDirect(manualToken)} disabled={!manualToken}>Зберегти токен</button>
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
          <button style={{ float:'right' }} onClick={()=>setNotice('')}>✕</button>
        </div>
      )}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>UGCC Admin</h1>
        <div>
          <span style={{ marginRight: 12 }}>{user?.login}</span>
          <button onClick={logout}>Вийти</button>
        </div>
      </header>

      <nav style={{ marginTop: 16, marginBottom: 16 }}>
        <button onClick={() => setTab('articles')} disabled={tab === 'articles'}>Статті</button>
        <button onClick={() => setTab('schedule')} disabled={tab === 'schedule'} style={{ marginLeft: 8 }}>Розклад</button>
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
