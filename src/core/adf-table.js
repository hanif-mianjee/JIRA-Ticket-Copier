// GFM tables cannot hold newlines or merged cells, so ADF tables are laid out on
// an occupancy grid and each cell is flattened to a single line.

const HEADER_TYPE = "tableHeader";

/**
 * Render an ADF table as a GitHub-flavoured Markdown table.
 * @param {Object} node - The table node.
 * @param {Object} ctx - Render context.
 * @param {Function} renderBlocks - Block renderer, injected to avoid a cycle.
 * @returns {string} A Markdown table, or "" when the table has no cells.
 */
export function renderTable(node, ctx, renderBlocks) {
  const rows = (node.content || []).filter((row) => row && row.type === "tableRow");
  if (rows.length === 0) return "";

  const cellCtx = { ...ctx, inTable: true, depth: ctx.depth + 1 };
  const grid = buildGrid(rows, cellCtx, renderBlocks);
  if (grid.width === 0) return "";

  const lines = [];
  const firstRowIsHeader = grid.rows.length > 0 && grid.rows[0].isHeader;

  if (firstRowIsHeader) {
    lines.push(toRow(grid.rows[0].cells, grid.width));
  } else {
    // GFM requires a header row. An empty one loses nothing, whereas promoting
    // the first data row would drop it and inventing names would invent schema.
    lines.push(toRow([], grid.width));
  }
  lines.push(`|${" --- |".repeat(grid.width)}`);

  grid.rows.slice(firstRowIsHeader ? 1 : 0).forEach((row) => {
    lines.push(toRow(row.cells, grid.width));
  });

  return lines.join("\n");
}

function buildGrid(rows, ctx, renderBlocks) {
  const pending = [];
  const built = [];
  let width = 0;

  rows.forEach((row) => {
    const cells = [];
    const cellNodes = (row.content || []).filter((cell) => cell && (cell.type === "tableCell" || cell.type === HEADER_TYPE));
    let column = 0;

    cellNodes.forEach((cell) => {
      while (pending[column] > 0) {
        pending[column] -= 1;
        cells[column] = cells[column] === undefined ? "" : cells[column];
        column += 1;
      }

      const attrs = cell.attrs || {};
      const colspan = toSpan(attrs.colspan);
      const rowspan = toSpan(attrs.rowspan);
      cells[column] = flattenCell(cell, ctx, renderBlocks);

      for (let offset = 0; offset < colspan; offset += 1) {
        if (offset > 0) cells[column + offset] = "";
        if (rowspan > 1) pending[column + offset] = rowspan - 1;
      }
      column += colspan;
    });

    while (pending[column] > 0) {
      pending[column] -= 1;
      cells[column] = cells[column] === undefined ? "" : cells[column];
      column += 1;
    }

    width = Math.max(width, column);
    built.push({ cells, isHeader: cellNodes.length > 0 && cellNodes.every((cell) => cell.type === HEADER_TYPE) });
  });

  return { rows: built, width };
}

function toSpan(value) {
  const span = Number(value);
  return Number.isInteger(span) && span > 1 ? span : 1;
}

function flattenCell(cell, ctx, renderBlocks) {
  const rendered = renderBlocks(cell.content, ctx);
  return rendered
    .replace(/\n/g, "<br>")
    .replace(/(?:<br>){3,}/g, "<br><br>")
    .replace(/\|/g, "\\|")
    .trim();
}

function toRow(cells, width) {
  const padded = [];
  for (let index = 0; index < width; index += 1) {
    padded.push(cells[index] === undefined ? "" : cells[index]);
  }
  return `| ${padded.join(" | ")} |`;
}
