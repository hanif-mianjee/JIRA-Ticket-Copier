// Builds the "Weekly filter" search URL opened from the toolbar menu.
// Loaded as a raw ES module by the popup and the options page, so it must stay
// dependency-free.

export const DEFAULT_WEEKLY_FILTER_DAYS = 7;
export const MAX_WEEKLY_FILTER_DAYS = 365;

// The end date carries a time because a bare date in JQL means midnight at the
// start of that day, which would leave out everything finished today.
export const DEFAULT_WEEKLY_FILTER_JQL = [
  "assignee = currentUser()",
  "AND status = Done",
  "AND statuscategorychangeddate >= \"{{startDate}}\"",
  "AND statuscategorychangeddate <= \"{{endDate}} 23:59\"",
].join("\n");

const JIRA_SITE_PATTERN = /^[a-z0-9][a-z0-9-]*\.atlassian\.net$/;

/**
 * Format a date as the yyyy-MM-dd string JQL expects, in local time.
 * @param {Date} date - Date to format.
 * @returns {string} e.g. "2026-11-19".
 */
export function formatJqlDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Coerce a stored or typed day count into a usable one.
 * @param {*} value - Candidate number of days.
 * @returns {number} A whole number from 1 to MAX_WEEKLY_FILTER_DAYS, or the default.
 */
export function normalizeDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1) return DEFAULT_WEEKLY_FILTER_DAYS;
  return Math.min(days, MAX_WEEKLY_FILTER_DAYS);
}

/**
 * The last `days` calendar days, today included. With 7 and a Thursday, that is
 * last Friday to today, so running it on the same weekday each week never
 * counts a day twice.
 * @param {number} days - Number of days to cover.
 * @param {Date} [today=new Date()] - Reference date.
 * @returns {Object} {startDate, endDate} as yyyy-MM-dd strings.
 */
export function getDateRange(days, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (normalizeDays(days) - 1));
  return { startDate: formatJqlDate(start), endDate: formatJqlDate(today) };
}

/**
 * Fill the date variables in a JQL template.
 * @param {string} template - JQL with {{startDate}} and {{endDate}} placeholders.
 * @param {Object} range - Result of getDateRange.
 * @returns {string} The JQL query.
 */
export function buildWeeklyFilterJql(template, range) {
  return (template || DEFAULT_WEEKLY_FILTER_JQL)
    .replace(/{{\s*startDate\s*}}/g, range.startDate)
    .replace(/{{\s*endDate\s*}}/g, range.endDate);
}

/**
 * Turn whatever was typed or found into a Jira Cloud origin. Only
 * *.atlassian.net is accepted, because that is all the extension runs on.
 * @param {string} value - "your-site", "your-site.atlassian.net" or any URL on it.
 * @returns {string} e.g. "https://your-site.atlassian.net", or "" when unusable.
 */
export function normalizeJiraSite(value) {
  let text = String(value || "").trim().toLowerCase();
  if (text === "") return "";
  if (!/^[a-z]+:\/\//.test(text)) text = `https://${text}`;

  let host;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return "";
    host = url.hostname;
  } catch {
    return "";
  }

  if (!host.includes(".")) host = `${host}.atlassian.net`;
  return JIRA_SITE_PATTERN.test(host) ? `https://${host}` : "";
}

/**
 * Build the search URL for the weekly filter.
 * @param {string} origin - Jira site origin, from normalizeJiraSite.
 * @param {Object} [options] - Filter options.
 * @param {number} [options.days] - Days to cover; defaults to 7.
 * @param {string} [options.jql] - JQL template; defaults to DEFAULT_WEEKLY_FILTER_JQL.
 * @param {Date} [today=new Date()] - Reference date.
 * @returns {string} The /issues URL with the JQL encoded.
 */
export function buildWeeklyFilterUrl(origin, options = {}, today = new Date()) {
  const jql = buildWeeklyFilterJql(options.jql, getDateRange(options.days, today));
  return `${origin}/issues?jql=${encodeURIComponent(jql)}`;
}
