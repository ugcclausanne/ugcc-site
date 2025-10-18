// Date helpers used across filters and templates

/**
 * Parses flexible date/time inputs into a Date instance.
 * Accepts values like 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm', or separate date/time.
 * Returns null when parsing fails.
 * @param {string|Date} inputDate
 * @param {string} [inputTime]
 * @returns {Date|null}
 */
function parseToDate(inputDate, inputTime) {
  if (!inputDate && !inputTime) return null;
  let str = '';
  if (typeof inputDate === 'string') str = inputDate.trim();
  if (!str && inputTime) str = String(inputTime).trim();
  if (inputDate && inputTime && !/\s/.test(str)) str = `${inputDate} ${inputTime}`;
  if (!str) return null;
  const normalized = str.replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d) ? null : d;
}

module.exports = { parseToDate };

