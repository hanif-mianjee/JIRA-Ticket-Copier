// Saves a ticket's attachments next to the exported Markdown so the file links to
// files on disk instead of URLs that need a Jira session.

const ASSET_FOLDER_SUFFIX = "_files";
const MAX_ASSET_NAME_LENGTH = 100;

/**
 * Make an attachment file name safe to use as a download path segment.
 * @param {string} name - Original file name.
 * @returns {string} A sanitized file name, never empty.
 */
export function sanitizeAssetFilename(name) {
  const safe = String(name || "")
    .replace(/[\\/]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/[^\p{L}\p{N}._ ()-]+/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .replace(/^[_.\s-]+|[_.\s]+$/g, "");

  if (safe === "") return "attachment";
  if (safe.length <= MAX_ASSET_NAME_LENGTH) return safe;

  // Trim the middle out rather than the extension, which readers rely on.
  const dot = safe.lastIndexOf(".");
  const extension = dot > 0 ? safe.slice(dot) : "";
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  return `${stem.slice(0, MAX_ASSET_NAME_LENGTH - extension.length)}${extension}`;
}

/**
 * Work out where each attachment should be saved and how the Markdown should
 * refer to it. Names are made unique so two attachments cannot overwrite one
 * another inside the ticket folder.
 * @param {string} ticketKey - Issue key, used to name the folder.
 * @param {Array} attachments - Attachments from the normalized ticket.
 * @returns {Object} {folder, assets} where each asset has url, path and localPath.
 */
export function buildAssetPlan(ticketKey, attachments) {
  const folder = `${sanitizeAssetFilename(ticketKey) || "jira-ticket"}${ASSET_FOLDER_SUFFIX}`;
  const used = new Set();
  const assets = [];

  (attachments || []).forEach((attachment) => {
    if (!attachment.url || !attachment.filename) return;

    let name = sanitizeAssetFilename(attachment.filename);
    if (used.has(name.toLowerCase())) {
      const dot = name.lastIndexOf(".");
      const extension = dot > 0 ? name.slice(dot) : "";
      const stem = dot > 0 ? name.slice(0, dot) : name;
      name = `${stem}-${attachment.id || used.size}${extension}`;
    }
    used.add(name.toLowerCase());

    assets.push({
      filename: attachment.filename,
      url: attachment.url,
      path: `${folder}/${name}`,
      // Used only if Chrome will not tell us where the file actually landed.
      localPath: `./${folder}/${encodeURI(name)}`,
    });
  });

  return { folder, assets };
}

/**
 * Ask the service worker whether the optional downloads permission is granted.
 * Content scripts have no access to chrome.permissions themselves.
 * @returns {Promise<boolean>} True when attachments can be downloaded.
 */
export function hasDownloadPermission() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      resolve(false);
      return;
    }
    chrome.runtime.sendMessage({ type: "hasDownloadsPermission" }, (response) => {
      resolve(!chrome.runtime.lastError && Boolean(response && response.granted));
    });
  });
}

/**
 * Ask the service worker to open the options page, where the permission can be
 * granted. chrome.permissions.request needs a user gesture on an extension page,
 * so it cannot be called from here.
 */
export function openOptionsPage() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  chrome.runtime.sendMessage({ type: "openOptionsPage" }, () => chrome.runtime.lastError);
}

/**
 * Ask the service worker to save the planned assets.
 * The downloads permission is optional, so a refusal is a normal outcome: the
 * caller keeps the remote URLs instead.
 * @param {Array} assets - Assets from buildAssetPlan.
 * @returns {Promise<Object>} {granted, saved, failed}.
 */
export function requestAssetDownload(assets) {
  return new Promise((resolve) => {
    if (!assets || assets.length === 0) {
      resolve({ granted: false, saved: [], failed: [] });
      return;
    }
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      resolve({ granted: false, saved: [], failed: [] });
      return;
    }

    chrome.runtime.sendMessage({ type: "downloadAssets", assets }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({ granted: false, saved: [], failed: [] });
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Save a ticket's attachments and return the map the Markdown writer uses to
 * point at local files. Returns null when nothing was saved, which keeps the
 * export on remote URLs.
 * @param {string} ticketKey - Issue key.
 * @param {Array} attachments - Attachments from the normalized ticket.
 * @returns {Promise<Object>} {assetPaths, folder, warnings}.
 */
export async function saveTicketAssets(ticketKey, attachments) {
  const { folder, assets } = buildAssetPlan(ticketKey, attachments);
  if (assets.length === 0) return { assetPaths: null, folder, assetDir: "", warnings: [] };

  const result = await requestAssetDownload(assets);
  if (!result.granted) {
    return {
      assetPaths: null,
      folder,
      assetDir: "",
      warnings: ["Attachments were not downloaded, so images and files link to Jira and need a login. Enable \"Download attachments\" in the extension options to save them alongside this file."],
    };
  }

  // Prefer the absolute path Chrome reports, so the Markdown can be read from
  // anywhere — or pasted into a chat — without moving the attachment folder.
  const savedByPath = new Map((result.saved || []).map((entry) => (
    typeof entry === "string" ? [entry, ""] : [entry.path, entry.absolutePath || ""]
  )));

  const assetPaths = new Map();
  let assetDir = "";
  assets.forEach((asset) => {
    if (!savedByPath.has(asset.path)) return;
    const absolute = savedByPath.get(asset.path);
    assetPaths.set(asset.filename, absolute || asset.localPath);
    if (absolute && !assetDir) assetDir = directoryOf(absolute);
  });

  const warnings = [];
  const failedCount = assets.length - assetPaths.size;
  if (failedCount > 0) {
    warnings.push(`${failedCount} of ${assets.length} attachments could not be downloaded and still link to Jira.`);
  }

  return { assetPaths: assetPaths.size > 0 ? assetPaths : null, folder, assetDir, warnings };
}

function directoryOf(absolutePath) {
  const separator = absolutePath.includes("\\") ? "\\" : "/";
  const index = absolutePath.lastIndexOf(separator);
  return index > 0 ? absolutePath.slice(0, index) : "";
}
