import { COLORS } from "./styles.js";

const MODAL_STYLES_ID = "jira-copier-modal-styles";
const MODAL_ID = "jira-copier-export-modal";

/**
 * Append modal styles only once to prevent duplicate style tags
 */
function appendModalStyles() {
  if (document.getElementById(MODAL_STYLES_ID)) return;

  const style = document.createElement("style");
  style.id = MODAL_STYLES_ID;
  style.textContent = `
    @keyframes jiraCopierModalIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    #${MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(9, 30, 66, 0.54);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #${MODAL_ID} .jira-copier-modal-card {
      width: min(560px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      overflow-y: auto;
      background: #FFFFFF;
      color: ${COLORS.dropdownText};
      border-radius: 4px;
      box-shadow: 0 8px 24px rgba(9, 30, 66, 0.28);
      padding: 24px;
      animation: jiraCopierModalIn 0.15s ease-out;
    }
    #${MODAL_ID} h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: ${COLORS.dropdownText};
    }
    #${MODAL_ID} p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.5;
      color: #44546F;
    }
    #${MODAL_ID} ol {
      margin: 0 0 12px;
      padding-left: 20px;
      font-size: 14px;
      line-height: 1.6;
      color: #44546F;
    }
    #${MODAL_ID} .jira-copier-modal-files {
      margin: 0 0 16px;
      padding: 12px 14px;
      background: #F4F5F7;
      border-radius: 3px;
      font-size: 13px;
      color: #44546F;
      max-height: 132px;
      overflow-y: auto;
    }
    #${MODAL_ID} .jira-copier-modal-files span {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${MODAL_ID} .jira-copier-modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    #${MODAL_ID} .jira-copier-modal-remember {
      margin-right: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #44546F;
      cursor: pointer;
    }
    #${MODAL_ID} button {
      border: none;
      border-radius: 3px;
      padding: 8px 14px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    #${MODAL_ID} .jira-copier-modal-primary {
      background: ${COLORS.buttonBg};
      color: #FFFFFF;
    }
    #${MODAL_ID} .jira-copier-modal-primary:hover {
      background: ${COLORS.buttonBgHover};
    }
    #${MODAL_ID} .jira-copier-modal-secondary {
      background: rgba(9, 30, 66, 0.06);
      color: ${COLORS.dropdownText};
    }
    #${MODAL_ID} .jira-copier-modal-secondary:hover {
      background: rgba(9, 30, 66, 0.12);
    }
    @media (prefers-reduced-motion: reduce) {
      #${MODAL_ID} .jira-copier-modal-card { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Ask what to do about a ticket's attachments when they cannot be downloaded yet.
 * Shown only when the ticket actually has attachments and the optional downloads
 * permission has not been granted.
 * @param {Object} details - Prompt details.
 * @param {string} details.ticketId - Issue key, used in the copy.
 * @param {Array} details.attachments - Attachments found on the ticket.
 * @returns {Promise<Object>} {action: "export"|"settings"|"cancel", remember: boolean}.
 */
export function showAttachmentPrompt({ ticketId, attachments }) {
  appendModalStyles();

  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const imageCount = attachments.filter((file) => (file.mimeType || "").startsWith("image/")).length;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Export attachments");

    const card = document.createElement("div");
    card.className = "jira-copier-modal-card";
    card.innerHTML = `
      <h2>${ticketId} has ${describeCount(attachments.length, imageCount)}</h2>
      <p>
        Images and files can be saved next to the exported Markdown and linked by their full path on disk,
        so an AI coding agent can open them. Right now they would be links to Jira that need a login.
      </p>
      <div class="jira-copier-modal-files">${attachments.map(fileRow).join("")}</div>
      <p><strong>To include them:</strong></p>
      <ol>
        <li>Open the extension settings.</li>
        <li>Turn on <strong>Download attachments</strong> and accept Chrome's permission prompt.</li>
        <li>Come back here and click export again.</li>
      </ol>
      <div class="jira-copier-modal-actions">
        <label class="jira-copier-modal-remember">
          <input type="checkbox" data-role="remember" />
          Don't ask again
        </label>
        <button type="button" class="jira-copier-modal-secondary" data-role="export">Export without attachments</button>
        <button type="button" class="jira-copier-modal-primary" data-role="settings">Open settings</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const remember = card.querySelector("[data-role=\"remember\"]");
    const finish = (action) => {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      resolve({ action, remember: Boolean(remember && remember.checked) });
    };

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      finish("cancel");
    }

    card.querySelector("[data-role=\"export\"]").addEventListener("click", () => finish("export"));
    card.querySelector("[data-role=\"settings\"]").addEventListener("click", () => finish("settings"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish("cancel");
    });
    document.addEventListener("keydown", onKeyDown, true);

    card.querySelector("[data-role=\"settings\"]").focus();
  });
}

function describeCount(total, imageCount) {
  const files = `${total} attachment${total === 1 ? "" : "s"}`;
  if (imageCount === 0) return files;
  if (imageCount === total) return `${total} image${total === 1 ? "" : "s"}`;
  return `${files}, ${imageCount} of them image${imageCount === 1 ? "" : "s"}`;
}

function fileRow(file) {
  const name = String(file.filename || "attachment").replace(/[<>&]/g, "");
  const type = String(file.mimeType || "").replace(/[<>&]/g, "");
  return `<span>${name}${type ? ` — ${type}` : ""}</span>`;
}
