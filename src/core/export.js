import { fetchIssueBundle, isIssueKey } from "./jira-api.js";
import { buildTicketFromRest, readBundleAttachments, readBundleIdentity } from "./issue-model.js";
import { readIssueFromDom } from "./issue-dom.js";
import { hasDownloadPermission, openOptionsPage, saveTicketAssets } from "./assets.js";
import { getSetting, setSetting } from "./storage.js";
import { escapeMarkdown, joinBlocks, linkTarget, normalizeMarkdown, yamlList, yamlScalar } from "./markdown-utils.js";
import { showAttachmentPrompt } from "../ui/export-modal.js";
import { COLORS } from "../ui/styles.js";

const MAX_FILENAME_LENGTH = 147;
const FALLBACK_FILENAME = "jira-ticket.md";
const SPINNER_CLASS = "jira-copier-spinner";

/**
 * Build the download file name from the ticket key and title.
 * @param {string} ticketId - Issue key, e.g. "YO-518".
 * @param {string} title - Issue summary.
 * @returns {string} A safe file name ending in ".md".
 */
export function buildExportFilename(ticketId, title) {
  const raw = [ticketId, title].filter(Boolean).join("_");
  const slug = raw
    .replace(/&/g, " and ")
    // A Unicode-aware allowlist, so a non-Latin title is not reduced to nothing.
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[_.-]+|[_.-]+$/g, "");

  const truncated = slug.slice(0, MAX_FILENAME_LENGTH).replace(/[_.-]+$/, "");
  return truncated === "" ? FALLBACK_FILENAME : `${truncated}.md`;
}

/**
 * Render a normalized ticket as a Markdown document.
 * @param {Object} ticket - Ticket from buildTicketFromRest or readIssueFromDom.
 * @param {string} [exportedAt] - ISO timestamp recorded in the frontmatter.
 * @returns {string} The Markdown document.
 */
export function buildTicketMarkdown(ticket, exportedAt) {
  const blocks = [
    buildFrontmatter(ticket, exportedAt),
    `# ${escapeMarkdown(ticket.key ? `${ticket.key}: ${ticket.title}` : ticket.title)}`,
    buildWarnings(ticket),
  ];

  ticket.sections.forEach((section) => {
    blocks.push(`## ${escapeMarkdown(section.label)}`, section.markdown);
  });

  blocks.push(buildOtherFields(ticket.otherFields));
  blocks.push(buildLinks(ticket.links));
  blocks.push(buildChildren(ticket.children));
  blocks.push(buildAttachments(ticket.attachments));
  blocks.push(buildRemoteLinks(ticket.remoteLinks));
  blocks.push(buildComments(ticket.comments));

  return normalizeMarkdown(joinBlocks(blocks));
}

function buildFrontmatter(ticket, exportedAt) {
  const entries = [
    ["key", ticket.key],
    ["title", ticket.title],
    ["type", ticket.type],
    ["status", ticket.status],
    ["resolution", ticket.resolution],
    ["url", ticket.url],
    ["assignee", ticket.assignee],
    ["reporter", ticket.reporter],
    ["parent", ticket.parent],
    ["priority", ticket.priority],
    ["story_points", ticket.storyPoints],
    ["sprint", ticket.sprint],
    ["due_date", ticket.dueDate],
    ["created", ticket.created],
    ["updated", ticket.updated],
    ["resolved", ticket.resolved],
  ];

  const lines = ["---"];
  entries.forEach(([key, value]) => {
    if (value) lines.push(`${key}: ${yamlScalar(value)}`);
  });

  [["labels", ticket.labels], ["components", ticket.components], ["fix_versions", ticket.fixVersions]]
    .forEach(([key, values]) => {
      if (values && values.length > 0) lines.push(`${key}: ${yamlList(values)}`);
    });

  // Absolute, so an agent can find the files no matter where this document is
  // read from — including when its contents are pasted somewhere else.
  if (ticket.assetDir) lines.push(`attachments_dir: ${yamlScalar(ticket.assetDir)}`);
  if (exportedAt) lines.push(`exported: ${yamlScalar(exportedAt)}`);
  if (ticket.degraded) lines.push("export_source: page");
  lines.push("---");
  return lines.join("\n");
}

function buildWarnings(ticket) {
  if (!ticket.warnings || ticket.warnings.length === 0) return "";
  const lines = ticket.warnings.map((warning) => `> - ${escapeMarkdown(warning)}`);
  return ["> **Export notes**", ">", ...lines].join("\n");
}

function buildOtherFields(otherFields) {
  if (!otherFields || otherFields.length === 0) return "";
  const rows = otherFields.map((field) => `| ${cellText(field.label)} | ${cellText(field.value)} |`);
  return joinBlocks(["## Other Fields", ["| Field | Value |", "| --- | --- |", ...rows].join("\n")]);
}

