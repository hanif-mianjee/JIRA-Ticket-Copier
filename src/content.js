// Content script for JIRA Ticket Copier
// Injects a button into JIRA ticket pages to copy ticket info to clipboard

/**
 * Extracts JIRA ticket info (ID, status, title) from the DOM.
 * @returns {Object} { ticketId, status, title }
 */

(function () {
  // Utility to extract ticket info from DOM
  function extractJiraTicketInfo() {
    // Try to find ticket ID, status, and title using JIRA cloud DOM structure
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

  /**
   * Formats the extracted ticket info for clipboard copying.
   * @param {Object} param0
   * @returns {string}
   */
  function formatJiraString({ ticketId, status, title }) {
    return `${ticketId}: ${status} - ${title}`;
  }

  /**
   * Injects the copy button into the JIRA UI, with accessibility and error handling.
   */
  function injectCopyButton() {
    if (document.getElementById("jira-ticket-copy-btn")) return; // Prevent duplicates
    const header = document.querySelector(
      '[data-test-id="issue.views.issue-base.issue-header"]'
    );
    if (!header) return;
    const btn = document.createElement("button");
    btn.id = "jira-ticket-copy-btn";
    btn.textContent = "Copy Ticket Info";
    btn.setAttribute("aria-label", "Copy JIRA ticket info to clipboard");
    btn.setAttribute("tabindex", "0");
    btn.style.marginLeft = "8px";
    btn.style.background = "#0052CC";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "3px";
    btn.style.padding = "4px 10px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "14px";
    btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
    btn.style.transition = "background 0.2s";
    btn.onmouseenter = () => (btn.style.background = "#0065FF");
    btn.onmouseleave = () => (btn.style.background = "#0052CC");
    btn.onclick = () => {
      const info = extractJiraTicketInfo();
      const formatted = formatJiraString(info);
      if (!info.ticketId || !info.status || !info.title) {
        btn.textContent = "Ticket info not found";
        btn.style.background = "#FF5630";
        setTimeout(() => {
          btn.textContent = "Copy Ticket Info";
          btn.style.background = "#0052CC";
        }, 1800);
        return;
      }
      navigator.clipboard
        .writeText(formatted)
        .then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = "Copy Ticket Info";
          }, 1200);
        })
        .catch(() => {
          btn.textContent = "Copy failed";
          btn.style.background = "#FF5630";
          setTimeout(() => {
            btn.textContent = "Copy Ticket Info";
            btn.style.background = "#0052CC";
          }, 1800);
        });
    };
    // Place button after ticket ID if possible for better UX
    const idEl = document.querySelector(
      '[data-test-id="issue.views.issue-base.issue-header.issue-key"]'
    );
    if (idEl && idEl.parentNode) {
      idEl.parentNode.insertBefore(btn, idEl.nextSibling);
    } else {
      header.appendChild(btn);
    }
  }

  /**
   * Observes DOM mutations to ensure button persists on SPA navigation.
   */
  function observeJiraPage() {
    injectCopyButton();
    const observer = new MutationObserver(() => {
      injectCopyButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (window.location.href.match(/\/browse\//)) {
    observeJiraPage();
  }
})();
