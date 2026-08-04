import { buildAssetPlan, requestAssetDownload, sanitizeAssetFilename, saveTicketAssets } from "./assets.js";

const attachment = (overrides = {}) => ({
  id: "1",
  filename: "image.png",
  size: 100,
  mimeType: "image/png",
  url: "https://site.atlassian.net/rest/api/3/attachment/content/1",
  created: "",
  ...overrides,
});

afterEach(() => {
  delete global.chrome;
});

describe("sanitizeAssetFilename", () => {
  it("keeps a normal file name intact", () => {
    expect(sanitizeAssetFilename("image-20260504-055858.png")).toBe("image-20260504-055858.png");
  });

  it("keeps spaces and parentheses that Jira file names use", () => {
    expect(sanitizeAssetFilename("ingest report (2).html")).toBe("ingest report (2).html");
  });

  it("strips path separators so a file cannot escape the folder", () => {
    expect(sanitizeAssetFilename("../../etc/passwd")).toBe("etc_passwd");
    expect(sanitizeAssetFilename("a/b\\c.txt")).toBe("a_b_c.txt");
  });

  it("falls back when nothing usable is left", () => {
    expect(sanitizeAssetFilename("")).toBe("attachment");
    expect(sanitizeAssetFilename("///")).toBe("attachment");
  });

  it("shortens a long name but keeps the extension", () => {
    const name = sanitizeAssetFilename(`${"x".repeat(300)}.png`);
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith(".png")).toBe(true);
  });
});

describe("buildAssetPlan", () => {
  it("puts assets in a folder named after the ticket", () => {
    const { folder, assets } = buildAssetPlan("YO-396", [attachment()]);

    expect(folder).toBe("YO-396_files");
    expect(assets[0].path).toBe("YO-396_files/image.png");
    expect(assets[0].localPath).toBe("./YO-396_files/image.png");
  });

  it("url-encodes the link but not the download path", () => {
    const { assets } = buildAssetPlan("YO-1", [attachment({ filename: "my report (2).csv" })]);

    expect(assets[0].path).toBe("YO-1_files/my report (2).csv");
    expect(assets[0].localPath).toBe("./YO-1_files/my%20report%20(2).csv");
  });

  it("keeps two attachments with the same name from overwriting each other", () => {
    const { assets } = buildAssetPlan("YO-1", [
      attachment({ id: "1", filename: "shot.png" }),
      attachment({ id: "2", filename: "shot.png" }),
    ]);

    expect(assets[0].path).toBe("YO-1_files/shot.png");
    expect(assets[1].path).toBe("YO-1_files/shot-2.png");
  });

  it("skips attachments with no download url", () => {
    const { assets } = buildAssetPlan("YO-1", [attachment({ url: "" })]);
    expect(assets).toEqual([]);
  });
});

describe("requestAssetDownload", () => {
  it("reports not granted when the extension APIs are missing", async () => {
    const result = await requestAssetDownload([{ url: "https://x", path: "a/b.png" }]);
    expect(result.granted).toBe(false);
  });

  it("passes the assets to the service worker", async () => {
    const sendMessage = jest.fn((message, callback) => callback({ granted: true, saved: [message.assets[0].path], failed: [] }));
    global.chrome = { runtime: { sendMessage } };

    const result = await requestAssetDownload([{ url: "https://x", path: "a/b.png" }]);

    expect(sendMessage.mock.calls[0][0].type).toBe("downloadAssets");
    expect(result.saved).toEqual(["a/b.png"]);
  });

  it("treats a messaging error as not granted", async () => {
    global.chrome = {
      runtime: { sendMessage: (message, callback) => callback(undefined), lastError: { message: "no receiver" } },
    };

    const result = await requestAssetDownload([{ url: "https://x", path: "a/b.png" }]);
    expect(result.granted).toBe(false);
  });
});

describe("saveTicketAssets", () => {
  it("maps file names to local paths when the download succeeds", async () => {
    global.chrome = {
      runtime: { sendMessage: (message, callback) => callback({ granted: true, saved: message.assets.map((a) => a.path), failed: [] }) },
    };

    const { assetPaths, warnings } = await saveTicketAssets("YO-396", [attachment({ filename: "shot.png" })]);

    expect(assetPaths.get("shot.png")).toBe("./YO-396_files/shot.png");
    expect(warnings).toEqual([]);
  });

  it("explains how to opt in when the permission is missing", async () => {
    const { assetPaths, warnings } = await saveTicketAssets("YO-396", [attachment()]);

    expect(assetPaths).toBeNull();
    expect(warnings[0]).toMatch(/Download attachments/);
  });

  it("keeps the successful files and warns about the rest", async () => {
    global.chrome = {
      runtime: {
        sendMessage: (message, callback) => callback({
          granted: true,
          saved: [message.assets[0].path],
          failed: [{ path: message.assets[1].path, message: "network" }],
        }),
      },
    };

    const { assetPaths, warnings } = await saveTicketAssets("YO-1", [
      attachment({ id: "1", filename: "a.png" }),
      attachment({ id: "2", filename: "b.png" }),
    ]);

    expect(assetPaths.get("a.png")).toBe("./YO-1_files/a.png");
    expect(assetPaths.has("b.png")).toBe(false);
    expect(warnings[0]).toMatch(/1 of 2/);
  });

  it("does nothing when the ticket has no attachments", async () => {
    const { assetPaths, warnings } = await saveTicketAssets("YO-1", []);
    expect(assetPaths).toBeNull();
    expect(warnings).toEqual([]);
  });
});
