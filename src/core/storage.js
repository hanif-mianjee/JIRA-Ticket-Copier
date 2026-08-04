import { STATUS_LIST } from "../config/constants.js";

const DEFAULT_FORMATS = {
  commitFormat: "{{ticketId}}: {{title}}",
  ticketInfoFormat: "{{ticketId}}: {{status}} - {{title}}",
  linkFormat: "{{ticketId}}: {{title}}",
};

const DEFAULT_SETTINGS = {
  enableTicketInfo: true,
  enableGitButton: true,
  enableLinkButton: true,
  enableExportButton: true,
  enableListView: true,
};

function isStorageAvailable() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;
}

export function getFormat(key) {
  return new Promise((resolve) => {
    if (!isStorageAvailable()) {
      resolve(DEFAULT_FORMATS[key] || "");
      return;
    }
    chrome.storage.sync.get([key], (result) => {
      resolve(result[key] || DEFAULT_FORMATS[key] || "");
    });
  });
}

/**
 * Read a boolean setting.
 * @param {string} key - Storage key.
 * @param {boolean} [defaultValue=true] - Value to use when nothing is stored.
 *   Button toggles default to true; opt-in flags pass false.
 * @returns {Promise<boolean>} The stored value, or the default.
 */
export function getSetting(key, defaultValue = true) {
  return new Promise((resolve) => {
    if (!isStorageAvailable()) {
      const fallback = key in DEFAULT_SETTINGS ? DEFAULT_SETTINGS[key] : defaultValue;
      resolve(fallback !== false);
      return;
    }
    chrome.storage.sync.get([key], (result) => {
      resolve(result[key] === undefined ? defaultValue : result[key] !== false);
    });
  });
}

/**
 * Store a boolean setting.
 * @param {string} key - Storage key.
 * @param {boolean} value - Value to store.
 * @returns {Promise<void>} Resolves once written, or immediately if unavailable.
 */
export function setSetting(key, value) {
  return new Promise((resolve) => {
    if (!isStorageAvailable()) {
      resolve();
      return;
    }
    chrome.storage.sync.set({ [key]: value }, () => resolve());
  });
}

export function getSettings(keys) {
  return new Promise((resolve) => {
    if (!isStorageAvailable()) {
      const defaults = {};
      keys.forEach((key) => {
        defaults[key] = DEFAULT_SETTINGS[key] !== false;
      });
      resolve(defaults);
    } else {
      chrome.storage.sync.get(keys, (result) => {
        const settings = {};
        keys.forEach((key) => {
          settings[key] = result[key] !== false;
        });
        resolve(settings);
      });
    }
  });
}

export function getStatusList() {
  return new Promise((resolve) => {
    if (!isStorageAvailable()) {
      resolve(STATUS_LIST);
      return;
    }
    chrome.storage.sync.get(["statusList"], (result) => {
      const list = result.statusList;
      resolve(Array.isArray(list) && list.length > 0 ? list : STATUS_LIST);
    });
  });
}
