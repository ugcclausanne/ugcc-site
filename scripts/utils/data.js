// Load and group site data (articles + schedule).
// This module encapsulates data loading and enrichment to keep the renderer lean.

const fs = require('node:fs');
const path = require('node:path');

/**
 * Reads a JSON file and parses it. If anything goes wrong, returns {}.
 * This function is tolerant to UTF-8 BOM at the start of the file.
 * @param {string} p - Filesystem path to a JSON file
 * @returns {any} Parsed JSON or an empty object on failure
 */
function readJson(p) {
  try {
    const raw = fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Build absolute paths to top-level data files regardless of caller location.
 */
function dataPath(rel) {
  const rootDir = path.join(__dirname, '..', '..');
  return path.join(rootDir, 'data', rel);
}

/**
 * Load and group data for pages and templates.
 * Keeps logic as in the previous inline version, with clearer comments.
 * Returns a structure: { [lang]: { hero, news, spiritual, community, schedule } }
 */
async function loadSections() {
  // Read domain JSON (BOM-tolerant parsing; failures keep defaults [])
  let articles = [];
  let schedule = [];

  // Helper to prefix image file names with their folder path if needed
  const resolveImages = (baseDir, imgs) => {
    const list = Array.isArray(imgs) ? imgs : (imgs ? String(imgs).split(';').map(s=>s.trim()).filter(Boolean) : []);
    return list.map((name) => {
      if (!name) return name;
      const s = String(name);
      if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
      return `${baseDir}/images/${s}`.replace(/\\/g,'/');
    });
  };

  // Prefer new per-item structure under data/articles/* and data/schedule/*
  try {
    const rootDir = path.join(__dirname, '..', '..');
    const articlesRoot = path.join(rootDir, 'data', 'articles');
    if (fs.existsSync(articlesRoot)) {
      const dirs = fs.readdirSync(articlesRoot, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const d of dirs) {
        const uid = d.name;
        const folder = path.join(articlesRoot, uid);
        const indexPath = path.join(folder, 'index.json');
        let obj = {};
        if (fs.existsSync(indexPath)) obj = readJson(indexPath);
        else {
          const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.json'));
          if (files[0]) obj = readJson(path.join(folder, files[0]));
        }
        const baseHref = `/data/articles/${uid}`;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const images = resolveImages(baseHref, item.images || item.image);
            const image = images[0] || '';
            const ident = item._id || item.id || uid;
            articles.push({ ...item, images, image, _id: ident });
          }
        } else if (obj && Object.keys(obj).length) {
          const images = resolveImages(baseHref, obj.images || obj.image);
          const image = images[0] || '';
          const ident = obj._id || obj.id || uid;
          articles.push({ ...obj, images, image, _id: ident });
        }
      }
      console.log(`Loaded articles (per-item): ${articles.length}`);
    }
  } catch (e) {
    console.warn('Could not read per-item data/articles/*:', e.message);
  }

  // If no per-item found, fall back to legacy arrays file
  if (articles.length === 0) {
    try {
      const a = readJson(dataPath('articles.json'));
      if (Array.isArray(a)) articles = a;
      console.log(`Loaded articles (legacy): ${articles.length}`);
    } catch {
      console.warn('Could not read data/articles.json');
    }
  }

  // Schedule per-item structure
  try {
    const rootDir = path.join(__dirname, '..', '..');
    const scheduleRoot = path.join(rootDir, 'data', 'schedule');
    if (fs.existsSync(scheduleRoot)) {
      const entries = fs.readdirSync(scheduleRoot, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const uid = ent.name;
          const folder = path.join(scheduleRoot, uid);
          const indexPath = path.join(folder, 'index.json');
          let obj = {};
          if (fs.existsSync(indexPath)) obj = readJson(indexPath);
          else {
            const files = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.json'));
            if (files[0]) obj = readJson(path.join(folder, files[0]));
          }
          const baseHref = `/data/schedule/${uid}`;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const images = resolveImages(baseHref, item.images || item.image);
              const image = images[0] || '';
              const ident = item._id || item.id || uid;
              schedule.push({ ...item, images, image, _id: ident });
            }
          } else if (obj && Object.keys(obj).length) {
            const images = resolveImages(baseHref, obj.images || obj.image);
            const image = images[0] || '';
            const ident = obj._id || obj.id || uid;
            schedule.push({ ...obj, images, image, _id: ident });
          }
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) {
          const obj = readJson(path.join(scheduleRoot, ent.name));
          if (Array.isArray(obj)) schedule.push(...obj); else if (Object.keys(obj).length) schedule.push(obj);
        }
      }
      console.log(`Loaded schedule (per-item): ${schedule.length}`);
    }
  } catch (e) {
    console.warn('Could not read per-item data/schedule/*:', e.message);
  }

  // Fallback to legacy array file
  if (schedule.length === 0) {
    try {
      const s = readJson(dataPath('schedule.json'));
      if (Array.isArray(s)) schedule = s;
      console.log(`Loaded schedule items (legacy): ${schedule.length}`);
    } catch {
      console.warn('Could not read data/schedule.json');
    }
  }

  // Target languages to materialize (cards/pages expect these buckets)
  const langs = ['uk', 'en', 'fr'];

  // Skeleton per-language bucket
  const defaultSections = { hero: [], news: [], spiritual: [], community: [], schedule: [] };
  const sections = {};
  // helper: first 8 chars of _id
  const id8 = (id) => String(id||'').slice(0,8);

  // Parse semicolon-separated images into array, pass-through arrays
  const splitImages = (val) =>
    val
      ? Array.isArray(val)
        ? val
        : String(val)
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
      : [];

  // Deterministic fallback image picker so builds are stable
  const hashId = (s) => {
    const t = String(s || '');
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return h;
  };
  const imagesDir = path.join(__dirname, '..', '..', 'assets', 'images');
  const countFallback = (kind) => {
    try {
      if (!fs.existsSync(imagesDir)) return 0;
      const files = fs.readdirSync(imagesDir).filter((f) => f.toLowerCase().startsWith(`${kind}-`) && /\.(jpg|jpeg|png|webp|avif)$/i.test(f));
      return files.length;
    } catch { return 0 }
  };
  const fallbackImage = (kind, ident) => {
    const n = countFallback(kind);
    if (!n) return '';
    const idx = (hashId(ident) % n) + 1;
    return `/assets/images/${kind}-${idx}.jpg`;
  };

  // No slugs — use id8 for stable URLs


  // Articles: enrich with images[], primary image, id8, url; group by language/category
  for (const a of articles) {
    const lang = (a.language || 'uk').trim().toLowerCase();
    const cat = (a.category || '').trim();
    if (!sections[lang]) sections[lang] = JSON.parse(JSON.stringify(defaultSections));
    if (!cat || !sections[lang][cat]) continue;

    let images = splitImages(a.images || a.image);
    let image = images[0] || a.image || '';
    if (!image) {
      const kind = cat ? 'article' : 'prayer';
      image = fallbackImage(kind, a._id || a.id);
      images = [image];
    }
    const seg = id8(a._id || a.id);
    const langDir = lang === 'uk' ? '' : `/${lang}`;
    const url = `${langDir}/${cat}/${seg}/`;

    sections[lang][cat].push({ ...a, images, image, id8: seg, url });
  }

  // Schedule: group by provided language, same logic as articles
  for (const s of schedule) {
    const lang = (s.language || 'uk').trim().toLowerCase();
    if (!sections[lang]) sections[lang] = JSON.parse(JSON.stringify(defaultSections));
    sections[lang].schedule.push({ ...s, language: lang });
  }

  return sections;
}

module.exports = { loadSections, readJson};
