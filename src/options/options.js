
import { STATUS_LIST } from "../config/constants.js";

const SAMPLE_DATA = {
  ticketId: "PROJ-1234",
  title: "Implement new feature for user dashboard",
  status: "In Progress"
};

const VARIABLES = [
  { name: "{{ticketId}}", description: "JIRA ticket key" },
  { name: "{{title}}", description: "Ticket title" },
  { name: "{{status}}", description: "Ticket status" }
];

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    button.classList.add("copied");
    setTimeout(() => {
      button.classList.remove("copied");
    }, 1500);
  }).catch(err => {
    console.error("Failed to copy:", err);
  });
}

function formatString(template, data) {
  if (!template) return "";
  return template
    .replace(/\{\{ticketId\}\}/g, data.ticketId)
    .replace(/\{\{title\}\}/g, data.title)
    .replace(/\{\{status\}\}/g, data.status);
}

function updatePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  
  if (!input || !preview) return;
  
  const formatted = formatString(input.value, SAMPLE_DATA);
  
  if (inputId === "linkFormat" && formatted) {
    preview.innerHTML = `<a href="#" onclick="return false;">${formatted}</a>`;
  } else {
    preview.textContent = formatted || "";
  }
}

function setupPreviewListeners() {
  const previewConfigs = [
    { inputId: "ticketInfoFormat", previewId: "ticketInfoPreview" },
    { inputId: "commitFormat", previewId: "commitFormatPreview" },
    { inputId: "linkFormat", previewId: "linkFormatPreview" }
  ];

  previewConfigs.forEach(({ inputId, previewId }) => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener("input", () => updatePreview(inputId, previewId));
      updatePreview(inputId, previewId);
    }
  });
}

function renderVariables() {
  const grid = document.getElementById("variablesGrid");
  if (!grid) return;
  
  grid.innerHTML = VARIABLES.map(({ name, description }) => `
    <div class="variable-item">
      <div class="code-wrapper">
        <code class="copyable-code" data-copy="${name}">${name}</code>
        <button class="copy-icon" data-copy="${name}" type="button" aria-label="Copy ${name}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <span>${description}</span>
    </div>
  `).join("");
}

function setupCopyButtons() {
  document.querySelectorAll(".copy-icon").forEach(button => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const text = button.dataset.copy;
      copyToClipboard(text, button);
    });
  });
  
  document.querySelectorAll(".copyable-code").forEach(code => {
    code.addEventListener("click", (e) => {
      e.preventDefault();
      const text = code.dataset.copy;
      const button = code.parentElement.querySelector(".copy-icon");
      copyToClipboard(text, button);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const commitFormatInput = document.getElementById("commitFormat");
  const ticketInfoFormatInput = document.getElementById("ticketInfoFormat");
  const linkFormatInput = document.getElementById("linkFormat");
  const statusListInput = document.getElementById("statusList");
  const enableTicketInfoInput = document.getElementById("enableTicketInfo");
  const enableGitButtonInput = document.getElementById("enableGitButton");
  const enableLinkButtonInput = document.getElementById("enableLinkButton");
  const enableListViewInput = document.getElementById("enableListView");
  const successMessage = document.getElementById("successMessage");
  const form = document.getElementById("optionsForm");
  const versionSpan = document.getElementById("version");
  const openWelcomeBtn = document.getElementById("openWelcome");

  if (chrome && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (versionSpan) {
      versionSpan.textContent = manifest.version;
    }
  }

  if (openWelcomeBtn) {
    openWelcomeBtn.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("dist/welcome/welcome.html")
      });
    });
  }

  function loadOptions() {
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        ["commitFormat", "ticketInfoFormat", "linkFormat", "statusList", "enableTicketInfo", "enableGitButton", "enableLinkButton", "enableListView"],
        (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error("Error loading formats:", chrome.runtime.lastError);
            showMessage("Error loading settings", false);
            return;
          }
          commitFormatInput.value = result.commitFormat || "";
          ticketInfoFormatInput.value = result.ticketInfoFormat || "";
          linkFormatInput.value = result.linkFormat || "";
          const savedList = result.statusList && result.statusList.length > 0 ? result.statusList : STATUS_LIST;
          statusListInput.value = savedList.join("\n");
          
          if (enableTicketInfoInput) enableTicketInfoInput.checked = result.enableTicketInfo !== false;
          if (enableGitButtonInput) enableGitButtonInput.checked = result.enableGitButton !== false;
          if (enableLinkButtonInput) enableLinkButtonInput.checked = result.enableLinkButton !== false;
          if (enableListViewInput) enableListViewInput.checked = result.enableListView !== false;
          
          setupPreviewListeners();
          renderVariables();
          setupCopyButtons();
        }
      );
    } else {
      console.error("chrome.storage.sync is not available");
      statusListInput.value = STATUS_LIST.join("\n");
      setupPreviewListeners();
      renderVariables();
      setupCopyButtons();
    }
  }

  function showMessage(message, isSuccess = true) {
    if (successMessage) {
      successMessage.textContent = message;
      successMessage.classList.add("show");
      successMessage.style.background = isSuccess ? "#00875A" : "#DE350B";
      
      setTimeout(() => {
        successMessage.classList.remove("show");
      }, 3000);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const commitFormat = commitFormatInput.value.trim();
    const ticketInfoFormat = ticketInfoFormatInput.value.trim();
    const linkFormat = linkFormatInput.value.trim();
    const statusList = statusListInput.value.split("\n").map(s => s.trim()).filter(s => s);
    const enableTicketInfo = enableTicketInfoInput ? enableTicketInfoInput.checked : true;
    const enableGitButton = enableGitButtonInput ? enableGitButtonInput.checked : true;
    const enableLinkButton = enableLinkButtonInput ? enableLinkButtonInput.checked : true;
    const enableListView = enableListViewInput ? enableListViewInput.checked : true;
    
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ commitFormat, ticketInfoFormat, linkFormat, statusList, enableTicketInfo, enableGitButton, enableLinkButton, enableListView }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error("Error saving formats:", chrome.runtime.lastError);
          showMessage("Error saving settings", false);
          return;
        }
        showMessage("Settings saved successfully!");
      });
    } else {
      console.error("chrome.storage.sync is not available");
      showMessage("Storage unavailable", false);
    }
  });

  loadOptions();
});
