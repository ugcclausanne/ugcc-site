UGCC Admin (React + Vite)

Setup
- Copy `.env.sample` to `.env` and set:
  - VITE_GITHUB_CLIENT_ID (GitHub OAuth App → Client ID)
  - VITE_REPO_OWNER (e.g. ugcclausanne)
  - VITE_REPO_NAME (e.g. ugcc-site)
  - VITE_LIBRE_TRANSLATE_URL (optional, for in-admin translate)
- npm install (in admin/), then npm run dev

Notes
- Uses GitHub OAuth Device Flow (no backend required).
- Reads/writes content under data/articles and data/schedule in this repo.
- Styles are loaded from ../assets/css.
