import {
  codeSpan,
  escapeMarkdown,
  htmlComment,
  linkTarget,
  normalizeWhitespace,
} from "./markdown-utils.js";

// Marks are applied innermost first, ignoring the order they arrive in.
// `code` must be innermost because `**x**` inside a code span renders literally,
// and `link` must be outermost because [`npm test`](url) works while the
// reverse nesting turns the brackets into visible text.
const MARK_ORDER = ["code", "subsup", "strike", "em", "strong", "underline", "link"];

// Kept for content, no Markdown equivalent worth emitting. `indentation` is
// dropped deliberately: mapping its level to spaces turns paragraphs into
// code blocks, which corrupts content rather than just losing styling.
const IGNORED_MARKS = ["textColor", "backgroundColor", "alignment", "indentation", "annotation", "border"];

const ISSUE_PATH = /\/browse\/([A-Z][A-Z0-9_]*-\d+)\b/;

/**
 * Render a list of inline ADF nodes.
 * @param {Array} nodes - Inline nodes.
 * @param {Object} ctx - Render context.
 * @returns {string} Concatenated inline Markdown.
 */
export function renderInline(nodes, ctx) {
  if (!Array.isArray(nodes)) return "";
  return nodes.map((node) => renderInlineNode(node, ctx)).join("");
}

/**
 * Render a single inline ADF node.
 * @param {Object} node - Inline node.
 * @param {Object} ctx - Render context.
 * @returns {string} Inline Markdown.
 */
export function renderInlineNode(node, ctx) {
  if (!node || typeof node !== "object") return "";
  const renderer = INLINE_RENDERERS[node.type];
  if (renderer) return renderer(node, ctx);
  return renderUnknownInline(node, ctx);
}

function renderUnknownInline(node, ctx) {
  ctx.stats.unsupported.add(node.type || "unknown");

  const original = node.attrs && node.attrs.originalValue;
  if (original && typeof original === "object") return renderInlineNode(original, ctx);
  if (Array.isArray(node.content) && node.content.length > 0) return renderInline(node.content, ctx);
  if (typeof node.text === "string") return escapeMarkdown(node.text);

  const attrs = node.attrs || {};
  const label = attrs.text || attrs.title || attrs.alt || attrs.shortName || attrs.url;
  if (label) return escapeMarkdown(label);
  return ctx.inTable ? "" : htmlComment(`unsupported inline node: ${node.type}`);
}

const INLINE_RENDERERS = {
  text: (node, ctx) => {
    const marks = Array.isArray(node.marks) ? node.marks : [];
    const isCode = marks.some((mark) => mark && mark.type === "code");
    const body = isCode ? normalizeWhitespace(node.text || "") : escapeMarkdown(node.text || "");
    return applyMarks(body, marks, isCode, ctx);
  },

  hardBreak: (node, ctx) => (ctx.inTable ? "<br>" : "\\\n"),

  emoji: (node) => {
    const attrs = node.attrs || {};
    return normalizeWhitespace(attrs.text || attrs.shortName || "");
  },

  mention: (node) => {
    const attrs = node.attrs || {};
    if (attrs.text) return escapeMarkdown(attrs.text);
    return escapeMarkdown(`@${attrs.id || "unknown"}`);
  },

  date: (node) => {
    const raw = (node.attrs || {}).timestamp;
    const ms = Number(raw);
    if (!Number.isFinite(ms)) return escapeMarkdown(String(raw ?? ""));
    return new Date(ms).toISOString().slice(0, 10);
  },

  status: (node) => {
    const text = (node.attrs || {}).text;
    return text ? codeSpan(`[${text}]`) : "";
  },

  inlineCard: (node, ctx) => renderCard(node, ctx),

  mediaInline: (node, ctx) => renderMedia(node, ctx),

  placeholder: () => "",

  unsupportedInline: (node, ctx) => renderUnknownInline(node, ctx),
};

