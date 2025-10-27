import React from 'react'

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="admin-tabs">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          className={"tab" + (t === value ? ' active' : '')}
          onClick={() => onChange(t)}
          aria-selected={t === value}
          role="tab"
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
