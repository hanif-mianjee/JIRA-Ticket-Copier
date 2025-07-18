// Utility functions and constants for JIRA Ticket Copier
// Used for DOM extraction, formatting, and UI styling

export const COLORS = {
  buttonBg: '#1558BC',
  buttonBgHover: '#0065FF',
  buttonBgActive: '#0052CC',
  buttonText: '#BFC1C4',
  dropdownBg: '#fff',
  dropdownText: '#333',
  dropdownHoverBg: '#1558BC',
  dropdownHoverText: '#fff',
  error: '#FF5630',
};

export const STATUS_LIST = [
  'Waiting for Input',
  'Analysis',
  'Analysis/Comment added',
  'Blocked',
  'Blocked/Comment added',
  'Blocked/Waiting for Input',
  'In Review',
  'PR Raised',
  'Review suggestions applied',
];

export function getJiraElements() {
  return {
    idEl: document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
    ),
    statusEl: document.querySelector(
      '[data-testid="issue-field-status.ui.status-view.status-button.status-button"]',
    ),
    titleEl: document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
    ),
    jiraStatusWrapper: document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.status.status-field-wrapper"]',
    ),
    idContainer: document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]',
    ),
  };
}

export function extractJiraTicketInfo() {
  const { idEl, statusEl, titleEl } = getJiraElements();
  return {
    ticketId: idEl ? idEl.textContent.trim() : '',
    status: statusEl ? statusEl.textContent.trim() : '',
    title: titleEl ? titleEl.textContent.trim() : '',
  };
}

export function formatJiraString({ ticketId, status, title }) {
  return `${ticketId}: ${status} - ${title}`;
}

export function setButtonStyle(btn, isLeft) {
  btn.style.background = COLORS.buttonBg;
  btn.style.color = COLORS.buttonText;
  btn.style.border = 'none';
  btn.style.borderRadius = isLeft ? '3px 0 0 3px' : '0 3px 3px 0';
  btn.style.padding = '4px 10px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '14px';
  btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
  btn.style.transition = 'background 0.2s';
  btn.style.outline = 'none';
  btn.onmouseenter = () => (btn.style.background = COLORS.buttonBgHover);
  btn.onmouseleave = () => (btn.style.background = COLORS.buttonBgActive);
  btn.onmousedown = () => (btn.style.outline = 'none');
  btn.onfocus = () => (btn.style.outline = 'none');
}

export function setDropdownItemStyle(item, isDefault = false) {
  item.style.padding = '6px 12px';
  item.style.cursor = 'pointer';
  item.style.background = COLORS.dropdownBg;
  item.style.color = COLORS.dropdownText;
  item.style.fontSize = '14px';
  item.onmouseenter = () => {
    item.style.background = COLORS.dropdownHoverBg;
    item.style.color = COLORS.dropdownHoverText;
  };
  item.onmouseleave = () => {
    item.style.background = COLORS.dropdownBg;
    item.style.color = COLORS.dropdownText;
  };
}
