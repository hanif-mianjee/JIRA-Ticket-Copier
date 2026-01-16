// Re-export from new modules for backward compatibility with tests
export { COLORS, setButtonStyle, setDropdownItemStyle } from "./ui/styles.js";
export { STATUS_LIST, PAGE_CONFIGS } from "./config/selectors.js";
import { PAGE_CONFIGS as _PAGE_CONFIGS } from "./config/selectors.js";

function getTicketConfig() {
  return _PAGE_CONFIGS.find((c) => c.id === "ticket-detail");
}

export function getJiraElements() {
  const config = getTicketConfig();
  return {
    idEl: document.querySelector(config.selectors.ticketId),
    statusEl: document.querySelector(config.selectors.status),
    titleEl: document.querySelector(config.selectors.title),
    jiraStatusWrapper: document.querySelector(config.selectors.container),
    idContainer: document.querySelector(config.selectors.insertAfter),
  };
}

export function extractJiraTicketInfo() {
  const { idEl, statusEl, titleEl } = getJiraElements();
  let status = statusEl?.textContent?.trim() || "";
  if (/[{}]/.test(status)) status = "";
  return {
    ticketId: idEl?.textContent?.trim() || "",
    status,
    title: titleEl?.textContent?.trim() || "",
    ticketUrl: window.location.href,
  };
}

export function formatJiraString({ ticketId, status, title }) {
  return `${ticketId}: ${status} - ${title}`;
}
