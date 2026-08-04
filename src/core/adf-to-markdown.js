import { renderCard, renderInline, renderMedia } from "./adf-inline.js";
import { renderTable } from "./adf-table.js";
import {
  codeFence,
  codeSpan,
  escapeHtmlText,
  escapeLineStarts,
  escapeMarkdown,
  htmlComment,
  indentBlock,
  joinBlocks,
  normalizeMarkdown,
} from "./markdown-utils.js";

const MAX_DEPTH = 40;
const MAX_NODES = 20000;
const LIST_TYPES = ["bulletList", "orderedList", "taskList", "decisionList"];

const PANEL_LABELS = {
  info: "Info",
  note: "Note",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

const LANGUAGE_ALIASES = {
  "text": "",
  "plaintext": "",
  "plain": "",
  "none": "",
  "c++": "cpp",
  "c#": "csharp",
  "sh": "bash",
  "shell": "bash",
  "html/xml": "html",
};

/**
 * Convert an Atlassian Document Format document to Markdown.
 * Never throws: on failure it returns whatever was rendered plus a diagnostic.
 * @param {Object|string|null} adf - An ADF doc node, a plain string, or null.
 * @param {Object} [options] - Conversion options.
 * @param {string} [options.baseUrl] - Site base URL, used to shorten issue links.
 * @param {number} [options.headingOffset=0] - Added to every heading level.
 * @param {Function} [options.resolveMedia] - Maps media attrs to {label, href, isImage}.
 * @returns {string} Markdown ending in a single newline, or "" when empty.
 */
export function adfToMarkdown(adf, options = {}) {
  if (adf == null) return "";
  if (typeof adf === "string") return adf.trim();
  if (typeof adf !== "object") return "";

  const ctx = createContext(options);
  try {
    return normalizeMarkdown(renderBlockNode(adf, ctx));
  } catch (error) {
    return normalizeMarkdown(htmlComment(`adf conversion failed: ${error.message}`));
  }
}

/**
 * Convert a single ADF node in block context.
 * @param {Object} node - Any ADF node.
 * @param {Object} [options] - Same options as adfToMarkdown.
 * @returns {string} Markdown for that node.
 */
export function adfNodeToMarkdown(node, options = {}) {
  if (!node || typeof node !== "object") return "";
  return normalizeMarkdown(renderBlockNode(node, createContext(options)));
}

/**
 * Check whether a field value is an ADF document, so rich-text custom fields can
 * be discovered without hardcoding their ids.
 * @param {*} value - Candidate field value.
 * @returns {boolean} True when the value looks like an ADF doc.
 */
export function isAdfDoc(value) {
  return Boolean(value) && typeof value === "object" && value.type === "doc" && Array.isArray(value.content);
}

function createContext(options) {
  return {
    options: { headingOffset: 0, ...options },
    depth: 0,
    inTable: false,
    stats: { nodes: 0, unsupported: new Set() },
  };
}

/**
 * Render a list of block nodes, dropping empties so blocks are always separated
 * by exactly one blank line.
 * @param {Array} nodes - Block nodes.
 * @param {Object} ctx - Render context.
 * @returns {string} The joined blocks.
 */
export function renderBlocks(nodes, ctx) {
  if (!Array.isArray(nodes)) return "";
  return joinBlocks(nodes.map((node) => renderBlockNode(node, ctx)));
}

function renderBlockNode(node, ctx) {
  if (!node || typeof node !== "object") return "";

  ctx.stats.nodes += 1;
  if (ctx.stats.nodes > MAX_NODES) return htmlComment("adf: node limit exceeded, output truncated");
  if (ctx.depth > MAX_DEPTH) return htmlComment("adf: max nesting depth exceeded");

  const renderer = BLOCK_RENDERERS[node.type];
  const childCtx = { ...ctx, depth: ctx.depth + 1 };
  if (renderer) return renderer(node, childCtx);
  return renderUnknownBlock(node, childCtx);
}

function renderUnknownBlock(node, ctx) {
  ctx.stats.unsupported.add(node.type || "unknown");

  const original = node.attrs && node.attrs.originalValue;
  if (original && typeof original === "object") return renderBlockNode(original, ctx);

  if (Array.isArray(node.content) && node.content.length > 0) {
    const body = renderBlocks(node.content, ctx);
    if (ctx.inTable) return body;
    return joinBlocks([htmlComment(`unsupported: ${node.type}`), body]);
  }

  if (typeof node.text === "string") return escapeMarkdown(node.text);

  const attrs = node.attrs || {};
  const label = attrs.text || attrs.title || attrs.alt || attrs.url;
  if (label) return escapeMarkdown(label);
  return htmlComment(`unsupported: ${node.type}`);
}

const BLOCK_RENDERERS = {
  doc: (node, ctx) => renderBlocks(node.content, ctx),

  paragraph: (node, ctx) => {
    const inline = renderInline(node.content, ctx);
    if (inline.trim() === "") return "";
    return ctx.inTable ? inline : escapeLineStarts(inline);
  },

  heading: (node, ctx) => {
    const inline = renderInline(node.content, ctx);
    if (inline.trim() === "") return "";
    if (ctx.inTable) return `**${inline}**`;
    const level = Number((node.attrs || {}).level) || 1;
    const clamped = Math.min(6, Math.max(1, level + ctx.options.headingOffset));
    return `${"#".repeat(clamped)} ${escapeLineStarts(inline)}`;
  },

  rule: (node, ctx) => (ctx.inTable ? "<hr>" : "---"),

  hardBreak: (node, ctx) => (ctx.inTable ? "<br>" : ""),

  bulletList: (node, ctx) => renderList(node, ctx, () => "- "),

  orderedList: (node, ctx) => {
    const start = Number((node.attrs || {}).order);
    const first = Number.isInteger(start) && start > 0 ? start : 1;
    return renderList(node, ctx, (index) => `${first + index}. `);
  },

  listItem: (node, ctx) => renderListItemBody(node, ctx),

  taskList: (node, ctx) => renderItemList(node, ctx),

  // Task and decision items hold inline content directly, not paragraphs.
  taskItem: (node, ctx) => {
    const marker = (node.attrs || {}).state === "DONE" ? "- [x] " : "- [ ] ";
    return indentBlock(renderItemText(node, ctx), marker, " ".repeat(marker.length));
  },

  decisionList: (node, ctx) => renderItemList(node, ctx),

  decisionItem: (node, ctx) => indentBlock(renderItemText(node, ctx), "- **Decision:** ", "  "),

  codeBlock: (node, ctx) => {
    const code = collectText(node.content);
    if (ctx.inTable) return renderCodeInCell(code);
    const fence = codeFence(code);
    return `${fence}${resolveLanguage((node.attrs || {}).language)}\n${code}\n${fence}`;
  },

  blockquote: (node, ctx) => indentBlock(renderBlocks(node.content, ctx), "> ", "> ", ">"),

  panel: (node, ctx) => {
    const type = (node.attrs || {}).panelType;
    const label = PANEL_LABELS[type] || "Note";
    const body = joinBlocks([`**${label}**`, renderBlocks(node.content, ctx)]);
    return indentBlock(body, "> ", "> ", ">");
  },

  expand: (node, ctx) => renderExpand(node, ctx),
  nestedExpand: (node, ctx) => renderExpand(node, ctx),

  table: (node, ctx) => renderTable(node, ctx, renderBlocks),

  media: (node, ctx) => renderMedia(node, ctx),
  mediaInline: (node, ctx) => renderMedia(node, ctx),

  mediaGroup: (node, ctx) => joinBlocks((node.content || []).map((child) => renderBlockNode(child, ctx)), "\n"),

  // Transparent containers: flattening them preserves reading order, and a
  // visual marker between layout columns would read as a real section break.
  mediaSingle: (node, ctx) => renderBlocks(node.content, ctx),
  layoutSection: (node, ctx) => renderBlocks(node.content, ctx),
  layoutColumn: (node, ctx) => renderBlocks(node.content, ctx),

  blockCard: (node, ctx) => renderCard(node, ctx),
  embedCard: (node, ctx) => renderCard(node, ctx),

  extension: (node, ctx) => renderExtension(node, ctx),
  inlineExtension: (node, ctx) => renderExtension(node, ctx),

  bodiedExtension: (node, ctx) => {
    const key = (node.attrs || {}).extensionKey || "unknown";
    return joinBlocks([htmlComment(`extension: ${key}`), renderBlocks(node.content, ctx)]);
  },
};

function renderList(node, ctx, markerFor) {
  const items = (node.content || []).filter(Boolean);
  const rendered = items
    .map((item, index) => {
      const marker = markerFor(index);
      const body = renderBlockNode(item, ctx);
      if (body === "") return marker.trimEnd();
      if (item.type === "listItem") return indentBlock(body, marker, " ".repeat(marker.length));
      return body;
    })
    .filter((line) => line !== "");
  return rendered.join("\n");
}

function renderItemList(node, ctx) {
  const rendered = (node.content || [])
    .filter(Boolean)
    .map((item) => renderBlockNode(item, ctx))
    .filter((line) => line !== "");
  return rendered.join("\n");
}

function renderListItemBody(node, ctx) {
  return renderListItemBlocks(node.content, ctx);
}

function renderItemText(node, ctx) {
  const inline = renderInline(node.content, ctx);
  return ctx.inTable ? inline : escapeLineStarts(inline);
}

/**
 * Join the blocks of a list item. A list directly after a paragraph is joined
 * tightly so nested lists do not gain a blank line before every sublist.
 */
function renderListItemBlocks(nodes, ctx) {
  if (!Array.isArray(nodes)) return "";
  let output = "";
  let previous = null;

  nodes.forEach((child) => {
    const rendered = renderBlockNode(child, ctx);
    if (rendered === "") return;
    if (output === "") {
      output = rendered;
    } else if (previous === "paragraph" && LIST_TYPES.includes(child.type)) {
      output += `\n${rendered}`;
    } else {
      output += `\n\n${rendered}`;
    }
    previous = child.type;
  });

  return output;
}

function renderExpand(node, ctx) {
  const title = escapeHtmlText((node.attrs || {}).title || "Details");
  const body = renderBlocks(node.content, ctx);
  if (ctx.inTable) return body === "" ? `**${title}**` : `**${title}** — ${body}`;
  return `<details><summary>${title}</summary>\n\n${body}\n\n</details>`;
}

function renderExtension(node, ctx) {
  const attrs = node.attrs || {};
  if (attrs.text) return escapeMarkdown(attrs.text);
  const key = attrs.extensionKey || attrs.extensionType || "unknown";
  ctx.stats.unsupported.add(`extension:${key}`);
  return htmlComment(`extension: ${key}`);
}

function renderCodeInCell(code) {
  const lines = code.split("\n");
  if (lines.length <= 1) return codeSpan(code);
  return `<code>${lines.map((line) => escapeHtmlText(line)).join("<br>")}</code>`;
}

function resolveLanguage(language) {
  if (!language) return "";
  const key = String(language).trim().toLowerCase();
  const alias = LANGUAGE_ALIASES[key];
  return alias === undefined ? key : alias;
}

function collectText(nodes) {
  if (!Array.isArray(nodes)) return "";
  return nodes
    .map((node) => {
      if (!node || typeof node !== "object") return "";
      if (typeof node.text === "string") return node.text;
      return collectText(node.content);
    })
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n");
}
