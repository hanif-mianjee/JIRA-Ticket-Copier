// --- Helper: Copy to clipboard and show feedback for main button ---
// --- Helper: Copy ticket info with user format and feedback ---
// --- Generalized Helper: Copy to clipboard and show feedback ---
function copyToClipboardWithFeedback(text, btn, feedback) {
  navigator.clipboard
    .writeText(text)
    .then(() => feedback.success(btn))
    .catch(() => feedback.fail(btn));
}

// --- Feedback strategies ---
const mainBtnFeedback = {
  success: (btn) => {
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = "Copy Ticket Info";
    }, 1200);
  },
  fail: (btn) => {
    btn.textContent = "Copy failed";
    btn.style.background = COLORS.error;
    setTimeout(() => {
      btn.textContent = "Copy Ticket Info";
      btn.style.background = COLORS.buttonBgActive;
    }, 1800);
  },
};
const gitBtnFeedback = {
  success: (btn) => {
    setGitBtnFeedback(btn, "copied");
    setTimeout(() => setGitBtnFeedback(btn, "icon"), 1200);
  },
  fail: (btn) => {
    setGitBtnFeedback(btn, "fail");
    setTimeout(() => setGitBtnFeedback(btn, "icon"), 1800);
  },
};

// --- Helper: Copy ticket info with user format and feedback ---
function copyTicketInfoToClipboard(info, statusToUse, btn) {
  const doCopy = (format) => {
    const formatted = formatCommitMessage(format, {
      ticketId: info.ticketId,
      status: statusToUse,
      title: info.title,
    });
    copyToClipboardWithFeedback(formatted, btn, mainBtnFeedback);
  };
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(["ticketInfoFormat"], (result) => {
      const format =
        result.ticketInfoFormat || "{{ticketId}}: {{status}} - {{title}}";
      doCopy(format);
    });
  } else {
    doCopy("{{ticketId}}: {{status}} - {{title}}");
  }
}
// --- Helper: Format commit message with variables ---
function formatCommitMessage(format, info) {
  return format
    .replace(/{{\s*ticketId\s*}}/g, info.ticketId)
    .replace(/{{\s*title\s*}}/g, info.title)
    .replace(/{{\s*status\s*}}/g, info.status);
}

// --- Helper: Copy to clipboard and show feedback ---
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

// --- Utility: Git Button Feedback ---
function getGitIconSVG() {
  return "<svg width=\"25\" height=\"25\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"white\" fill-opacity=\"0.15\"/><path d=\"M17.561 10.438l-3.999-3.999a1.5 1.5 0 0 0-2.122 0l-1.001 1.001 1.415 1.415a1 1 0 1 1 1.414 1.414l-0.707 0.707a1 1 0 1 1-1.414-1.414l-1.415-1.415-2.001 2.001a1.5 1.5 0 0 0 0 2.122l3.999 3.999a1.5 1.5 0 0 0 2.122 0l3.999-3.999a1.5 1.5 0 0 0 0-2.122z\" fill=\"white\"/></svg>";
}

function setGitBtnFeedback(gitBtn, type) {
  if (type === "copied") {
    gitBtn.innerHTML =
      "<span style='color:#36B37E;padding:0 10px;'>Copied!</span>";
  } else if (type === "fail") {
    gitBtn.innerHTML =
      "<span style='color:#FF5630;padding:0 10px;'>Copy failed</span>";
  } else if (type === "notfound") {
    gitBtn.innerHTML =
      "<span style='color:#FF5630;padding:0 10px;'>Not found</span>";
  } else {
    gitBtn.innerHTML = getGitIconSVG();
  }
}

function createGitButton(onClick) {
  const gitBtn = document.createElement("button");
  gitBtn.id = "jira-ticket-git-btn";
  gitBtn.setAttribute("aria-label", "Copy git commit message");
  gitBtn.setAttribute("tabindex", "0");
  Object.assign(gitBtn.style, {
    background: "#6B778C",
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    padding: "0 3px",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "25px",
    transition: "background 0.2s",
    marginLeft: "5px",
  });
  gitBtn.onmouseenter = () => (gitBtn.style.background = "#42526E");
  gitBtn.onmouseleave = () => (gitBtn.style.background = "#6B778C");
  gitBtn.onmousedown = () => (gitBtn.style.outline = "none");
  gitBtn.onfocus = () => (gitBtn.style.outline = "none");
  setGitBtnFeedback(gitBtn, "icon");
  gitBtn.onclick = onClick;
  return gitBtn;
}

