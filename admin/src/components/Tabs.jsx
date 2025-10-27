import React from 'react'

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="admin-toolbar">
      {tabs.map((t) => (
        <button className="btn" key={t} onClick={() => onChange(t)} disabled={t === value}>{t.toUpperCase()}</button>
      ))}
    </div>
  )
}