function buildLinks(links) {
  if (!links || links.length === 0) return "";
  const rows = links.map((link) => {
    const key = link.url ? `[${cellText(link.key)}](${link.url})` : cellText(link.key);
    return `| ${cellText(link.relationship)} | ${key} | ${cellText(link.summary)} | ${cellText(link.status)} |`;
  });
  const table = ["| Relationship | Key | Summary | Status |", "| --- | --- | --- | --- |", ...rows].join("\n");
  return joinBlocks(["## Linked Work Items", table]);
}

function buildChildren(children) {
  if (!children || children.length === 0) return "";
  const rows = children.map((child) => {
    const key = child.url ? `[${cellText(child.key)}](${child.url})` : cellText(child.key);
    return `| ${key} | ${cellText(child.summary)} | ${cellText(child.status)} |`;
  });
  const table = ["| Key | Summary | Status |", "| --- | --- | --- |", ...rows].join("\n");
  return joinBlocks(["## Child Work Items", table]);
}

function buildAttachments(attachments) {
  if (!attachments || attachments.length === 0) return "";

  // A local copy is linked when one was downloaded; the Jira URL stays available
  // in its own column, but it needs a login so it is never the primary link.
  const rows = attachments.map((attachment) => {
    const target = attachment.localPath || attachment.url;
    // A saved path can contain spaces, so it goes through linkTarget.
    const name = target ? `[${cellText(attachment.filename)}](${linkTarget(target)})` : cellText(attachment.filename);
    const source = attachment.url ? `[Jira](${linkTarget(attachment.url)})` : "";
    return `| ${name} | ${formatBytes(attachment.size)} | ${cellText(attachment.mimeType)} | ${cellText(attachment.created)} | ${source} |`;
  });

  const table = [
    "| File | Size | Type | Uploaded | Source |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
  return joinBlocks(["## Attachments", table]);
}

function buildRemoteLinks(remoteLinks) {
  if (!remoteLinks || remoteLinks.length === 0) return "";
  const items = remoteLinks.map((link) => `- ${escapeMarkdown(link.relationship)}: [${escapeMarkdown(link.title)}](${link.url})`);
  return joinBlocks(["## Remote Links", items.join("\n")]);
}

function buildComments(comments) {
  if (!comments || comments.length === 0) return "";

  const replies = new Map();
  comments.forEach((comment) => {
    if (!comment.parentId) return;
    if (!replies.has(comment.parentId)) replies.set(comment.parentId, []);
    replies.get(comment.parentId).push(comment);
  });

  const blocks = [`## Comments (${comments.length})`];
  let index = 0;

  comments.forEach((comment) => {
    if (comment.parentId) return;
    index += 1;
    blocks.push(renderComment(comment, `### ${index}. `));
    (replies.get(comment.id) || []).forEach((reply) => {
      blocks.push(renderComment(reply, "#### ↳ Reply: "));
    });
  });

  // A reply whose parent is missing still belongs in the export.
  comments
    .filter((comment) => comment.parentId && !comments.some((other) => other.id === comment.parentId))
    .forEach((orphan) => {
      index += 1;
      blocks.push(renderComment(orphan, `### ${index}. `));
    });

  return joinBlocks(blocks);
}

function renderComment(comment, prefix) {
  const parts = [comment.author || "Unknown"];
  if (comment.created) parts.push(comment.created);
  if (comment.edited) parts.push("edited");
  const heading = `${prefix}${escapeMarkdown(parts.join(" — "))}`;
  return joinBlocks([heading, comment.markdown]);
}

function cellText(value) {
  return escapeMarkdown(String(value == null ? "" : value)).replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

/**
 * Format a byte count for the attachments table.
 * @param {number} bytes - Size in bytes.
 * @returns {string} A human-readable size.
 */
export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${rounded} ${units[unit]}`;
}

/**
 * Save Markdown to a file using an object URL and a temporary link.
 * Content scripts cannot call chrome.downloads, and routing through the service
 * worker would need an extra permission for no real gain.
 * @param {string} filename - Target file name.
 * @param {string} markdown - File contents.
 */
export function downloadMarkdown(filename, markdown) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export the current ticket as a Markdown file, falling back to the rendered page
 * when the Jira API cannot be reached.
 * @param {Object} info - Basic info scraped at click time.
 * @param {HTMLElement} btn - The export button.
 * @param {Object} feedback - Feedback handler from createIconButtonFeedback.
 * @returns {Promise<void>} Resolves once feedback has been shown.
 */
export async function exportTicketMarkdown(info, btn, feedback) {
  if (!isIssueKey(info.ticketId)) {
    feedback.notfound(btn);
    return;
  }
  if (btn.dataset.exportBusy === "true") return;

  startLoading(btn);

  // The panel can be replaced mid-export. The download still belongs to the
  // ticket that was on screen at click time, so it goes ahead either way; only
  // the button updates are skipped once it is detached.
  const stillOnPage = () => btn.isConnected !== false;

  let ticket;
  try {
    const bundle = await fetchIssueBundle(info.ticketId);
    // Attachments are saved before the Markdown is written, so the images and
    // file links in it can point at the copies on disk.
    const assets = await saveAssetsIfEnabled(bundle, info, btn, feedback);
    if (assets.cancelled) {
      stopLoading(btn);
      return;
    }
    ticket = buildTicketFromRest(bundle, info, { assetPaths: assets.assetPaths });
    ticket.assetDir = assets.assetDir;
    ticket.warnings = ticket.warnings.concat(assets.warnings);
  } catch (error) {
    console.warn("[JIRA Ticket Copier] Jira API unavailable, exporting from the page:", error);
    try {
      ticket = readIssueFromDom(document, info);
    } catch (domError) {
      console.error("[JIRA Ticket Copier] Export failed:", domError);
      stopLoading(btn);
      if (stillOnPage()) feedback.fail(btn);
      return;
    }
  }

  stopLoading(btn);

  try {
    const markdown = buildTicketMarkdown(ticket, new Date().toISOString());
    downloadMarkdown(buildExportFilename(ticket.key, ticket.title), markdown);
    if (stillOnPage()) feedback.success(btn);
  } catch (error) {
    console.error("[JIRA Ticket Copier] Export failed:", error);
    if (stillOnPage()) feedback.fail(btn);
  }
}

/**
 * Save the ticket's attachments. Opting in is the optional downloads permission
 * itself, which the service worker checks, so there is no separate flag to keep
 * in sync. Any failure is reported in the file rather than stopping the export.
 *
 * When the ticket has attachments but the permission is missing, the user is asked
 * once what to do, unless they have chosen not to be asked again.
 * @returns {Promise<Object>} {assetPaths, assetDir, warnings, cancelled}.
 */
async function saveAssetsIfEnabled(bundle, info, btn, feedback) {
  const empty = { assetPaths: null, assetDir: "", warnings: [], cancelled: false };
  const attachments = readBundleAttachments(bundle);
  if (attachments.length === 0) return empty;

  const { key } = readBundleIdentity(bundle, info);

  if (!(await hasDownloadPermission())) {
    if (await getSetting("hideAttachmentPrompt", false)) return withOptInHint(empty);

    // Stand the spinner down while the user decides. resetContent owns restoring
    // the icon, so the feedback handler does it rather than stopLoading.
    stopLoading(btn);
    if (feedback.reset) feedback.reset(btn);

    const { action, remember } = await showAttachmentPrompt({ ticketId: key, attachments });
    if (remember) await setSetting("hideAttachmentPrompt", true);

    if (action === "settings") {
      openOptionsPage();
      return { ...empty, cancelled: true };
    }
    if (action === "cancel") return { ...empty, cancelled: true };

    startLoading(btn);
    return withOptInHint(empty);
  }

  try {
    const { assetPaths, assetDir, warnings } = await saveTicketAssets(key, attachments);
    return { assetPaths, assetDir, warnings, cancelled: false };
  } catch (error) {
    console.warn("[JIRA Ticket Copier] Could not download attachments:", error);
    return { ...empty, warnings: ["Attachments could not be downloaded, so they still link to Jira."] };
  }
}

function withOptInHint(result) {
  return {
    ...result,
    warnings: ["Attachments were not downloaded, so images and files link to Jira and need a login. Enable \"Download attachments\" in the extension options to save them alongside this file."],
  };
}

function startLoading(btn) {
  btn.dataset.exportBusy = "true";
  // The hover handlers in styles.js already stand down while this is set, so the
  // spinner is not repainted by a stray mouseenter.
  btn.dataset.feedbackActive = "true";
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  btn.style.cursor = "wait";
  btn.style.opacity = "0.75";
  btn.innerHTML = `<span class="${SPINNER_CLASS}"></span>`;
}

/**
 * Undo the loading state. feedbackActive is deliberately left set: the feedback
 * handler owns clearing it, and it also restores the real icon.
 */
function stopLoading(btn) {
  btn.dataset.exportBusy = "false";
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.style.cursor = "pointer";
  btn.style.opacity = "1";
  btn.style.setProperty("background", COLORS.iconButtonBg, "important");
}
