// scripts/fetch-sheets.js
const { fetchSheet } = require('./fetchSheet');

// Two tabs: articles and anounces
const { ARTICLES_CSV_URL, SCHEDULE_CSV_URL } = require('./config');

const sheets = [
  { url: ARTICLES_CSV_URL, out: 'data/articles.json' },
  { url: SCHEDULE_CSV_URL, out: 'data/schedule.json' }
];


(async () => {
  for (const s of sheets) {
    if (!s.url) {
      console.warn(`⚠️ Missed: ${s.out} (no URL)`);
      continue;
    }
		console.log(s.url, s.out);
    await fetchSheet(s.url, s.out);
  }
  console.log('✅ All tabs updated');
})();
