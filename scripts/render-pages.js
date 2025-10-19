// Nunjucks static-site renderer (reads config.json and templates)
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');
const glob = require('glob');

// Utilities: safe JSON reader, centralized filters, and data loader
// const { readJsonSafe } = require('./utils/read-json-safe');
const { registerFilters } = require('./utils/register-filters');
const { loadSections, readJson } = require('./utils/data');

// Nunjucks environment
const env = nunjucks.configure('templates', { autoescape: true });
// Attach all custom filters in one place
registerFilters(env);

// Languages to render
const languages = [
  { code: '', dir: '.' },
  { code: 'en', dir: 'en' },
  { code: 'fr', dir: 'fr' }
];

//================= Paths ==============================
const pagesDir = path.join(__dirname, '../pages');
const configPath = path.join(pagesDir, 'config.json');
const headerPath = path.join(pagesDir, 'header.json');
const footerPath = path.join(pagesDir, 'footer.json');

// Load global UI fragments and config (per-language parts are merged later)
const globalConfig = fs.existsSync(configPath) ? readJson(configPath) : {};
const headerData = fs.existsSync(headerPath) ? readJson(headerPath) : {};
const footerData = fs.existsSync(footerPath) ? readJson(footerPath) : {};

// Render all pages
(async function renderAll() {
  // Normalize base path for GitHub Pages (project sites)
  const normalizeBase = (s) => {
    if (!s) return '';
    let b = String(s).trim();
    if (b.endsWith('/')) b = b.slice(0, -1);
    if (b && !b.startsWith('/')) b = '/' + b;
    return b;
  };
  const basePath = normalizeBase(process.env.BASE_PATH || globalConfig.base_path || '');
  const siteUrl = (process.env.SITE_URL || globalConfig.site_url || '').replace(/\/$/, '');
  const collectedRoutes = new Set();
  const pageJsonFiles = glob.sync(pagesDir.replace(/\\/g, '/') + '/*/page.json');
  console.log('Found pages:', pageJsonFiles.map(p => path.relative(path.join(__dirname, '..'), p)));

  // Load grouped data (articles + schedule) with multi-language schedule support
  const sheetSections = await loadSections();

  for (const pageFile of pageJsonFiles) {
    const pageName = path.basename(path.dirname(pageFile));
    const rawPageData = readJson(pageFile);
    const pageCommon = rawPageData.common || {};

    for (const lang of languages) {
      const langKey = lang.code || globalConfig.default_lang || 'uk';
      const configCommon = globalConfig.common || {};
      const configLang = globalConfig[langKey] || {};
      const pageLang = rawPageData[langKey] || {};
      const header = headerData[langKey] || {};
      const footer = footerData[langKey] || {};
      const sections = sheetSections[langKey] || sheetSections.uk || {};

      // Normalize keys that use hyphens (not addressable in Nunjucks directly)
      const noEventsText = (pageLang['no-events'] ?? pageCommon['no-events']);

      const pageData = {
        ...configCommon,
        ...configLang,
        ...pageCommon,
        ...pageLang,
        // add underscore alias for templates
        no_events: noEventsText,
        lang: langKey,
        page: pageName,
        header,
        footer,
        sections,
        base: basePath
      };

      let outDir, outPath;
      if (pageName === 'index' && lang.dir === '.') {
        outDir = '..';
        outPath = path.join(__dirname, outDir, 'index.html');
      } else if (pageName === 'index') {
        outDir = path.join('..', lang.dir);
        outPath = path.join(__dirname, outDir, 'index.html');
      } else {
        outDir = lang.dir === '.' ? path.join('..', pageName) : path.join('..', lang.dir, pageName);
        outPath = path.join(__dirname, outDir, 'index.html');
      }

      fs.mkdirSync(path.join(__dirname, outDir), { recursive: true });

      try {
        const html = nunjucks.render('base.njk', pageData);
        fs.writeFileSync(outPath, html, 'utf-8');
        console.log(`Rendered: ${outPath}`);
        // Collect route for sitemap
        let route;
        if (pageName === 'index' && lang.dir === '.') route = '/';
        else if (pageName === 'index') route = `/${lang.dir}/`;
        else route = lang.dir === '.' ? `/${pageName}/` : `/${lang.dir}/${pageName}/`;
        collectedRoutes.add(route);
      } catch (e) {
        console.error(`Render error for ${pageName} (${langKey}):`, e.message);
      }
    }
  }

  // After rendering static pages, render per-article detail pages
  const enriched = await loadSections();
  for (const lang of languages) {
    const langKey = lang.code || globalConfig.default_lang || 'uk';
    const configCommon = globalConfig.common || {};
    const configLang = globalConfig[langKey] || {};
    const header = headerData[langKey] || {};
    const footer = footerData[langKey] || {};
    const cats = ['news', 'spiritual', 'community'];
    for (const cat of cats) {
      const list = (enriched[langKey] && enriched[langKey][cat]) || [];
      for (const item of list) {
        const pageData = {
          ...configCommon,
          ...configLang,
          lang: langKey,
          page: 'article',
          header,
          footer,
          article: item,
          category: cat,
          base: basePath
        };
        const outDir = lang.dir === '.' ? path.join('..', cat, item.slug) : path.join('..', lang.dir, cat, item.slug);
        const outPath = path.join(__dirname, outDir, 'index.html');
        fs.mkdirSync(path.join(__dirname, outDir), { recursive: true });
        try {
          const html = nunjucks.render('base.njk', pageData);
          fs.writeFileSync(outPath, html, 'utf-8');
          console.log(`Rendered article: ${outPath}`);
          const route = lang.dir === '.' ? `/${cat}/${item.slug}/` : `/${lang.dir}/${cat}/${item.slug}/`;
          collectedRoutes.add(route);
        } catch (e) {
          console.error(`Render error for article ${item.slug} (${langKey}):`, e.message);
        }
      }
    }
  }

  // ===== Generate sitemap.xml and robots.txt if siteUrl configured =====
  try {
    if (siteUrl) {
      const urls = Array.from(collectedRoutes).sort();
      const fullBase = siteUrl + basePath;
      const now = new Date().toISOString();
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((u) => `  <url><loc>${fullBase}${u}</loc><lastmod>${now}</lastmod></url>`),
        '</urlset>'
      ].join('\n');
      fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), xml, 'utf-8');
      const robots = `User-agent: *\nAllow: /\nSitemap: ${fullBase}/sitemap.xml\n`;
      fs.writeFileSync(path.join(__dirname, '..', 'robots.txt'), robots, 'utf-8');
      console.log(`Generated sitemap.xml with ${urls.length} URLs and robots.txt`);
    } else {
      console.log('SITE_URL not set; skip sitemap/robots generation.');
    }
  } catch (e) {
    console.warn('Could not generate sitemap/robots:', e.message);
  }

  console.log('Done rendering pages.');
})();
