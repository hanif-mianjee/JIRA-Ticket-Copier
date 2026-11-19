import { copyText, formatMessage } from "./clipboard.js";
import { getFormat } from "./storage.js";

/**
 * Read every issue row in a search results table.
 * @param {Object} selectors - issueRow, issueKey and issueSummary selectors.
 * @param {Document|Element} [root=document] - Root to search.
 * @returns {Array} [{ticketId, title}] in table order, skipping incomplete rows.
 */
export function readIssueList(selectors, root = document) {
  const issues = [];
  root.querySelectorAll(selectors.issueRow).forEach((row) => {
    const ticketId = textOf(row.querySelector(selectors.issueKey));
    const title = textOf(row.querySelector(selectors.issueSummary));
    if (ticketId && title) issues.push({ ticketId, title });
  });
  return issues;
}

/**
 * Find the bar holding the search page's header actions (Apps, Share, More
 * actions). Each action sits in its own wrapper, so the bar is two levels up
 * from the button the selector matches.
 * @param {string} actionSelector - Selector for any button in the bar.
 * @param {Document|Element} [root=document] - Root to search.
 * @returns {Element|null} The action bar, or null when it is not on the page.
 */
export function findActionBar(actionSelector, root = document) {
  const action = root.querySelector(actionSelector);
  return (action && action.parentElement && action.parentElement.parentElement) || null;
}

/**
 * Copy a list of issues, one formatted line each.
 * @param {Array} issues - Result of readIssueList.
 * @param {HTMLElement} btn - The button that was clicked.
 * @param {Object} feedback - Handler from createTextButtonFeedback.
 * @returns {Promise<void>} Resolves once feedback has been shown.
 */
export async function copyIssueList(issues, btn, feedback) {
  if (!issues || issues.length === 0) {
    feedback.notfound(btn);
    return;
  }

  const format = await getFormat("issueListFormat");
  const text = issues.map((issue) => formatMessage(format, issue)).join("\n");
  try {
    await copyText(text);
    feedback.success(btn, issues.length);
  } catch {
    feedback.fail(btn);
  }
}

function textOf(element) {
  return element ? (element.textContent || "").replace(/\s+/g, " ").trim() : "";
}