function createDropdown(selectedStatusRef, triggerCopy) {
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
  Object.assign(dropdownMenu.style, {
    display: "none",
    position: "absolute",
    top: "110%",
    right: "0",
    background: COLORS.dropdownBg,
    border: "1px solid #ccc",
    borderRadius: "3px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    zIndex: "9999999",
    minWidth: "160px",
    overflow: "hidden",
  });

  const defaultItem = document.createElement("div");
  defaultItem.textContent = "(Status from page)";
  setDropdownItemStyle(defaultItem, true);
  defaultItem.onclick = () => {
    selectedStatusRef.value = null;
    dropdownMenu.style.display = "none";
    triggerCopy();
  };
  dropdownMenu.appendChild(defaultItem);

  STATUS_LIST.forEach((status) => {
    const item = document.createElement("div");
    item.textContent = status;
    setDropdownItemStyle(item);
    item.onclick = () => {
      selectedStatusRef.value = status;
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
  document.addEventListener("click", () => {
    dropdownMenu.style.display = "none";
  });

  dropdownWrapper.appendChild(dropdownBtn);
  dropdownWrapper.appendChild(dropdownMenu);
  return dropdownWrapper;
}

function createCopyButton(triggerCopy) {
  const btn = document.createElement("button");
  btn.id = "jira-ticket-copy-btn";
  btn.textContent = "Copy Ticket Info";
  btn.setAttribute("aria-label", "Copy JIRA ticket info to clipboard");
  btn.setAttribute("tabindex", "0");
  setButtonStyle(btn, true);
  btn.onclick = triggerCopy;
  return btn;
}

function injectCopyButton() {
  if (document.getElementById("jira-ticket-copy-btn")) {
    console.log("[JIRA Ticket Copier] Button already exists");
    return;
  }
  const { jiraStatusWrapper, idContainer } = getJiraElements();
  if (!jiraStatusWrapper) {
    console.warn("[JIRA Ticket Copier] JIRA Status Wrapper not found");
    return;
  }
  const selectedStatus = { value: null };

  // --- Copy logic ---
  function triggerCopy() {
    const info = extractJiraTicketInfo();
    const statusToUse = selectedStatus.value || info.status;
    const btn = document.getElementById("jira-ticket-copy-btn");
    if (!info.ticketId || !statusToUse || !info.title) {
      btn.textContent = "Ticket info not found";
      btn.style.background = COLORS.error;
      setTimeout(() => {
        btn.textContent = "Copy Ticket Info";
        btn.style.background = COLORS.buttonBgActive;
      }, 1800);
      return;
    }
    copyTicketInfoToClipboard(info, statusToUse, btn);
  }

  // --- UI assembly ---
  const groupWrapper = document.createElement("div");
  groupWrapper.id = "jira-ticket-copier-group";
  groupWrapper.style.marginLeft = "8px";
  groupWrapper.style.display = "inline-flex";
  groupWrapper.style.alignItems = "center";

  const btn = createCopyButton(triggerCopy);
  const dropdownWrapper = createDropdown(selectedStatus, triggerCopy);
  const gitBtn = createGitButton(() => {
    const gitInfo = extractJiraTicketInfo();
    if (!gitInfo.ticketId || !gitInfo.title) {
      setGitBtnFeedback(gitBtn, "notfound");
      setTimeout(() => setGitBtnFeedback(gitBtn, "icon"), 1800);
      return;
    }
    const doCopy = (format) => {
      const commitMsg = formatCommitMessage(format, gitInfo);
      copyToClipboardWithFeedback(commitMsg, gitBtn, gitBtnFeedback);
    };
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(["commitFormat"], (result) => {
        const format = result.commitFormat || "{{ticketId}}: {{title}}";
        doCopy(format);
      });
    } else {
      doCopy("{{ticketId}}: {{title}}");
    }
  });

  groupWrapper.appendChild(btn);
  groupWrapper.appendChild(dropdownWrapper);
  groupWrapper.appendChild(gitBtn);

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
