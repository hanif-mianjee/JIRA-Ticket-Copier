import { buildWeeklyFilterUrl, getDateRange, normalizeDays, normalizeJiraSite } from "./weekly-filter.js";

const SETTING_KEYS = ["enableWeeklyFilter", "weeklyFilterDays", "weeklyFilterJql", "jiraSite"];
const JIRA_TAB_PATTERN = "https://*.atlassian.net/*";

function readSettings() {
  return new Promise((resolve) => {
    if (!chrome.storage || !chrome.storage.sync) {
      resolve({});
      return;
    }
    chrome.storage.sync.get(SETTING_KEYS, (result) => resolve(result || {}));
  });
}

// No "tabs" permission is needed: the host permission already exposes the URL
// of Jira tabs, and other tabs simply come back without one.
function queryTabs(query) {
  return new Promise((resolve) => {
    chrome.tabs.query(query, (tabs) => resolve(chrome.runtime.lastError ? [] : tabs || []));
  });
}

/**
 * Choose the Jira site the weekly filter opens on: the active tab's, then the
 * one set in the options, then any other open Jira tab.
 * @param {Object} [activeTab] - The active tab.
 * @param {string} [configuredSite] - The "Jira site" option.
 * @param {Array} [openTabs] - Other open Jira tabs.
 * @returns {Object|null} {origin, reuseTab}, or null when no site is known.
 */
export function pickJiraSite(activeTab, configuredSite, openTabs) {
  const fromActiveTab = normalizeJiraSite(activeTab && activeTab.url);
  if (fromActiveTab) return { origin: fromActiveTab, reuseTab: true };

  const configured = normalizeJiraSite(configuredSite);
  if (configured) return { origin: configured, reuseTab: false };

  const fromOpenTab = (openTabs || []).map((tab) => normalizeJiraSite(tab.url)).find(Boolean);
  return fromOpenTab ? { origin: fromOpenTab, reuseTab: false } : null;
}

function describeRange(range, days) {
  const toLabel = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  return `${toLabel(range.startDate)} – ${toLabel(range.endDate)} · last ${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Wire up the toolbar menu.
 * @returns {Promise<void>} Resolves once the menu reflects the saved settings.
 */
export async function initPopup() {
  const weeklyButton = document.getElementById("weeklyFilter");
  const weeklyRange = document.getElementById("weeklyFilterRange");
  const weeklyHint = document.getElementById("weeklyFilterHint");

  document.getElementById("openSettings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  const [settings, activeTabs, jiraTabs] = await Promise.all([
    readSettings(),
    queryTabs({ active: true, currentWindow: true }),
    queryTabs({ url: JIRA_TAB_PATTERN }),
  ]);

  if (settings.enableWeeklyFilter === false) {
    weeklyButton.hidden = true;
    return;
  }

  const days = normalizeDays(settings.weeklyFilterDays);
  weeklyRange.textContent = describeRange(getDateRange(days), days);

  const activeTab = activeTabs[0];
  const site = pickJiraSite(activeTab, settings.jiraSite, jiraTabs);
  if (!site) {
    weeklyButton.disabled = true;
    weeklyHint.hidden = false;
    return;
  }

  weeklyButton.addEventListener("click", () => {
    const url = buildWeeklyFilterUrl(site.origin, { days, jql: settings.weeklyFilterJql });
    if (site.reuseTab) {
      chrome.tabs.update(activeTab.id, { url });
    } else {
      chrome.tabs.create({ url });
    }
    window.close();
  });
  weeklyButton.focus();
}

if (typeof chrome !== "undefined" && chrome.tabs) initPopup();
