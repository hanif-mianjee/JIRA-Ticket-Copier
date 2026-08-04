chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "dist/welcome/welcome.html"
    });
  } else if (details.reason === "update") {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;

    if (previousVersion !== currentVersion) {
      chrome.tabs.create({
        url: "dist/welcome/welcome.html"
      });
    }
  }
});

// Content scripts cannot call chrome.downloads, and they cannot fetch attachment
// bytes either: Jira redirects attachment content to media-cdn.atlassian.com,
// which is outside the granted host permission. chrome.downloads follows that
// redirect with the user's cookies and is not subject to CORS, so asset saving
// is delegated here. The "downloads" permission is optional, so it may be absent.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "downloadAssets") {
    downloadAssets(message.assets)
      .then(sendResponse)
      .catch((error) => sendResponse({ granted: true, saved: [], failed: [], error: error.message }));
    return true;
  }

  if (message.type === "hasDownloadsPermission") {
    hasDownloadsPermission().then((granted) => sendResponse({ granted }));
    return true;
  }

  if (message.type === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
    sendResponse({ opened: true });
    return true;
  }

  return false;
});

// Callback style throughout: promise support was added to these APIs at various
// Chrome versions, and the manifest supports Chrome 88.
function hasDownloadsPermission() {
  return new Promise((resolve) => {
    if (!chrome.permissions || !chrome.permissions.contains) {
      resolve(false);
      return;
    }
    chrome.permissions.contains({ permissions: ["downloads"] }, (granted) => {
      resolve(Boolean(granted) && Boolean(chrome.downloads));
    });
  });
}

function downloadOne(asset) {
  return new Promise((resolve) => {
    chrome.downloads.download({
      url: asset.url,
      filename: asset.path,
      // Keeps the path predictable so the links written into the Markdown always
      // resolve, and re-exporting a ticket refreshes its files instead of piling
      // up "(1)" copies.
      conflictAction: "overwrite",
      saveAs: false
    }, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error || downloadId === undefined) {
        resolve({ ok: false, message: error ? error.message : "download did not start" });
        return;
      }
      resolve({ ok: true, downloadId });
    });
  });
}

const FILENAME_POLL_ATTEMPTS = 40;
const FILENAME_POLL_DELAY_MS = 50;

function searchDownload(downloadId) {
  return new Promise((resolve) => {
    chrome.downloads.search({ id: downloadId }, (items) => {
      if (chrome.runtime.lastError || !items || items.length === 0) {
        resolve(null);
        return;
      }
      resolve(items[0]);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Look up where a download actually landed. The absolute path is what lets the
 * exported Markdown be read from anywhere, or pasted into a chat, without moving
 * the attachment folder alongside it.
 *
 * Chrome hands back a download id before it has settled on a filename, so a
 * single read usually returns an empty string. This waits for the real one.
 */
async function resolveAbsolutePath(downloadId) {
  for (let attempt = 0; attempt < FILENAME_POLL_ATTEMPTS; attempt += 1) {
    const item = await searchDownload(downloadId);
    if (item && item.filename) return item.filename;
    if (item && item.state === "interrupted") return "";
    await delay(FILENAME_POLL_DELAY_MS);
  }
  return "";
}

/**
 * Work out the downloads directory from a path we know, so any file whose
 * filename never resolved can still be given an absolute path. Safe because
 * conflictAction is "overwrite", so Chrome does not rename anything.
 */
function baseDirectoryOf(absolutePath, relativePath) {
  const normalized = relativePath.replace(/\//g, absolutePath.includes("\\") ? "\\" : "/");
  if (!absolutePath.endsWith(normalized)) return "";
  return absolutePath.slice(0, absolutePath.length - normalized.length);
}

function joinPath(baseDirectory, relativePath) {
  const separator = baseDirectory.includes("\\") ? "\\" : "/";
  return `${baseDirectory}${relativePath.replace(/\//g, separator)}`;
}

async function downloadAssets(assets) {
  if (!(await hasDownloadsPermission())) return { granted: false, saved: [], failed: [] };
  if (!Array.isArray(assets) || assets.length === 0) return { granted: true, saved: [], failed: [] };

  const saved = [];
  const failed = [];
  // Only the first file is waited on. Once the downloads directory is known the
  // rest can be derived, because conflictAction is "overwrite" so Chrome does not
  // rename anything. That keeps a ticket with many attachments fast.
  let baseDirectory = "";
  let baseDirectoryUnavailable = false;

  for (const asset of assets) {
    const result = await downloadOne(asset);
    if (!result.ok) {
      failed.push({ path: asset.path, message: result.message });
      continue;
    }

    let absolutePath = "";
    if (baseDirectory) {
      absolutePath = joinPath(baseDirectory, asset.path);
    } else if (!baseDirectoryUnavailable) {
      absolutePath = await resolveAbsolutePath(result.downloadId);
      baseDirectory = absolutePath ? baseDirectoryOf(absolutePath, asset.path) : "";
      if (!baseDirectory) baseDirectoryUnavailable = true;
    }

    saved.push({ path: asset.path, absolutePath });
  }

  return { granted: true, saved, failed };
}
