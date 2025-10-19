// scripts/data/fetchSheet.js
const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

/** Завантажує CSV з Google Sheet (з підтримкою редіректів) і зберігає у JSON */
function fetchSheet(csvUrl, outPath) {
  return new Promise((resolve, reject) => {
    const fetchWithRedirect = (url, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));

      https.get(url, res => {
        // 🔁 Якщо редірект — переходимо за новим посиланням
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, url).toString();
          console.log(`↪️ Redirecting to: ${nextUrl}`);
          return fetchWithRedirect(nextUrl, redirectCount + 1);
        }

        // ❌ Якщо помилка HTTP
        if (res.statusCode !== 200) {
          console.error(`❌ Failed to fetch ${url}: HTTP ${res.statusCode}`);
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        // ✅ Отримуємо CSV
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = csvToJson(data);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf8');
            console.log(`✅ ${outPath} ready (${json.length} lines)`);
            resolve(json);
          } catch (err) {
            console.error(`❌ Failed to parse CSV from ${url}`, err);
            reject(err);
          }
        });
      }).on('error', reject);
    };

    fetchWithRedirect(csvUrl);
  });
}

/** Convert CSV → JSON (пропускає перший порожній рядок або службовий) */
function csvToJson(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) return [];

  // 1-й рядок — службовий, 2-й — справжні заголовки
  const header = parseCsvLine(lines[1]);
  const out = [];

  for (let i = 2; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (cols[idx] || '').trim();
    });

    if (!row.image) {
      row.image = '/assets/images/article.png';
    }

    if (row.categories) {
      row.categories = row.categories.split(/\s*,\s*/);
    }

    out.push(row);
  }

  return out;
}

/** Розбір рядка CSV з підтримкою лапок і ком */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; // подвійні лапки → одна
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}


module.exports = { fetchSheet };
