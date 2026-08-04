// The service worker is copied unbundled and has no exports, so it is exercised
// through the listener it registers, exactly as Chrome would call it.

const DOWNLOAD_DIR = "/Users/test/Downloads";

let messageListener;
let downloadCalls;
let searchResults;
let permissionGranted;

function installChromeMock() {
  downloadCalls = [];
  searchResults = new Map();
  permissionGranted = true;

  global.chrome = {
    runtime: {
      lastError: undefined,
      onInstalled: { addListener: () => {} },
      onMessage: { addListener: (listener) => { messageListener = listener; } },
      openOptionsPage: jest.fn(),
      getManifest: () => ({ version: "0.4.0" }),
    },
    tabs: { create: jest.fn() },
    permissions: {
      contains: (request, callback) => callback(permissionGranted),
    },
    downloads: {
      download: (options, callback) => {
        downloadCalls.push(options);
        callback(downloadCalls.length);
      },
      search: (query, callback) => {
        const queue = searchResults.get(query.id) || [];
        callback(queue.length > 1 ? [queue.shift()] : [queue[0]]);
      },
    },
  };
}

function send(message) {
  return new Promise((resolve) => {
    const handled = messageListener(message, {}, resolve);
    if (!handled) resolve(undefined);
  });
}

beforeEach(async () => {
  jest.resetModules();
  installChromeMock();
  await import("./background.js");
});

afterEach(() => {
  delete global.chrome;
});

describe("downloads permission", () => {
  it("reports the permission as granted", async () => {
    expect(await send({ type: "hasDownloadsPermission" })).toEqual({ granted: true });
  });

  it("reports it as missing when the downloads API is unavailable", async () => {
    delete global.chrome.downloads;
    expect(await send({ type: "hasDownloadsPermission" })).toEqual({ granted: false });
  });

  it("reports it as missing when not granted", async () => {
    permissionGranted = false;
    expect(await send({ type: "hasDownloadsPermission" })).toEqual({ granted: false });
  });

  it("ignores messages it does not own", async () => {
    expect(await send({ type: "somethingElse" })).toBeUndefined();
  });
});

describe("downloadAssets", () => {
  const asset = (name) => ({ url: `https://site/attachment/${name}`, path: `YO-518_files/${name}` });

  it("waits for Chrome to settle on a filename before reporting it", async () => {
    // Chrome hands back an id before the filename exists; the first read is empty.
    searchResults.set(1, [
      { id: 1, filename: "", state: "in_progress" },
      { id: 1, filename: `${DOWNLOAD_DIR}/YO-518_files/report.html`, state: "in_progress" },
    ]);

    const response = await send({ type: "downloadAssets", assets: [asset("report.html")] });

    expect(response.granted).toBe(true);
    expect(response.saved).toEqual([{
      path: "YO-518_files/report.html",
      absolutePath: `${DOWNLOAD_DIR}/YO-518_files/report.html`,
    }]);
  });

  it("overwrites inside the ticket folder so paths stay predictable", async () => {
    searchResults.set(1, [{ id: 1, filename: `${DOWNLOAD_DIR}/YO-518_files/a.png`, state: "complete" }]);

    await send({ type: "downloadAssets", assets: [asset("a.png")] });

    expect(downloadCalls[0]).toMatchObject({
      filename: "YO-518_files/a.png",
      conflictAction: "overwrite",
      saveAs: false,
    });
  });

  it("derives later paths from the first, without waiting again", async () => {
    searchResults.set(1, [{ id: 1, filename: `${DOWNLOAD_DIR}/YO-518_files/first.png`, state: "complete" }]);
    // No search results registered for the second file: it must not be polled.
    const searchSpy = jest.fn(global.chrome.downloads.search);
    global.chrome.downloads.search = searchSpy;

    const response = await send({
      type: "downloadAssets",
      assets: [asset("first.png"), asset("second.png")],
    });

    expect(response.saved[1].absolutePath).toBe(`${DOWNLOAD_DIR}/YO-518_files/second.png`);
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops waiting for filenames once one never resolves", async () => {
    searchResults.set(1, [{ id: 1, filename: "", state: "in_progress" }]);
    searchResults.set(2, [{ id: 2, filename: "", state: "in_progress" }]);

    const response = await send({
      type: "downloadAssets",
      assets: [asset("a.png"), asset("b.png")],
    });

    // Both fall back to a relative link rather than stalling per file.
    expect(response.saved.map((entry) => entry.absolutePath)).toEqual(["", ""]);
  }, 10000);

  it("records an interrupted download as failed", async () => {
    searchResults.set(1, [{ id: 1, filename: "", state: "interrupted" }]);

    const response = await send({ type: "downloadAssets", assets: [asset("gone.png")] });

    expect(response.saved).toEqual([{ path: "YO-518_files/gone.png", absolutePath: "" }]);
  });

  it("reports a download that never starts as failed", async () => {
    global.chrome.downloads.download = (options, callback) => {
      global.chrome.runtime.lastError = { message: "blocked" };
      callback(undefined);
      global.chrome.runtime.lastError = undefined;
    };

    const response = await send({ type: "downloadAssets", assets: [asset("a.png")] });

    expect(response.saved).toEqual([]);
    expect(response.failed[0]).toMatchObject({ path: "YO-518_files/a.png", message: "blocked" });
  });

  it("does not download anything without the permission", async () => {
    permissionGranted = false;

    const response = await send({ type: "downloadAssets", assets: [asset("a.png")] });

    expect(response).toEqual({ granted: false, saved: [], failed: [] });
    expect(downloadCalls).toEqual([]);
  });

  it("handles an empty asset list", async () => {
    expect(await send({ type: "downloadAssets", assets: [] })).toEqual({ granted: true, saved: [], failed: [] });
  });
});

describe("openOptionsPage", () => {
  it("opens the options page on request", async () => {
    expect(await send({ type: "openOptionsPage" })).toEqual({ opened: true });
    expect(global.chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
