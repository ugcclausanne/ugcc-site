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
  try {
    const a = readJson(dataPath('articles.json'));
    if (Array.isArray(a)) articles = a;
    console.log(`Loaded articles: ${articles.length}`);
  } catch {
    console.warn('Could not read data/articles.json');
  }
  try {
    const s = readJson(dataPath('schedule.json'));
    if (Array.isArray(s)) schedule = s;
    console.log(`Loaded schedule items: ${schedule.length}`);
  } catch {
    console.warn('Could not read data/schedule.json');
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

  // No slugs — use id8 for stable URLs


  // Articles: enrich with images[], primary image, id8, url; group by language/category
  for (const a of articles) {
    const lang = (a.language || 'uk').trim().toLowerCase();
    const cat = (a.category || '').trim();
    if (!sections[lang]) sections[lang] = JSON.parse(JSON.stringify(defaultSections));
    if (!cat || !sections[lang][cat]) continue;

    const images = splitImages(a.image || a.images);
    const image = images[0] || a.image || '';
    const seg = id8(a._id);
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
