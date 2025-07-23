import {
  COLORS,
  STATUS_LIST,
  getJiraElements,
  extractJiraTicketInfo,
  formatJiraString,
  setButtonStyle,
  setDropdownItemStyle,
} from "./utils.js";

console.log("[JIRA Ticket Copier] Content script loaded");
// Content script for JIRA Ticket Copier
// Injects a button into JIRA ticket pages to copy ticket info to clipboard

/**
 * Extracts JIRA ticket info (ID, status, title) from the DOM.
 * @returns {Object} { ticketId, status, title }
 */

(function () {
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
    const { jiraStatusWrapper, idContainer } = getJiraElements();
    if (!jiraStatusWrapper) {
      console.warn("[JIRA Ticket Copier] JIRA Status Wrapper not found");
      return;
    }
    let selectedStatus = null;
    // Group button, dropdown, and git button visually
    const groupWrapper = document.createElement("div");
    groupWrapper.id = "jira-ticket-copier-group";
    groupWrapper.style.marginLeft = "8px";
    groupWrapper.style.display = "inline-flex";
    groupWrapper.style.alignItems = "center";

    // Copy button (left)
    const btn = document.createElement("button");
    btn.id = "jira-ticket-copy-btn";
    btn.textContent = "Copy Ticket Info";
    btn.setAttribute("aria-label", "Copy JIRA ticket info to clipboard");
    btn.setAttribute("tabindex", "0");
    setButtonStyle(btn, true);

    // Custom HTML dropdown (middle)
    const dropdownWrapper = document.createElement("div");
    dropdownWrapper.id = "jira-ticket-status-dropdown-wrapper";
    dropdownWrapper.style.display = "inline-block";
    dropdownWrapper.style.position = "relative";
    dropdownWrapper.style.fontSize = "13px";

    const dropdownBtn = document.createElement("button");
    dropdownBtn.innerHTML = "<span>&#9660;</span>";
    dropdownBtn.setAttribute("aria-label", "Select status");
    setButtonStyle(dropdownBtn, false);

    const dropdownMenu = document.createElement("div");
    dropdownMenu.style.display = "none";
    dropdownMenu.style.position = "absolute";
    dropdownMenu.style.top = "110%";
    dropdownMenu.style.right = "0";
    dropdownMenu.style.background = COLORS.dropdownBg;
    dropdownMenu.style.border = "1px solid #ccc";
    dropdownMenu.style.borderRadius = "3px";
    dropdownMenu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
    dropdownMenu.style.zIndex = "9999999";
    dropdownMenu.style.minWidth = "160px";
    dropdownMenu.style.overflow = "hidden";

    // Default option
    const defaultItem = document.createElement("div");
    defaultItem.textContent = "(Status from page)";
    setDropdownItemStyle(defaultItem, true);
    defaultItem.onclick = () => {
      selectedStatus = null;
      dropdownMenu.style.display = "none";
      triggerCopy();
    };
    dropdownMenu.appendChild(defaultItem);

    STATUS_LIST.forEach((status) => {
      const item = document.createElement("div");
      item.textContent = status;
      setDropdownItemStyle(item);
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

    // Git button (right)
    const gitBtn = document.createElement("button");
    gitBtn.id = "jira-ticket-git-btn";
    gitBtn.setAttribute("aria-label", "Copy git commit message");
    gitBtn.setAttribute("tabindex", "0");
    gitBtn.style.background = "#6B778C"; // Atlassian gray 500
    gitBtn.style.color = "#fff";
    gitBtn.style.border = "none";
    gitBtn.style.borderRadius = "3px";
    gitBtn.style.padding = "0 3px";
    gitBtn.style.cursor = "pointer";
    gitBtn.style.fontSize = "14px";
    gitBtn.style.display = "flex";
    gitBtn.style.alignItems = "center";
    gitBtn.style.justifyContent = "center";
    gitBtn.style.height = "25px";
    gitBtn.style.transition = "background 0.2s";
    gitBtn.style.marginLeft = "5px";
    gitBtn.onmouseenter = () => (gitBtn.style.background = "#42526E");
    gitBtn.onmouseleave = () => (gitBtn.style.background = "#6B778C");
    gitBtn.onmousedown = () => (gitBtn.style.outline = "none");
    gitBtn.onfocus = () => (gitBtn.style.outline = "none");
    // Larger inline SVG git icon (white)
    gitBtn.innerHTML = "<svg width=\"25\" height=\"25\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"white\" fill-opacity=\"0.15\"/><path d=\"M17.561 10.438l-3.999-3.999a1.5 1.5 0 0 0-2.122 0l-1.001 1.001 1.415 1.415a1 1 0 1 1 1.414 1.414l-0.707 0.707a1 1 0 1 1-1.414-1.414l-1.415-1.415-2.001 2.001a1.5 1.5 0 0 0 0 2.122l3.999 3.999a1.5 1.5 0 0 0 2.122 0l3.999-3.999a1.5 1.5 0 0 0 0-2.122z\" fill=\"white\"/></svg>";

    // Git button copy logic
    gitBtn.onclick = () => {
      const info = extractJiraTicketInfo();
      if (!info.ticketId || !info.title) {
        gitBtn.innerHTML =
          "<span style='color:#FF5630;padding:0 10px;'>Not found</span>";
        setTimeout(() => {
          gitBtn.innerHTML =
            "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"white\" fill-opacity=\"0.15\"/><path d=\"M17.561 10.438l-3.999-3.999a1.5 1.5 0 0 0-2.122 0l-1.001 1.001 1.415 1.415a1 1 0 1 1 1.414 1.414l-0.707 0.707a1 1 0 1 1-1.414-1.414l-1.415-1.415-2.001 2.001a1.5 1.5 0 0 0 0 2.122l3.999 3.999a1.5 1.5 0 0 0 2.122 0l3.999-3.999a1.5 1.5 0 0 0 0-2.122z\" fill=\"white\"/></svg>";
        }, 1800);
        return;
      }
      const commitMsg = `${info.ticketId}: ${info.title}`;
      navigator.clipboard
        .writeText(commitMsg)
        .then(() => {
          gitBtn.innerHTML =
            "<span style='color:#36B37E;padding:0 10px;'>Copied!</span>";
          setTimeout(() => {
            gitBtn.innerHTML =
              "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"white\" fill-opacity=\"0.15\"/><path d=\"M17.561 10.438l-3.999-3.999a1.5 1.5 0 0 0-2.122 0l-1.001 1.001 1.415 1.415a1 1 0 1 1 1.414 1.414l-0.707 0.707a1 1 0 1 1-1.414-1.414l-1.415-1.415-2.001 2.001a1.5 1.5 0 0 0 0 2.122l3.999 3.999a1.5 1.5 0 0 0 2.122 0l3.999-3.999a1.5 1.5 0 0 0 0-2.122z\" fill=\"white\"/></svg>";
          }, 1200);
        })
        .catch(() => {
          gitBtn.innerHTML =
            "<span style='color:#FF5630;padding:0 10px;'>Copy failed</span>";
          setTimeout(() => {
            gitBtn.innerHTML =
              "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"white\" fill-opacity=\"0.15\"/><path d=\"M17.561 10.438l-3.999-3.999a1.5 1.5 0 0 0-2.122 0l-1.001 1.001 1.415 1.415a1 1 0 1 1 1.414 1.414l-0.707 0.707a1 1 0 1 1-1.414-1.414l-1.415-1.415-2.001 2.001a1.5 1.5 0 0 0 0 2.122l3.999 3.999a1.5 1.5 0 0 0 2.122 0l3.999-3.999a1.5 1.5 0 0 0 0-2.122z\" fill=\"white\"/></svg>";
          }, 1800);
        });
    };

    // Add all to group
    groupWrapper.appendChild(btn);
    groupWrapper.appendChild(dropdownWrapper);
    groupWrapper.appendChild(gitBtn);

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
        btn.style.background = COLORS.error;
        setTimeout(() => {
          btn.textContent = "Copy Ticket Info";
          btn.style.background = COLORS.buttonBgActive;
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
          btn.style.background = COLORS.error;
          setTimeout(() => {
            btn.textContent = "Copy Ticket Info";
            btn.style.background = COLORS.buttonBgActive;
          }, 1800);
        });
    }

    btn.onclick = triggerCopy;

    // Place dropdown and button after ticket ID if possible for better UX
    if (idContainer && idContainer.parentNode) {
      console.log(
        "[JIRA Ticket Copier] Ticket ID element found, inserting dropdown and button after it"
      );
      idContainer.parentNode.appendChild(groupWrapper);
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

  if (
    /\/browse\//.test(window.location.href) ||
    /\/issues\//.test(window.location.href)
  ) {
    observeJiraPage();
  }
})();
