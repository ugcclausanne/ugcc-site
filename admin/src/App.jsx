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
        <h1>Адмінка UGCC</h1>
        <p>Увійдіть через GitHub.</p>
        <button className="btn" onClick={startLogin}>Увійти через GitHub</button>
        {status && (
          <div className="badge" style={{ display: 'block', marginTop: 12 }}>
            {status.message}
            {status.verification_uri && (
              <p>
                1) Відкрийте{' '}
                <a href={status.verification_uri} target="_blank" rel="noreferrer">{status.verification_uri}</a>
                <br />
                2) Введіть код: <strong>{status.user_code}</strong>
              </p>
            )}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setManualOpen(v => !v)}>
            {manualOpen ? 'Сховати ручне введення токена' : 'Ввести токен вручну'}
          </button>
          {manualOpen && (
            <div style={{ marginTop: 8 }}>
              <input type="password" placeholder="ghp_xxx" value={manualToken} onChange={e=>setManualToken(e.target.value)} />
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => setTokenDirect(manualToken)} disabled={!manualToken}>Застосувати токен</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container admin-page">
      {notice && (
        <div className="badge block mt-md mb-md">
          {notice}
          <button className="btn" onClick={() => setNotice('')}>Закрити</button>
        </div>
      )}
      <header className="admin-toolbar admin-bar">
        <h1>UGCC Admin</h1>
        <div>
          <span className="mr-sm">{user?.login}</span>
          <button className="action-link" onClick={logout}>Вийти</button>
        </div>
      </header>
      <nav className="admin-top-tabs">
        <button className={"tab" + (tab==='articles'?' active':'')} onClick={() => setTab('articles')}>Статті</button>
        <button className={"tab" + (tab==='schedule'?' active':'')} onClick={() => setTab('schedule')}>Розклад</button>
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
