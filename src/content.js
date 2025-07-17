console.log("[JIRA Ticket Copier] Content script loaded");
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
      '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]'
    );
    const statusEl = document.querySelector(
      '[data-testid="issue-field-status.ui.status-view.status-button.status-button"]'
    );
    const titleEl = document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.summary.heading"]'
    );
    if (!idEl) console.warn("[JIRA Ticket Copier] Ticket ID element not found");
    if (!statusEl)
      console.warn("[JIRA Ticket Copier] Status element not found");
    if (!titleEl) console.warn("[JIRA Ticket Copier] Title element not found");
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
    if (document.getElementById("jira-ticket-copy-btn")) {
      console.log("[JIRA Ticket Copier] Button already exists");
      return; // Prevent duplicates
    }
    const jiraStatusWrapper = document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.status.status-field-wrapper"]'
    );
    if (!jiraStatusWrapper) {
      console.warn("[JIRA Ticket Copier] JIRA Status Wrapper not found");
      return;
    }
    // Dropdown for status selection
    const statusList = [
      //   "To Do",
      //   "In Progress",
      "Waiting for Input",
      "Analysis",
      "Analysis/Comment added",
      //   "Done",
      "Blocked",
      "Blocked/Comment added",
      "Blocked/Waiting for Input",
      "In Review",
      //   "In Testing",
      "PR Raised",
      "Review suggestions applied",
      //   "In QA",
      //   "In UAT",
      //   "Selected for Development",
    ];
    let selectedStatus = null;
    // Group button and dropdown visually
    const groupWrapper = document.createElement("div");
    groupWrapper.id = "jira-ticket-copier-group";
    // groupWrapper.style.display = "inline-flex";
    // groupWrapper.style.alignItems = "center";
    // groupWrapper.style.gap = "0px";
    groupWrapper.style.marginLeft = "8px";

    // Copy button (left)
    const btn = document.createElement("button");
    btn.id = "jira-ticket-copy-btn";
    btn.textContent = "Copy Ticket Info";
    btn.setAttribute("aria-label", "Copy JIRA ticket info to clipboard");
    btn.setAttribute("tabindex", "0");
    btn.style.background = "#1558BC";
    btn.style.color = "#BFC1C4";
    btn.style.border = "none";
    btn.style.borderRadius = "3px 0 0 3px";
    btn.style.padding = "4px 10px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "14px";
    btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
    btn.style.transition = "background 0.2s";
    btn.style.outline = "none";
    btn.onmouseenter = () => (btn.style.background = "#0065FF");
    btn.onmouseleave = () => (btn.style.background = "#0052CC");
    btn.onmousedown = () => (btn.style.outline = "none");
    btn.onfocus = () => (btn.style.outline = "none");

    // Custom HTML dropdown (right)
    const dropdownWrapper = document.createElement("div");
    dropdownWrapper.id = "jira-ticket-status-dropdown-wrapper";
    dropdownWrapper.style.display = "inline-block";
    dropdownWrapper.style.position = "relative";
    dropdownWrapper.style.fontSize = "13px";

    const dropdownBtn = document.createElement("button");
    dropdownBtn.innerHTML = "<span>&#9660;</span>";
    dropdownBtn.setAttribute("aria-label", "Select status");
    dropdownBtn.style.background = "#1558BC";
    dropdownBtn.style.color = "#BFC1C4";
    dropdownBtn.style.border = "none";
    dropdownBtn.style.borderRadius = "0 3px 3px 0";
    dropdownBtn.style.padding = "4px 10px";
    dropdownBtn.style.cursor = "pointer";
    dropdownBtn.style.fontSize = "14px";
    dropdownBtn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
    dropdownBtn.style.transition = "background 0.2s";
    dropdownBtn.style.outline = "none";
    dropdownBtn.onmouseenter = () => (dropdownBtn.style.background = "#1558BC");
    dropdownBtn.onmouseleave = () => (dropdownBtn.style.background = "#0052CC");
    dropdownBtn.onmousedown = () => (dropdownBtn.style.outline = "none");
    dropdownBtn.onfocus = () => (dropdownBtn.style.outline = "none");

    const dropdownMenu = document.createElement("div");
    dropdownMenu.style.display = "none";
    dropdownMenu.style.position = "absolute";
    dropdownMenu.style.top = "110%";
    dropdownMenu.style.right = "0";
    dropdownMenu.style.background = "#fff";
    dropdownMenu.style.border = "1px solid #ccc";
    dropdownMenu.style.borderRadius = "3px";
    dropdownMenu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
    dropdownMenu.style.zIndex = "9999999";
    dropdownMenu.style.minWidth = "160px";

    // Default option
    const defaultItem = document.createElement("div");
    defaultItem.textContent = "(Status from page)";
    defaultItem.style.padding = "6px 12px";
    defaultItem.style.cursor = "pointer";
    defaultItem.style.background = "#fff";
    defaultItem.style.color = "#333";
    defaultItem.style.fontSize = "14px";
    defaultItem.onmouseenter = () => (
      (defaultItem.style.background = "#1558BC"),
      (defaultItem.style.color = "#fff")
    );
    defaultItem.onmouseleave = () => (
      (defaultItem.style.background = "#fff"),
      (defaultItem.style.color = "#333")
    );
    defaultItem.onclick = () => {
      selectedStatus = null;
      dropdownMenu.style.display = "none";
      triggerCopy();
    };
    dropdownMenu.appendChild(defaultItem);

    statusList.forEach((status) => {
      const item = document.createElement("div");
      item.textContent = status;
      item.style.padding = "6px 12px";
      item.style.cursor = "pointer";
      item.style.background = "#fff";
      item.style.color = "#333";
      item.style.fontSize = "14px";
      item.onmouseenter = () => (
        (item.style.background = "#1558BC"), (item.style.color = "#fff")
      );
      item.onmouseleave = () => (
        (item.style.background = "#fff"), (item.style.color = "#333")
      );
      item.onclick = () => {
        selectedStatus = status;
        dropdownMenu.style.display = "none";
        triggerCopy();
      };
      dropdownMenu.appendChild(item);
    });

    dropdownBtn.onclick = (e) => {
      e.stopPropagation();
      dropdownMenu.style.display =
        dropdownMenu.style.display === "none" ? "block" : "none";
    };

    // Hide dropdown on outside click
    document.addEventListener("click", () => {
      dropdownMenu.style.display = "none";
    });

    dropdownWrapper.appendChild(dropdownBtn);
    dropdownWrapper.appendChild(dropdownMenu);
    groupWrapper.appendChild(btn);
    groupWrapper.appendChild(dropdownWrapper);

    // Copy logic as a function
    function triggerCopy() {
      const info = extractJiraTicketInfo();
      const statusToUse = selectedStatus || info.status;
      const formatted = formatJiraString({
        ticketId: info.ticketId,
        status: statusToUse,
        title: info.title,
      });
      if (!info.ticketId || !statusToUse || !info.title) {
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
    }

    btn.onclick = triggerCopy;

    // ...existing code...
    // Place dropdown and button after ticket ID if possible for better UX
    const idEl = document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]'
    );
    if (idEl && idEl.parentNode) {
      console.log(
        "[JIRA Ticket Copier] Ticket ID element found, inserting dropdown and button after it"
      );
      idEl.parentNode.appendChild(groupWrapper);
    } else {
      console.warn(
        "[JIRA Ticket Copier] Ticket ID element not found, appending dropdown and button to header"
      );
      jiraStatusWrapper.parentNode.appendChild(groupWrapper);
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
