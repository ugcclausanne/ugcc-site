import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthCtx = createContext(null)

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || ''
const OWNER = import.meta.env.VITE_REPO_OWNER || ''
const REPO = import.meta.env.VITE_REPO_NAME || ''

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  })
  return res.json()
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || '')
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!token) return
    fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((u) => {
        if (u && u.message && /bad credentials/i.test(u.message)) {
          setStatus({ message: 'Невірний або прострочений токен. Створіть новий PAT і введіть його знову.' })
          setUser(null)
        } else if (u && u.login) {
          try { window.__admin_user_login = u.login } catch {}
          setUser(u)
          setStatus(null)
        }
      })
      .catch(() => {})
  }, [token])

  const startLogin = async () => {
    try {
      if (!CLIENT_ID) {
        setStatus({ message: 'Не налаштовано VITE_GITHUB_CLIENT_ID у admin/.env' })
        return
      }
      const dc = await fetchJSON('https://github.com/login/device/code', {
        method: 'POST',
        body: JSON.stringify({ client_id: CLIENT_ID, scope: 'public_repo' })
      })
      if (!dc || !dc.device_code) {
        setStatus({ message: 'Не вдалося отримати device code від GitHub' })
        return
      }
      setStatus({ message: 'Підтвердіть вхід на GitHub', ...dc })
      const started = Date.now()
      const interval = setInterval(async () => {
        try {
          const t = await fetchJSON('https://github.com/login/oauth/access_token', {
            method: 'POST',
            body: JSON.stringify({
              client_id: CLIENT_ID,
              device_code: dc.device_code,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
          })
          if (t.access_token) {
            clearInterval(interval)
            localStorage.setItem('gh_token', t.access_token)
            setToken(t.access_token)
            setStatus(null)
          } else if (t.error === 'authorization_pending') {
            // keep polling
          } else if (t.error) {
            setStatus({ message: `Помилка авторизації: ${t.error}` })
          }
        } catch (e) {
          setStatus({ message: 'Помилка мережі під час входу' })
        }
        if (Date.now() - started > (dc.expires_in || 600) * 1000) {
          clearInterval(interval)
          setStatus({ message: 'Код авторизації прострочено, спробуйте знову.' })
        }
      }, (dc.interval || 5) * 1000)
    } catch (e) {
      setStatus({ message: 'Помилка ініціації входу. Перевірте OAuth App (Device Flow).' })
    }
  }

  const logout = () => {
    localStorage.removeItem('gh_token')
    setToken('')
    setUser(null)
  }

  const setTokenDirect = (t) => {
    if (!t) return
    localStorage.setItem('gh_token', t)
    setToken(t)
  }

  const value = useMemo(() => ({ token, user, status, startLogin, logout, setTokenDirect, owner: OWNER, repo: REPO }), [token, user, status])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
