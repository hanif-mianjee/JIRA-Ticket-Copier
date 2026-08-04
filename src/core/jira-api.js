// Same-origin calls to the Jira REST API. The content script runs on the Jira
// page itself, so the existing session cookie authenticates these requests and
// no extra permission is needed beyond the host permission already granted.

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*-\d+$/;
const COMMENT_PAGE_SIZE = 100;
const MAX_COMMENT_PAGES = 10;
const REQUEST_TIMEOUT_MS = 15000;

export class JiraApiError extends Error {
  constructor(status, url, message) {
    super(message || `Jira API request failed with status ${status}`);
    this.name = "JiraApiError";
    this.status = status;
    this.url = url;
  }
}

/**
 * Check that a value is a Jira issue key. Called before the key is put into a
 * URL path, because it comes from the page's DOM.
 * @param {*} value - Candidate issue key.
 * @returns {boolean} True when the value is a well-formed issue key.
 */
export function isIssueKey(value) {
  return typeof value === "string" && ISSUE_KEY_PATTERN.test(value);
}

/**
 * Fetch everything needed to export an issue.
 * Only the issue request throws; the comment and remote-link requests degrade to
 * a warning, because a partial export beats no export.
 * @param {string} issueKey - The issue key, e.g. "YO-518".
 * @param {Object} [options] - Fetch options.
 * @param {AbortSignal} [options.signal] - Caller-supplied abort signal.
 * @param {string} [options.origin] - Site origin; defaults to the current page.
 * @returns {Promise<Object>} {issue, names, comments, remoteLinks, warnings}.
 */
export async function fetchIssueBundle(issueKey, options = {}) {
  if (!isIssueKey(issueKey)) {
    throw new JiraApiError(0, "", `Not a valid issue key: ${issueKey}`);
  }

  const origin = options.origin || window.location.origin;
  const base = `${origin}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
  const warnings = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = options.signal || controller.signal;

  try {
    // renderedFields and renderedBody are not used for the prose, which comes
    // from ADF, but they are the only place a media id appears next to its file
    // name, which is what lets inline images be matched to an attachment.
    const issue = await getJson(`${base}?fields=*all&expand=names,renderedFields`, signal);
    const comments = await fetchComments(base, signal, warnings);
    const remoteLinks = await fetchRemoteLinks(base, signal, warnings);

    return {
      issue,
      names: issue.names || {},
      comments,
      remoteLinks,
      warnings,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchComments(base, signal, warnings) {
  const comments = [];
  let startAt = 0;

  for (let page = 0; page < MAX_COMMENT_PAGES; page += 1) {
    let response;
    try {
      const url = `${base}/comment?maxResults=${COMMENT_PAGE_SIZE}&orderBy=created&startAt=${startAt}&expand=renderedBody`;
      response = await getJson(url, signal);
    } catch (error) {
      warnings.push(`Could not load all comments: ${error.message}`);
      return comments;
    }

    const values = Array.isArray(response.comments) ? response.comments : [];
    comments.push(...values);
    startAt += values.length;

    const total = Number(response.total);
    if (values.length === 0 || !Number.isFinite(total) || startAt >= total) return comments;
  }

  warnings.push(`Stopped after ${MAX_COMMENT_PAGES} pages of comments; some may be missing.`);
  return comments;
}

async function fetchRemoteLinks(base, signal, warnings) {
  try {
    const links = await getJson(`${base}/remotelink`, signal);
    return Array.isArray(links) ? links : [];
  } catch (error) {
    warnings.push(`Could not load remote links: ${error.message}`);
    return [];
  }
}

async function getJson(url, signal) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new JiraApiError(response.status, url, `Jira API returned ${response.status} for ${url}`);
  }
  return response.json();
}
