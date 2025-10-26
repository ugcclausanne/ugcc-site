import React from 'react'

export function Tabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} disabled={t === value}>{t.toUpperCase()}</button>
      ))}
    </div>
  )
}

