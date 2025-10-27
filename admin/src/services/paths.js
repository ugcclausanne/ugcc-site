// Build URLs for local dev vs prod.
// In dev: use Vite's /@fs to read from the real filesystem root of the repo.
// In prod: serve from "/data" which exists at the site root.

export function dataUrl(relPath) {
  const clean = String(relPath || '').replace(/^\/+/, '')
  if (import.meta.env.DEV) {
    // __FS_ROOT__ is injected from vite.config.js
    // eslint-disable-next-line no-undef
    return `/@fs/${__FS_ROOT__}/data/${clean}`
  }
  return `/data/${clean}`
}

