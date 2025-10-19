// Merge JSON entries from data/articles/ and data/schedule/ into
// data/articles.json and data/schedule.json without changing site logic.
// Safe to run multiple times; deduplicates and sorts by timestamp desc.

const fs = require('node:fs');
const path = require('node:path');

function readJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writePrettyJson(filePath, data) {
  const tmp = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, tmp, 'utf-8');
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => path.join(dir, f));
}

function normalizeArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return [val];
  return [];
}

function toKey(item) {
  const ts = String(item.timestamp || item.date || '').trim();
  const lang = String(item.language || '').trim().toLowerCase();
  const cat = String(item.category || '').trim().toLowerCase();
  const title = String(item.title || '').trim();
  return [ts, lang, cat, title].join('|');
}

function parseTimestamp(ts) {
  if (!ts) return 0;
  // Accept "YYYY-MM-DD HH:mm:ss" or ISO; fallback to Date parse
  const iso = String(ts).replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d) ? 0 : d.getTime();
}

function mergeFolderIntoArray(targetArray, folderPath) {
  const files = listJsonFiles(folderPath);
  for (const f of files) {
    const content = readJsonSafe(f, []);
    const items = normalizeArray(content);
    targetArray.push(...items);
  }
}

function dedupeAndSort(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = toKey(it);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  out.sort((a, b) => parseTimestamp(b.timestamp || b.date) - parseTimestamp(a.timestamp || a.date));
  return out;
}

function run() {
  const root = path.join(__dirname, '..');
  const dataDir = path.join(root, 'data');
  const articlesFile = path.join(dataDir, 'articles.json');
  const scheduleFile = path.join(dataDir, 'schedule.json');
  const articlesDir = path.join(dataDir, 'articles');
  const scheduleDir = path.join(dataDir, 'schedule');

  ensureDir(dataDir);
  ensureDir(articlesDir);
  ensureDir(scheduleDir);

  // Articles
  const baseArticles = readJsonSafe(articlesFile, []);
  const allArticles = Array.isArray(baseArticles) ? [...baseArticles] : [];
  mergeFolderIntoArray(allArticles, articlesDir);
  const mergedArticles = dedupeAndSort(allArticles);
  writePrettyJson(articlesFile, mergedArticles);
  console.log(`Articles merged: ${mergedArticles.length}`);

  // Schedule
  const baseSchedule = readJsonSafe(scheduleFile, []);
  const allSchedule = Array.isArray(baseSchedule) ? [...baseSchedule] : [];
  mergeFolderIntoArray(allSchedule, scheduleDir);
  const mergedSchedule = dedupeAndSort(allSchedule);
  writePrettyJson(scheduleFile, mergedSchedule);
  console.log(`Schedule merged: ${mergedSchedule.length}`);
}

run();

