/**
 * Business-day helper — the single source of truth for counter key dates.
 *
 * A restaurant serving past midnight must keep one trading session. If the
 * KOT / bill counter keys were derived from the calendar date, they would flip
 * at 00:00 and restart numbering at 001 while the same session was still
 * running — producing two KOT-001s and two invoice 001s in one business day.
 *
 * So every counter key, every seed and every purge uses the BUSINESS day:
 * anything before CUTOFF_HOUR belongs to the previous calendar date.
 *
 * MUST stay in sync with BUSINESS_DAY_CUTOFF_HOUR in the backend .env
 * (and utils/businessDay.js there).
 */

export const BUSINESS_DAY_CUTOFF_HOUR = 3

/**
 * Business-day key in the DD-MM-YY form the localStorage counters use.
 * @param {Date} [d] defaults to now
 */
export const businessDateKey = (d = new Date()) => {
  const t = new Date(d.getTime())
  if (t.getHours() < BUSINESS_DAY_CUTOFF_HOUR) {
    t.setDate(t.getDate() - 1)
  }
  const day = String(t.getDate()).padStart(2, '0')
  const month = String(t.getMonth() + 1).padStart(2, '0')
  const year = String(t.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

/** Business-day key in YYYY-MM-DD, for API calls that take a date param. */
export const businessDateISO = (d = new Date()) => {
  const t = new Date(d.getTime())
  if (t.getHours() < BUSINESS_DAY_CUTOFF_HOUR) {
    t.setDate(t.getDate() - 1)
  }
  const month = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  return `${t.getFullYear()}-${month}-${day}`
}

export default { BUSINESS_DAY_CUTOFF_HOUR, businessDateKey, businessDateISO }