/**
 * Render a media node. ADF carries no usable URL of its own, so the caller can
 * supply a resolver that maps the media id back to a real attachment.
 * @param {Object} node - A media, mediaInline or mediaSingle child node.
 * @param {Object} ctx - Render context.
 * @returns {string} Markdown for the attachment reference.
 */
export function renderMedia(node, ctx) {
  const attrs = node.attrs || {};

  if (attrs.type === "external" && attrs.url) {
    return `![${escapeMarkdown(attrs.alt || "image")}](${linkTarget(attrs.url)})`;
  }

  const resolved = typeof ctx.options.resolveMedia === "function" ? ctx.options.resolveMedia(attrs) : null;
  const label = attrs.alt || (resolved && resolved.label) || `media ${String(attrs.id || "").slice(0, 8)}`;

  if (resolved && resolved.href) {
    const link = `[${escapeMarkdown(label)}](${linkTarget(resolved.href)})`;
    return resolved.isImage ? `!${link}` : link;
  }

  const reference = `[attachment: ${escapeMarkdown(label)}](#attachments)`;
  if (ctx.inTable) return reference;
  return `${reference} ${htmlComment(`media id=${attrs.id || "unknown"} type=${attrs.type || "file"}`)}`;
}

/**
 * Render an inline, block or embed card. Same attrs shape for all three.
 * @param {Object} node - Card node.
 * @param {Object} ctx - Render context.
 * @returns {string} Markdown link or autolink.
 */
export function renderCard(node, ctx) {
  const attrs = node.attrs || {};
  const data = attrs.data || {};
  const url = attrs.url || data.url;
  if (!url) return ctx.inTable ? "" : htmlComment(`card without url: ${node.type}`);

  const name = data.name || data.title;
  if (name) return `[${escapeMarkdown(name)}](${linkTarget(url)})`;

  const key = shortenIssueLink(url, ctx.options.baseUrl);
  if (key) return `[${key}](${linkTarget(url)})`;
  return `<${url}>`;
}

function shortenIssueLink(url, baseUrl) {
  if (!baseUrl || !String(url).startsWith(baseUrl)) return null;
  const match = ISSUE_PATH.exec(url);
  return match ? match[1] : null;
}

/**
 * Wrap text in its marks, innermost first. Emphasis delimiters cannot touch
 * whitespace on the inside, so surrounding spaces are re-attached outside them.
 * @param {string} text - Already escaped (or raw, for code) text.
 * @param {Array} marks - Marks from the text node, in any order.
 * @param {boolean} isCode - Whether a code mark is present.
 * @param {Object} ctx - Render context.
 * @returns {string} Marked-up inline Markdown.
 */
export function applyMarks(text, marks, isCode, ctx) {
  const active = MARK_ORDER
    .map((type) => marks.find((mark) => mark && mark.type === type))
    .filter(Boolean);

  marks.forEach((mark) => {
    if (!mark || !mark.type) return;
    if (MARK_ORDER.includes(mark.type) || IGNORED_MARKS.includes(mark.type)) return;
    ctx.stats.unsupported.add(`mark:${mark.type}`);
  });

  if (active.length === 0) return text;

  const leading = isCode ? "" : (/^\s*/.exec(text)[0] || "");
  const trailing = isCode ? "" : (/\s*$/.exec(text)[0] || "");
  const core = isCode ? text : text.slice(leading.length, text.length - trailing.length);
  if (core === "") return text;

  let result = core;
  active.forEach((mark) => {
    result = wrapMark(result, mark);
  });
  return `${leading}${result}${trailing}`;
}

function wrapMark(text, mark) {
  const attrs = mark.attrs || {};
  switch (mark.type) {
  case "code":
    return codeSpan(text);
  case "subsup":
    return attrs.type === "sub" ? `<sub>${text}</sub>` : `<sup>${text}</sup>`;
  case "strike":
    return `~~${text}~~`;
  case "em":
    return `_${text}_`;
  case "strong":
    return `**${text}**`;
  case "underline":
    return `<u>${text}</u>`;
  case "link":
    return attrs.href ? `[${text}](${linkTarget(attrs.href, attrs.title)})` : text;
  default:
    return text;
  }
}
