UGCC Lausanne Parish Website

A trilingual (Ukrainian, French, English) static site for the UGCC Lausanne Parish.

Built with **Eleventy (Nunjucks templates)** and **SCSS** for clean, modular styling.

---

🧱 Project Structure
/
├── assets/
│ ├── scss/ → source styles
│ └── css/ → compiled styles
├── templates/ → .njk templates
├── data/ → multilingual JSON (menu, content, etc.)
└── content/ → markdown or JSON articles

---

⚙️ Development

1. Install dependencies  
   ```bash
  npm install

2. Run local server

  npm run dev

3. Build for production

  npm run build

🌍 Deployment

Automatic build and hosting on Netlify (free plan).
Push to the main branch — Netlify rebuilds the site.

⚖️ Licensing

Code: MIT License → LICENSE

Content: CC BY-NC 4.0 → LICENSE-CONTENT

Third-party assets: see NOTICE.md

🤝 Contributions
See CONTRIBUTING.md
