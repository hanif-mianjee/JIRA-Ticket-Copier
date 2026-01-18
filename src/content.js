import { PAGE_CONFIGS } from "./config/selectors.js";
import { OBSERVER_DEBOUNCE_MS } from "./config/constants.js";
import { getSetting } from "./core/storage.js";
import { copyTicketInfo, mainButtonFeedback } from "./core/clipboard.js";
import { createCopyButton, createGitButton, createLinkButton, createListLinkButton } from "./ui/buttons.js";
import { createDropdown } from "./ui/dropdown.js";

console.log("[JIRA Ticket Copier] Content script loaded");

// Track the current URL for SPA navigation detection
let currentUrl = window.location.href;

// Track active observers for cleanup
const activeObservers = [];

/**
 * Debounce utility to limit how often a function can be called
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Clean up existing button groups and their associated resources
 */
function cleanupButtonGroups() {
  // Clean up single page button groups
  PAGE_CONFIGS.forEach((config) => {
    if (config.groupId) {
      const existingGroup = document.getElementById(config.groupId);
      if (existingGroup) {
        // Clean up AbortController from dropdown if present
        const dropdown = existingGroup.querySelector("#jira-ticket-status-dropdown-wrapper");
        if (dropdown && dropdown._abortController) {
          dropdown._abortController.abort();
        }
        existingGroup.remove();
      }
    }
  });

  // Clean up list view buttons
  document.querySelectorAll(".jira-list-copy-link-btn").forEach((btn) => btn.remove());
}

function extractInfo(selectors, context = document) {
  const ticketEl = context.querySelector(selectors.ticketId);
  const statusEl = context.querySelector(selectors.status);
  const titleEl = context.querySelector(selectors.title);

  let status = statusEl?.textContent?.trim() || "";
  if (/[{}]/.test(status)) status = "";

  const ticketId = ticketEl?.textContent?.trim() || "";
  const title = titleEl?.textContent?.trim() || "";

  let ticketUrl = window.location.href;
  if (ticketEl?.getAttribute("href")) {
    ticketUrl = `${window.location.origin}${ticketEl.getAttribute("href")}`;
  } else if (context.tagName === "A" && context.getAttribute("href")) {
    ticketUrl = `${window.location.origin}${context.getAttribute("href")}`;
  }

  return { ticketId, status, title, ticketUrl };
}

const BUTTON_CREATORS = {
  copyTicketInfo: (getInfo, selectedStatus) => createCopyButton(getInfo, selectedStatus),
  statusDropdown: (getInfo, selectedStatus, triggerCopy) => createDropdown(selectedStatus, triggerCopy),
  gitButton: (getInfo) => createGitButton(getInfo),
  linkButton: (getInfo) => createLinkButton(getInfo),
  listLinkButton: (getInfo) => createListLinkButton(getInfo),
};

function createButtonGroup(config, getInfo, parent) {
  const group = document.createElement("div");
  group.id = config.groupId;
  Object.assign(group.style, { marginLeft: "8px", display: "inline-flex", alignItems: "center" });
  parent.appendChild(group);

  const selectedStatus = { value: null };
  const triggerCopy = () => {
    const btn = document.getElementById("jira-ticket-copy-btn");
    copyTicketInfo(getInfo(), selectedStatus.value, btn, mainButtonFeedback);
  };

  config.buttons.forEach((buttonName) => {
    const creator = BUTTON_CREATORS[buttonName];
    if (creator) {
      const btn = creator(getInfo, selectedStatus, triggerCopy);
      group.appendChild(btn);
    }
  });
}

function injectSinglePageButtons(config) {
  if (document.getElementById(config.groupId)) return;

  const container = document.querySelector(config.selectors.container);
  if (!container) return;

  const info = extractInfo(config.selectors);
  if (!info.status) return;

  const insertAfter = document.querySelector(config.selectors.insertAfter);
  const parent = insertAfter?.parentNode || container.parentNode;
  const getInfo = () => extractInfo(config.selectors);

  createButtonGroup(config, getInfo, parent);
}

function injectListButtons(config) {
  const rows = document.querySelectorAll(config.selectors.row);

  rows.forEach((row) => {
    if (row.querySelector(`.${config.buttonClass}`)) return;

    const buttonContainer = row.querySelector(config.selectors.buttonContainer);
    if (!buttonContainer) return;

    Object.assign(buttonContainer.style, { display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: "row" });

    const getInfo = () => extractInfo(config.selectors, row);

    config.buttons.forEach((buttonName) => {
      if (buttonName === "listLinkButton") {
        buttonContainer.appendChild(createListLinkButton(getInfo));
      }
    });
  });
}

/**
 * Check if the current URL matches a config and inject buttons if needed
 * @param {Object} config - Page configuration
 * @param {Function} injectFn - Injection function to use
 */
function checkAndInject(config, injectFn) {
  const urlMatches = config.urlPattern.test(window.location.href);
  const excluded = config.excludePattern && config.excludePattern.test(window.location.href);
  
  if (urlMatches && !excluded) {
    injectFn(config);
  }
}

/**
 * Set up observation for a page config with debouncing
 * @param {Object} config - Page configuration
 * @param {Function} injectFn - Injection function to use
 */
function observePage(config, injectFn) {
  // Initial injection
  checkAndInject(config, injectFn);
  
  // Create debounced injection function
  const debouncedInject = debounce(() => {
    checkAndInject(config, injectFn);
  }, OBSERVER_DEBOUNCE_MS);
  
  // Observe DOM changes with debouncing
  const observer = new MutationObserver(debouncedInject);
  observer.observe(document.body, { childList: true, subtree: true });
  activeObservers.push(observer);
}

/**
 * Handle SPA navigation by detecting URL changes
 * Re-evaluates all configs when URL changes to support view switching (board <-> list)
 */
function handleSPANavigation() {
  if (currentUrl === window.location.href) return;
  
  console.log("[JIRA Ticket Copier] SPA navigation detected:", currentUrl, "->", window.location.href);
  currentUrl = window.location.href;
  
  // Clean up existing buttons to allow re-injection based on new URL
  cleanupButtonGroups();
  
  // Re-check all configs for the new URL
  // Note: Observers are already running and will pick up changes via their debounced callbacks
}

/**
 * Set up SPA navigation detection using multiple strategies
 */
function setupSPADetection() {
  // Strategy 1: Listen to popstate for browser back/forward navigation
  window.addEventListener("popstate", handleSPANavigation);
  
  // Strategy 2: Override pushState and replaceState for programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleSPANavigation();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleSPANavigation();
  };
  
  // Strategy 3: Periodic URL check as fallback for edge cases
  // Some SPAs may change URL without using standard History API
  setInterval(() => {
    if (currentUrl !== window.location.href) {
      handleSPANavigation();
    }
  }, 500);
}

// Initialize SPA navigation detection
setupSPADetection();

// Set up observers for all matching page configs
PAGE_CONFIGS.forEach((config) => {
  const isListView = !!config.selectors.row;
  const injectFn = isListView ? injectListButtons : injectSinglePageButtons;

  if (config.settingKey) {
    getSetting(config.settingKey).then((enabled) => {
      if (enabled) observePage(config, injectFn);
    });
  } else {
    observePage(config, injectFn);
  }
});
