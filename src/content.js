import { PAGE_CONFIGS } from "./config/selectors.js";
import { OBSERVER_DEBOUNCE_MS } from "./config/constants.js";
import { getSetting, getSettings } from "./core/storage.js";
import { copyTicketInfo, mainButtonFeedback } from "./core/clipboard.js";
import { findActionBar, readIssueList } from "./core/issue-list.js";
import {
  createCopyButton,
  createExportButton,
  createGitButton,
  createIssueListButton,
  createLinkButton,
  createListLinkButton,
} from "./ui/buttons.js";
import { createDropdown } from "./ui/dropdown.js";

// Button name to setting key mapping
const BUTTON_SETTINGS = {
  copyTicketInfo: "enableTicketInfo",
  statusDropdown: "enableTicketInfo", // Dropdown follows main button
  gitButton: "enableGitButton",
  linkButton: "enableLinkButton",
  exportButton: "enableExportButton",
  listLinkButton: "enableListView", // Already handled at page level
  copyIssueList: "enableIssueListCopy",
};

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
  exportButton: (getInfo) => createExportButton(getInfo),
  listLinkButton: (getInfo) => createListLinkButton(getInfo),
  copyIssueList: (getInfo) => createIssueListButton(getInfo),
};

async function createButtonGroup(config, getInfo, parent) {
  // Get all required settings at once
  const settingKeys = [...new Set(config.buttons.map(button => BUTTON_SETTINGS[button]).filter(Boolean))];
  const settings = await getSettings(settingKeys);
  
  // Filter buttons based on enabled settings
  const enabledButtons = config.buttons.filter(buttonName => {
    const settingKey = BUTTON_SETTINGS[buttonName];
    return !settingKey || settings[settingKey];
  });
  
  // Only create group if there are enabled buttons
  if (enabledButtons.length === 0) return;
  // The initial check and the observer can both get here while settings load.
  if (document.getElementById(config.groupId)) return;

  const group = document.createElement("div");
  group.id = config.groupId;
  Object.assign(group.style, { marginLeft: "8px", display: "inline-flex", alignItems: "center" });
  parent.appendChild(group);

  const selectedStatus = { value: null };
  const triggerCopy = () => {
    const btn = document.getElementById("jira-ticket-copy-btn");
    copyTicketInfo(getInfo(), selectedStatus.value, btn, mainButtonFeedback);
  };

  enabledButtons.forEach((buttonName) => {
    const creator = BUTTON_CREATORS[buttonName];
    if (creator) {
      const btn = creator(getInfo, selectedStatus, triggerCopy);
      group.appendChild(btn);
    }
  });
}

async function injectSinglePageButtons(config) {
  if (document.getElementById(config.groupId)) return;

  // The ticket key is what shows an issue view has rendered. The status field is
  // not required: the board's issue popup no longer renders it where the
  // selectors expect, and the copy buttons fetch a missing status at click time.
  const info = extractInfo(config.selectors);
  if (!info.ticketId) return;

  const insertAfter = document.querySelector(config.selectors.insertAfter);
  const container = document.querySelector(config.selectors.container);
  const parent = insertAfter?.parentNode || container?.parentNode;
  if (!parent) return;

  const getInfo = () => extractInfo(config.selectors);

  await createButtonGroup(config, getInfo, parent);
}

async function injectResultsButtons(config) {
  if (document.getElementById(config.groupId)) return;

  const actionBar = findActionBar(config.selectors.actionBarItem);
  if (!actionBar) return;

  await createButtonGroup(config, () => readIssueList(config.selectors), actionBar);
}

/**
 * Pick the injection strategy a page config calls for.
 * @param {Object} config - Page configuration.
 * @returns {Function} The injection function.
 */
function injectorFor(config) {
  if (config.selectors.row) return injectListButtons;
  if (config.selectors.issueRow) return injectResultsButtons;
  return injectSinglePageButtons;
}

async function injectListButtons(config) {
  // Check if list view buttons are enabled
  const listViewEnabled = await getSetting("enableListView");
  if (!listViewEnabled) return;
  
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
async function checkAndInject(config, injectFn) {
  const urlMatches = config.urlPattern.test(window.location.href);
  const excluded = config.excludePattern && config.excludePattern.test(window.location.href);
  
  if (urlMatches && !excluded) {
    await injectFn(config);
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
  const injectFn = injectorFor(config);

  // For list views, we already handle setting check in injectListButtons
  // For other views, check if any button in the config might be enabled
  if (isListView) {
    observePage(config, injectFn);
  } else {
    // Check if any button setting is enabled before observing
    const settingKeys = [...new Set(config.buttons.map(button => BUTTON_SETTINGS[button]).filter(Boolean))];
    if (settingKeys.length === 0) {
      // No settings to check, observe directly
      observePage(config, injectFn);
    } else {
      getSettings(settingKeys).then((settings) => {
        // Only observe if at least one button is enabled
        const hasEnabledButton = settingKeys.some(key => settings[key]);
        if (hasEnabledButton) {
          observePage(config, injectFn);
        }
      });
    }
  }
});
