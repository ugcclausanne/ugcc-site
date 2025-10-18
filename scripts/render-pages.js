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
        sections
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
          category: cat
        };
        const outDir = lang.dir === '.' ? path.join('..', cat, item.slug) : path.join('..', lang.dir, cat, item.slug);
        const outPath = path.join(__dirname, outDir, 'index.html');
        fs.mkdirSync(path.join(__dirname, outDir), { recursive: true });
        try {
          const html = nunjucks.render('base.njk', pageData);
          fs.writeFileSync(outPath, html, 'utf-8');
          console.log(`Rendered article: ${outPath}`);
        } catch (e) {
          console.error(`Render error for article ${item.slug} (${langKey}):`, e.message);
        }
      }
    }
  }

  console.log('Done rendering pages.');
})();
