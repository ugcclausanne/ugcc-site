// Centralized Nunjucks filter registration.

const { parseToDate } = require('./date');

/**
 * Register all custom filters on a given Nunjucks environment.
 * @param {import('nunjucks').Environment} env
 */
function registerFilters(env) {
  // Text truncation for cards/previews
  env.addFilter('truncate', (str, len = 150) => {
    if (!str || typeof str !== 'string') return '';
    return str.length > len ? str.slice(0, len).replace(/\s+\S*$/, '') + ':' : str;
  });

  // Formats a value into a localized long date, e.g. 15 October 2025
  env.addFilter('format_date', (value, lang = 'uk') => {
    const d = parseToDate(value);
    if (!d) return '';
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'uk-UA';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  });

  // Numeric date for meta (DD.MM.YYYY)
  env.addFilter('format_date_num', (value) => {
    const d = parseToDate(value);
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  });

  // Sorts array by parsed time ascending (invalids go last)
  env.addFilter('sort_by_time', (arr) => {
    if (!Array.isArray(arr)) return [];
    const getTime = (item) => {
      const d = parseToDate(item?.timestamp || item?.date, item?.time);
      return d ? d.getTime() : Number.POSITIVE_INFINITY;
    };
    return arr.slice().sort((a, b) => getTime(a) - getTime(b));
  });

  // Upcoming items: filter by now and sort ascending
  env.addFilter('upcoming', (arr) => {
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    const getTime = (item) => {
      const d = parseToDate(item?.timestamp || item?.date, item?.time);
      return d ? d.getTime() : 0;
    };
    return arr
      .filter((it) => getTime(it) >= now)
      .sort((a, b) => getTime(a) - getTime(b));
  });

  // Simple where filter: property equals value
  env.addFilter('where', (arr, key, value) => {
    if (!Array.isArray(arr)) return [];
    if (!key) return arr;
    return arr.filter((it) => {
      const v = it && it[key];
      return v === value;
    });
  });

  // Slice helper for arrays
  env.addFilter('take', (arr, start = 0, count) => {
    if (!Array.isArray(arr)) return [];
    const s = Number.isFinite(start) ? start : 0;
    if (Number.isFinite(count)) return arr.slice(s, s + Number(count));
    return arr.slice(s);
  });

  // Extra helpers used by schedule/cards templates
  env.addFilter('substr', (str, start, len) => {
    const s = String(str ?? '');
    const a = Number(start) || 0;
    if (len === undefined) return s.slice(a);
    const l = Number(len);
    return Number.isFinite(l) ? s.slice(a, a + l) : s.slice(a);
  });

  env.addFilter('int', (value) => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  });

  // Localized month short-name using Intl — avoids encoding issues
  env.addFilter('monthname', (m, lang = 'uk') => {
    let n;
    if (typeof m === 'string') {
      const mm = m.trim();
      if (/^\d+$/.test(mm)) n = parseInt(mm, 10);
    }
    if (n === undefined) n = Number(m);
    const monthIndex = ((n > 0 ? n - 1 : 0) | 0);
    const d = new Date(Date.UTC(2020, monthIndex, 1));
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'uk-UA';
    return d.toLocaleString(locale, { month: 'short', timeZone: 'UTC' });
  });

  env.addFilter('enc', (s) => encodeURIComponent(String(s ?? '')));
}

module.exports = { registerFilters };
