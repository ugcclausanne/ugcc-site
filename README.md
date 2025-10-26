UGCC Lausanne Parish Website

This repository contains the static website (Nunjucks templates, JS, CSS) and content in JSON under `data/`, plus a React-based admin in `admin/` that edits files directly in this repo via GitHub API.

Content Structure
- Articles: `data/articles/{uid}/index.json` with images in `data/articles/{uid}/images/*.*`
- Each `index.json` is an array of 3 entries: `uk`, `en`, `fr`.
- Fields follow the legacy format (title, date, excerpt, content, category, language, images[]).
- Schedule: `data/schedule/{uid}/index.json` with images in `data/schedule/{uid}/images/*.*`
- Each `index.json` is an array of 3 entries: `uk`, `en`, `fr`.
- Fields: title, date, time, location, details, category (`liturgy|announcement`), language, images[].
- Fallback images (used if no images provided): place under `assets/images/`
- Articles: `article-1.jpg .. article-N.jpg`
- Schedule: `prayer-1.jpg .. prayer-N.jpg`

Build and Preview (Site)
- Requirements: Node 20+, npm, Python (for simple static server).
- From repo root:
- `npm ci`
- `npm run translate` (optional; fills missing en/fr via Libre for per-item JSON)
- `npm run build`
- `python -m http.server 8000`
- Open `http://localhost:8000`.
- Notes:
- By default the renderer writes HTML into the repo root (not into `dist`).
- When `OUT_DIR` is set, the renderer copies `assets/` and `data/` into the output folder as well.

Admin (React + Vite)
- The admin is a SPA in `admin/` that uses GitHub OAuth Device Flow. No backend required.
- Setup:
- Copy `admin/.env.sample` to `admin/.env` and set:
  - `VITE_GITHUB_CLIENT_ID` = Client ID from your GitHub OAuth App (Device Flow enabled)
  - `VITE_REPO_OWNER` = org/user (e.g. `ugcclausanne`)
  - `VITE_REPO_NAME` = `ugcc-site`
  - `VITE_LIBRE_TRANSLATE_URL` = `https://libretranslate.com` (or your instance)
- `cd admin && npm install && npm run dev`
- Open `http://localhost:5173` → click “Увійти через GitHub” and complete the code flow.
- Scopes and permissions:
- For public repos, the admin requests `public_repo` scope (sufficient for write on public repos when the user has repo write access).
- For private repos, change to `repo` if needed.

CI
- GitHub Actions runs a validation workflow on push:
- Translates missing languages using Libre (`scripts/translate-local.js`) if `LIBRE_TRANSLATE_URL` is set in repo secrets/variables.
- Builds the site as a check. GitHub Pages is configured to deploy from the repository root (Deploy from branch: `main`).

Adding Example Content
- Article: create `data/articles/example-1/index.json` with an array of 3 entries (uk/en/fr) and place images in `data/articles/example-1/images/`.
- Schedule: create `data/schedule/example-1/index.json` similarly and images in `data/schedule/example-1/images/`.

Scripts
- `npm run translate` — Libre translate of missing en/fr in per-item JSON.
- `npm run build` — Renders Nunjucks pages and article detail pages.
- `npm run local` — Translate + build + serve via Python.

