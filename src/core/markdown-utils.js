// Pure string helpers for building Markdown. No DOM, no chrome APIs.

const ESCAPE_PATTERN = /([\\`*_[\]<])/g;
const LINE_START_PATTERN = /^(\s*)([#>+\-=]|\d+[.)])(?=\s|$)/;
const FENCE_PATTERN = /^(`{3,}|~{3,})/;
const SAFE_YAML_SCALAR = /^[A-Za-z0-9][A-Za-z0-9 ._/@+-]*$/;

/**
 * Normalize invisible characters and line endings that Jira content is full of.
 * @param {string} text - Raw text.
 * @returns {string} Text with NBSP as space, zero-width chars removed, LF endings.
 */
export function normalizeWhitespace(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\ufeff]/g, "");
}

/**
 * Escape characters that would otherwise be read as Markdown syntax.
 * Never call this on code content, URLs or HTML we generate ourselves.
 * @param {string} text - Plain text run.
 * @returns {string} Escaped text.
 */
export function escapeMarkdown(text) {
  return normalizeWhitespace(text)
    .replace(ESCAPE_PATTERN, "\\$1")
    .replace(/~~/g, "\\~\\~");
}

/**
 * Escape leading characters that only mean something at the start of a line.
 * Run once on rendered inline content, before any list marker or indent is added,
 * so prose keeps its punctuation instead of being littered with backslashes.
 * @param {string} text - Rendered inline content, may contain hard breaks.
 * @returns {string} Text with ambiguous line starts escaped.
 */
export function escapeLineStarts(text) {
  return text
    .split("\n")
    .map((line) => line.replace(LINE_START_PATTERN, (match, indent, sigil) => `${indent}\\${sigil}`))
    .join("\n");
}

/**
 * Escape text that lands inside HTML we emit, such as a <summary> title.
 * @param {string} text - Plain text.
 * @returns {string} HTML-escaped text.
 */
export function escapeHtmlText(text) {
  return normalizeWhitespace(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build an HTML comment that cannot terminate early.
 * @param {string} text - Comment body.
 * @returns {string} A single-line HTML comment.
 */
export function htmlComment(text) {
  const safe = normalizeWhitespace(text).replace(/-{2,}/g, "- ").replace(/>/g, "").replace(/\n+/g, " ");
  return `<!-- ${safe.trim()} -->`;
}

/**
 * Wrap text in backticks, widening the fence so embedded backticks survive.
 * @param {string} text - Code content, used verbatim.
 * @returns {string} An inline code span.
 */
export function codeSpan(text) {
  const content = normalizeWhitespace(text).replace(/\n/g, " ");
  const runs = content.match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(longest + 1);
  const pad = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${fence}${pad}${content}${pad}${fence}`;
}

/**
 * Pick the fence for a code block so content containing backticks stays intact.
 * @param {string} code - Code block content.
 * @returns {string} A fence of at least three backticks.
 */
export function codeFence(code) {
  const runs = String(code).match(/^`{3,}/gm) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

/**
 * Format a link destination. URLs are never backslash-escaped; ambiguous ones
 * are wrapped in angle brackets instead.
 * @param {string} href - Destination URL.
 * @param {string} [title] - Optional link title.
 * @returns {string} The parenthesised part of a Markdown link, without the parens.
 */
export function linkTarget(href, title) {
  const url = String(href).trim();
  const needsWrapping = /[\s<>]/.test(url) || !hasBalancedParens(url);
  const target = needsWrapping ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url;
  if (!title) return target;
  return `${target} "${String(title).replace(/[\\"]/g, "\\$&")}"`;
}

function hasBalancedParens(url) {
  let depth = 0;
  for (const char of url) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Prefix every line of an already-rendered block. Children never apply their own
 * indent, which is what makes nested lists, quotes and fenced code compose.
 * @param {string} text - Rendered block, without leading or trailing newlines.
 * @param {string} firstPrefix - Prefix for the first line, e.g. "- ".
 * @param {string} restPrefix - Prefix for every following non-blank line.
 * @param {string} [blankLinePrefix=""] - Prefix for blank lines; ">" for quotes.
 * @returns {string} The indented block.
 */
export function indentBlock(text, firstPrefix, restPrefix, blankLinePrefix = "") {
  const lines = text.split("\n");
  return lines
    .map((line, index) => {
      const prefix = index === 0 ? firstPrefix : restPrefix;
      if (line === "") return index === 0 ? firstPrefix.trimEnd() : blankLinePrefix;
      return `${prefix}${line}`;
    })
    .join("\n");
}

/**
 * Join rendered blocks with exactly one blank line, dropping empty ones.
 * @param {string[]} blocks - Rendered blocks.
 * @param {string} [separator="\n\n"] - Separator between blocks.
 * @returns {string} The joined document body.
 */
export function joinBlocks(blocks, separator = "\n\n") {
  return blocks.filter((block) => block !== "" && block != null).join(separator);
}

/**
 * Tidy a finished document. Fence-aware on purpose: whitespace inside a code
 * block can be significant, so those lines are left byte-identical.
 * @param {string} markdown - Assembled Markdown.
 * @returns {string} Markdown with no trailing spaces or triple blank lines.
 */
export function normalizeMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let openFence = null;
  let blankRun = 0;

  lines.forEach((line) => {
    const fence = line.trim().match(FENCE_PATTERN);
    if (openFence) {
      output.push(line);
      if (fence && fence[1][0] === openFence[0] && fence[1].length >= openFence.length) {
        openFence = null;
      }
      return;
    }
    if (fence) {
      openFence = fence[1];
      blankRun = 0;
      output.push(line.replace(/[ \t]+$/, ""));
      return;
    }

    const trimmed = line.replace(/[ \t]+$/, "");
    if (trimmed === "") {
      blankRun += 1;
      if (blankRun > 1 || output.length === 0) return;
      output.push("");
      return;
    }
    blankRun = 0;
    output.push(trimmed);
  });

  while (output.length > 0 && output[output.length - 1] === "") output.pop();
  return output.length === 0 ? "" : `${output.join("\n")}\n`;
}

/**
 * Render a value as a YAML scalar, quoting only when it would otherwise be
 * ambiguous. Ticket titles contain colons constantly, so this matters.
 * @param {*} value - Value to render.
 * @returns {string} A YAML scalar.
 */
export function yamlScalar(value) {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = normalizeWhitespace(String(value)).replace(/\n+/g, " ").trim();
  if (text === "") return "\"\"";
  if (SAFE_YAML_SCALAR.test(text) && !/: /.test(text)) return text;
  return `"${text.replace(/[\\"]/g, "\\$&")}"`;
}

/**
 * Render a list of values as a YAML flow sequence.
 * @param {Array} values - Values to render.
 * @returns {string} A YAML flow sequence, e.g. "[a, b]".
 */
export function yamlList(values) {
  const items = (values || []).map((value) => yamlScalar(value)).filter((item) => item !== "");
  return `[${items.join(", ")}]`;
}
