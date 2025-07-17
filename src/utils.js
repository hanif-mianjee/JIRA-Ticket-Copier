// Utility functions for JIRA Ticket Copier
// Used for DOM extraction and formatting

export function extractJiraTicketInfo() {
  const idEl = document.querySelector(
    '[data-test-id="issue.views.issue-base.issue-header.issue-key"]'
  );
  const statusEl = document.querySelector(
    '[data-test-id="issue.views.issue-base.status.status-field"]'
  );
  const titleEl = document.querySelector(
    '[data-test-id="issue.views.issue-base.summary.heading"]'
  );
  const ticketId = idEl ? idEl.textContent.trim() : "";
  const status = statusEl ? statusEl.textContent.trim() : "";
  const title = titleEl ? titleEl.textContent.trim() : "";
  return { ticketId, status, title };
}

export function formatJiraString({ ticketId, status, title }) {
  return `${ticketId}: ${status} - ${title}`;
}
