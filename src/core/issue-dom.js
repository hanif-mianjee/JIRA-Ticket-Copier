import { EXPORT_SELECTORS } from "../config/selectors.js";
import { normalizeWhitespace } from "./markdown-utils.js";

/**
 * Map each reply comment id to the id of the comment it replies to.
 * Replies are nested inside their parent's item element, so walking up from the
 * reply wrapper gives the parent directly. Only comments currently rendered on
 * the page are visible here.
 * @param {Document|Element} [root=document] - Root to search.
 * @returns {Map<string, string>} Reply id to parent id.
 */
export function buildReplyParentMap(root = document) {
  const map = new Map();
  const items = root.querySelectorAll(EXPORT_SELECTORS.commentItem);

  items.forEach((item) => {
    const wrapper = item.closest(EXPORT_SELECTORS.replyWrapper);
    if (!wrapper || !wrapper.parentElement) return;

    const parentItem = wrapper.parentElement.closest(EXPORT_SELECTORS.commentItem);
    if (!parentItem) return;

    const id = commentIdOf(item);
    const parentId = commentIdOf(parentItem);
    if (id && parentId && id !== parentId) map.set(id, parentId);
  });

  return map;
}

/**
 * Map media ids to the file names shown in the rendered page.
 * ADF media nodes carry only a Media Services id, which does not match the Jira
 * attachment id, so the rendered DOM is the bridge between the two.
 * @param {Document|Element} [root=document] - Root to search.
 * @returns {Map<string, string>} Media id to file name.
 */
export function buildMediaFilenameMap(root = document) {
  const map = new Map();

  root.querySelectorAll(EXPORT_SELECTORS.mediaNode).forEach((node) => {
    const id = node.getAttribute("data-id");
    const filename = node.getAttribute("data-file-name");
    if (id && filename) map.set(id, filename);
  });

  return map;
}

/**
 * Same as buildMediaFilenameMap, but over an HTML string rather than the live
 * page. Lets media in comments that are not currently on screen be resolved from
 * the rendered HTML the API returns.
 * @param {string} html - Rendered HTML from renderedFields or renderedBody.
 * @returns {Map<string, string>} Media id to file name.
 */
export function buildMediaFilenameMapFromHtml(html) {
  if (!html || typeof html !== "string" || typeof DOMParser === "undefined") return new Map();

  try {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    return buildMediaFilenameMap(parsed);
  } catch {
    return new Map();
  }
}

/**
 * Read a reduced ticket straight from the rendered page.
 * Used only when the REST request fails. The page does not expose real comment
 * timestamps, so relative strings such as "5 hours ago" are kept verbatim and
 * the result is flagged as degraded.
 * @param {Document|Element} root - Root to read from.
 * @param {Object} info - Basic info already scraped by the content script.
 * @returns {Object} A ticket in the shape buildTicketMarkdown expects.
 */
export function readIssueFromDom(root, info) {
  const replyParents = buildReplyParentMap(root);

  return {
    key: info.ticketId || "",
    title: info.title || "",
    url: info.ticketUrl || "",
    type: readIssueType(root),
    status: info.status || "",
    labels: [],
    components: [],
    fixVersions: [],
    sections: readDescription(root),
    otherFields: [],
    links: [],
    children: [],
    attachments: [],
    remoteLinks: [],
    comments: readComments(root, replyParents),
    degraded: true,
    warnings: ["Exported from the page because the Jira API was unavailable. Timestamps are relative and some sections are missing."],
  };
}

function commentIdOf(element) {
  const testId = element.getAttribute("data-testid") || "";
  if (!testId.startsWith(EXPORT_SELECTORS.commentIdPrefix)) return "";
  return testId.slice(EXPORT_SELECTORS.commentIdPrefix.length);
}

function readIssueType(root) {
  const button = root.querySelector(EXPORT_SELECTORS.issueTypeButton);
  const label = button && button.getAttribute("aria-label");
  return label ? label.split(" - ")[0].trim() : "";
}

function readDescription(root) {
  const field = root.querySelector(EXPORT_SELECTORS.description);
  const rendered = field && field.querySelector(EXPORT_SELECTORS.renderedBody);
  const text = rendered ? textOf(rendered) : "";
  return text ? [{ label: "Description", markdown: text }] : [];
}

function readComments(root, replyParents) {
  const comments = [];

  root.querySelectorAll(EXPORT_SELECTORS.commentItem).forEach((item) => {
    const id = commentIdOf(item);
    const header = item.querySelector(EXPORT_SELECTORS.commentHeader);
    const body = item.querySelector(EXPORT_SELECTORS.commentBody);
    if (!id || !header) return;

    const authorEl = header.querySelector(EXPORT_SELECTORS.commentAuthor);
    const author = authorEl ? textOf(authorEl) : "";
    const rendered = body && body.querySelector(EXPORT_SELECTORS.renderedBody);

    comments.push({
      id,
      author,
      created: readTimestampText(header, author),
      edited: Boolean(header.querySelector(EXPORT_SELECTORS.editedFlag)),
      markdown: rendered ? textOf(rendered) : "",
      parentId: replyParents.get(id) || null,
    });
  });

  // The page lists top-level comments newest first, but replies are nested
  // chronologically inside their parent. So only the top-level order is flipped;
  // reversing everything would place a reply before the comment it answers.
  const topLevel = comments.filter((comment) => !comment.parentId).reverse();
  const replies = comments.filter((comment) => comment.parentId);
  return topLevel.concat(replies);
}

function readTimestampText(header, author) {
  const relative = header.querySelector(EXPORT_SELECTORS.relativeTime);
  if (relative) return textOf(relative);

  // Older comments render an absolute date with no test id of its own. The
  // header holds nothing but the author, the date and an optional edited flag.
  const edited = header.querySelector(EXPORT_SELECTORS.editedFlag);
  const full = textOf(header);
  const withoutAuthor = author && full.startsWith(author) ? full.slice(author.length) : full;
  const editedText = edited ? textOf(edited) : "";
  return withoutAuthor.replace(editedText, "").trim();
}

function textOf(element) {
  return normalizeWhitespace(element.textContent || "").replace(/\s+/g, " ").trim();
}
