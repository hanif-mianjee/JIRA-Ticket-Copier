import { exportTicketMarkdown } from "./export.js";
import { createIconButtonFeedback } from "./clipboard.js";
import { getDownloadIconSVG } from "../ui/icons.js";
import { FEEDBACK_TIMING } from "../config/constants.js";

const MODAL = "#jira-copier-export-modal";
const DOWNLOAD_DIR = "/Users/test/Downloads";

const INFO = {
  ticketId: "YO-518",
  title: "Parse raw CSV files",
  status: "Done",
  ticketUrl: "https://site.atlassian.net/browse/YO-518",
};

const ISSUE = {
  key: "YO-518",
  names: { customfield_10081: "Acceptance Criteria" },
  fields: {
    summary: "Parse raw CSV files",
    issuetype: { name: "Task" },
    status: { name: "Done" },
    assignee: { displayName: "Hanif Mianjee" },
    description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Body." }] }] },
    customfield_10081: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Given a file." }] }] },
  },
};

let downloads;
let blobText;
let blobs;
let savedFiles;
let failDataUrls;
let copiedText;
let button;
let feedback;
let permissionGranted;
let storedSettings;
let requestedAssets;
let optionsOpened;
const OriginalBlob = global.Blob;

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function installChromeMock() {
  global.chrome = {
    runtime: {
      sendMessage: (message, callback) => {
        if (message.type === "hasDownloadsPermission") return callback({ granted: permissionGranted });
        if (message.type === "openOptionsPage") {
          optionsOpened = true;
          return callback({ opened: true });
        }
        if (message.type === "downloadAssets") {
          const accepted = message.assets.filter((asset) => !(failDataUrls && asset.url.startsWith("data:")));
          accepted.forEach((asset) => {
            requestedAssets.push(asset.path);
            // Markdown arrives as a data URL; keep its text so tests can read it.
            if (asset.url.startsWith("data:")) savedFiles[asset.path] = decodeURIComponent(asset.url.split(",").slice(1).join(","));
          });
          return callback({
            granted: permissionGranted,
            saved: accepted.map((asset) => ({ path: asset.path, absolutePath: `${DOWNLOAD_DIR}/${asset.path}` })),
            failed: message.assets.filter((asset) => !accepted.includes(asset)).map((asset) => ({ path: asset.path, message: "too long" })),
          });
        }
        return callback(undefined);
      },
    },
    storage: {
      sync: {
        get: (keys, callback) => callback(storedSettings),
        set: (values, callback) => {
          Object.assign(storedSettings, values);
          callback();
        },
      },
    },
  };
}

function mockJiraFetch(issue = ISSUE, comments = []) {
  global.fetch = jest.fn((url) => {
    const href = String(url);
    if (href.includes("/comment")) return Promise.resolve(jsonResponse({ comments, total: comments.length }));
    if (href.includes("/remotelink")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse(issue));
  });
}

function withAttachments(extra = {}) {
  return {
    ...ISSUE,
    key: "YO-396",
    fields: {
      ...ISSUE.fields,
      summary: "Dates not aligned",
      attachment: [
        { id: "52150", filename: "body-shot.png", size: 59118, mimeType: "image/png", content: "https://site/attachment/content/52150" },
        { id: "52151", filename: "TheYield_Delivery.csv", size: 123500, mimeType: "text/csv", content: "https://site/attachment/content/52151" },
      ],
      ...extra,
    },
  };
}

async function waitFor(condition, attempts = 200) {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) return true;
    await Promise.resolve();
  }
  return condition();
}

const modalButton = (role) => document.querySelector(`${MODAL} [data-role="${role}"]`);

beforeEach(() => {
  downloads = [];
  blobText = "";
  blobs = [];
  savedFiles = {};
  failDataUrls = false;
  copiedText = null;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn((text) => { copiedText = text; return Promise.resolve(); }) },
  });
  requestedAssets = [];
  optionsOpened = false;
  permissionGranted = false;
  storedSettings = {};
  document.body.innerHTML = "";

  // jsdom has no object URLs, no real navigation, and its Blob cannot be read
  // back, so the contents are captured as the Blob is built.
  global.Blob = jest.fn(function MockBlob(parts) {
    blobText = parts.join("");
    blobs.push(blobText);
  });
  URL.createObjectURL = jest.fn(() => "blob:mock");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function trackDownload() {
    downloads.push(this.download);
  });
  installChromeMock();

  button = document.createElement("button");
  button.id = "jira-ticket-export-btn";
  button.innerHTML = getDownloadIconSVG();
  document.body.appendChild(button);
  feedback = createIconButtonFeedback(getDownloadIconSVG);

  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  global.Blob = OriginalBlob;
  delete global.fetch;
  delete global.chrome;
});

describe("exportTicketMarkdown", () => {
  it("downloads a file named from the key and title", async () => {
    mockJiraFetch();
    await exportTicketMarkdown(INFO, button, feedback);

    expect(downloads).toEqual(["YO-518_Parse_raw_CSV_files.md"]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("writes the description and custom rich-text fields into the file", async () => {
    mockJiraFetch();
    await exportTicketMarkdown(INFO, button, feedback);

    expect(blobText).toContain("# YO-518: Parse raw CSV files");
    expect(blobText).toContain("status: Done");
    expect(blobText).toContain("assignee: Hanif Mianjee");
    expect(blobText).toContain("## Description");
    expect(blobText).toContain("Body.");
    // The label comes from the API's field name map, not a hardcoded id.
    expect(blobText).toContain("## Acceptance Criteria");
    expect(blobText).toContain("Given a file.");
  });

  it("shows a spinner while working, then the success state", async () => {
    let releaseIssue;
    global.fetch = jest.fn((url) => {
      const href = String(url);
      if (href.includes("/comment")) return Promise.resolve(jsonResponse({ comments: [], total: 0 }));
      if (href.includes("/remotelink")) return Promise.resolve(jsonResponse([]));
      return new Promise((resolve) => { releaseIssue = () => resolve(jsonResponse(ISSUE)); });
    });

    const pending = exportTicketMarkdown(INFO, button, feedback);
    await Promise.resolve();

    expect(button.querySelector(".jira-copier-spinner")).not.toBeNull();
    expect(button.disabled).toBe(true);
    expect(button.dataset.feedbackActive).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");

    releaseIssue();
    await pending;

    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(button.textContent).toContain("✓");
    expect(button.dataset.feedbackActive).toBe("true");
  });

  it("restores the icon once the feedback window closes", async () => {
    // Fake timers must be in place before the export schedules the reset.
    jest.useFakeTimers();
    mockJiraFetch();

    await exportTicketMarkdown(INFO, button, feedback);
    jest.advanceTimersByTime(FEEDBACK_TIMING.success + 10);

    expect(button.innerHTML).toContain("<svg");
    expect(button.dataset.feedbackActive).toBe("false");
    jest.useRealTimers();
  });

  it("ignores a second click while an export is in flight", async () => {
    let releaseIssue;
    global.fetch = jest.fn((url) => {
      const href = String(url);
      if (href.includes("/comment")) return Promise.resolve(jsonResponse({ comments: [], total: 0 }));
      if (href.includes("/remotelink")) return Promise.resolve(jsonResponse([]));
      return new Promise((resolve) => { releaseIssue = () => resolve(jsonResponse(ISSUE)); });
    });

    const pending = exportTicketMarkdown(INFO, button, feedback);
    await Promise.resolve();
    await exportTicketMarkdown(INFO, button, feedback);

    releaseIssue();
    await pending;

    expect(downloads).toHaveLength(1);
  });

  it("falls back to the page when the API rejects, and still downloads", async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 401)));
    document.body.insertAdjacentHTML("beforeend", `
      <div data-testid="issue.views.field.rich-text.description">
        <div class="ak-renderer-document"><p>Read from the page.</p></div>
      </div>
    `);

    await exportTicketMarkdown(INFO, button, feedback);

    expect(downloads).toEqual(["YO-518_Parse_raw_CSV_files.md"]);
    expect(blobText).toContain("export_source: page");
    expect(blobText).toContain("Read from the page.");
    expect(button.textContent).toContain("✓");
  });

  it("shows the not-found state for an unusable ticket key without fetching", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    await exportTicketMarkdown({ ...INFO, ticketId: "" }, button, feedback);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
    expect(button.textContent).toContain("!");
  });

  it("never leaves the spinner up when the download itself throws", async () => {
    mockJiraFetch();
    URL.createObjectURL = jest.fn(() => { throw new Error("blocked"); });

    await exportTicketMarkdown(INFO, button, feedback);

    expect(button.querySelector(".jira-copier-spinner")).toBeNull();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("✗");
  });

  it("still downloads when the button was removed mid-export", async () => {
    let releaseIssue;
    global.fetch = jest.fn((url) => {
      const href = String(url);
      if (href.includes("/comment")) return Promise.resolve(jsonResponse({ comments: [], total: 0 }));
      if (href.includes("/remotelink")) return Promise.resolve(jsonResponse([]));
      return new Promise((resolve) => { releaseIssue = () => resolve(jsonResponse(ISSUE)); });
    });

    const pending = exportTicketMarkdown(INFO, button, feedback);
    await Promise.resolve();
    button.remove();
    releaseIssue();
    await pending;

    expect(downloads).toHaveLength(1);
  });
});

describe("attachments", () => {
  const inlineMedia = (id) => ({ type: "mediaSingle", content: [{ type: "media", attrs: { id, type: "file" } }] });

  const issueWithInlineImage = () => {
    const issue = withAttachments({
      description: { type: "doc", version: 1, content: [inlineMedia("uuid-body")] },
    });
    // The rendered HTML is the only place a media id sits next to its file name,
    // which is how an inline image is matched to an attachment.
    issue.renderedFields = {
      description: "<div data-node-type=\"media\" data-id=\"uuid-body\" data-file-name=\"body-shot.png\"></div>",
    };
    return issue;
  };

  const commentWithInlineImage = {
    id: "1",
    author: { displayName: "A" },
    created: "2026-01-01T00:00:00.000Z",
    body: { type: "doc", version: 1, content: [inlineMedia("uuid-comment")] },
    renderedBody: "<div data-node-type=\"media\" data-id=\"uuid-comment\" data-file-name=\"TheYield_Delivery.csv\"></div>",
  };

  it("saves inline images and files, then links them by absolute path", async () => {
    permissionGranted = true;
    mockJiraFetch(issueWithInlineImage(), [commentWithInlineImage]);

    await exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);

    expect(requestedAssets).toEqual(["YO-396_files/body-shot.png", "YO-396_files/TheYield_Delivery.csv", "YO-396_Dates_not_aligned.md"]);
    const markdown = savedFiles["YO-396_Dates_not_aligned.md"];
    // Absolute, so the file can be read from anywhere without moving the folder.
    // Quoted because a leading slash is not a safe bare YAML scalar.
    expect(markdown).toContain(`attachments_dir: "${DOWNLOAD_DIR}/YO-396_files"`);
    expect(markdown).toContain(`![body-shot.png](${DOWNLOAD_DIR}/YO-396_files/body-shot.png)`);
    // The underscore is escaped in link text so it cannot start emphasis.
    expect(markdown).toContain(`[TheYield\\_Delivery.csv](${DOWNLOAD_DIR}/YO-396_files/TheYield_Delivery.csv)`);
    // The table links the saved copy and keeps Jira as the source.
    expect(markdown).toContain("[Jira](https://site/attachment/content/52150)");
    expect(document.querySelector(MODAL)).toBeNull();
  });

  it("does not prompt when the permission is already granted", async () => {
    permissionGranted = true;
    mockJiraFetch(withAttachments());

    await exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);

    expect(document.querySelector(MODAL)).toBeNull();
    // Saved through the downloads API, under a fixed name, rather than as a page download.
    expect(downloads).toEqual([]);
    expect(savedFiles["YO-396_Dates_not_aligned.md"]).toContain("# YO-396: Dates not aligned");
  });

  it("does not prompt when the ticket has no attachments", async () => {
    mockJiraFetch();

    await exportTicketMarkdown(INFO, button, feedback);

    expect(document.querySelector(MODAL)).toBeNull();
    expect(requestedAssets).toEqual([]);
    expect(downloads).toHaveLength(1);
  });

  it("prompts when attachments exist but the permission is missing", async () => {
    mockJiraFetch(withAttachments());

    const pending = exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);
    await waitFor(() => document.querySelector(MODAL));

    const modal = document.querySelector(MODAL);
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain("YO-396");
    expect(modal.textContent).toContain("body-shot.png");
    expect(modal.textContent).toContain("TheYield_Delivery.csv");
    expect(modal.textContent).toContain("Download attachments");
    // The spinner is stood down while waiting on the user.
    expect(button.querySelector(".jira-copier-spinner")).toBeNull();

    modalButton("export").click();
    await pending;

    expect(document.querySelector(MODAL)).toBeNull();
  });

  it("exports with remote links when the user declines the attachments", async () => {
    mockJiraFetch(withAttachments());

    const pending = exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);
    await waitFor(() => document.querySelector(MODAL));
    modalButton("export").click();
    await pending;

    expect(downloads).toEqual(["YO-396_Dates_not_aligned.md"]);
    expect(requestedAssets).toEqual([]);
    expect(blobText).toContain("[body-shot.png](https://site/attachment/content/52150)");
    expect(blobText).toContain("> **Export notes**");
    expect(blobText).toMatch(/Download attachments/);
    expect(button.textContent).toContain("✓");
  });

  it("opens the settings page and exports nothing when asked to", async () => {
    mockJiraFetch(withAttachments());

    const pending = exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);
    await waitFor(() => document.querySelector(MODAL));
    modalButton("settings").click();
    await pending;

    expect(optionsOpened).toBe(true);
    expect(downloads).toEqual([]);
    expect(button.disabled).toBe(false);
    expect(button.innerHTML).toContain("<svg");
  });

  it("cancels on Escape without exporting", async () => {
    mockJiraFetch(withAttachments());

    const pending = exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);
    await waitFor(() => document.querySelector(MODAL));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await pending;

    expect(downloads).toEqual([]);
    expect(document.querySelector(MODAL)).toBeNull();
  });

  it("remembers a request not to be asked again", async () => {
    mockJiraFetch(withAttachments());

    const pending = exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);
    await waitFor(() => document.querySelector(MODAL));
    document.querySelector(`${MODAL} [data-role="remember"]`).checked = true;
    modalButton("export").click();
    await pending;

    expect(storedSettings.hideAttachmentPrompt).toBe(true);

    // A second export goes straight through with no prompt.
    downloads = [];
    await exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);

    expect(document.querySelector(MODAL)).toBeNull();
    expect(downloads).toEqual(["YO-396_Dates_not_aligned.md"]);
  });
});

describe("sub-tasks", () => {
  const PARENT = {
    ...ISSUE,
    fields: {
      ...ISSUE.fields,
      subtasks: [
        { key: "YO-519", fields: { summary: "Write the parser", status: { name: "Done" } } },
        { key: "YO-520", fields: { summary: "Hidden one", status: { name: "To Do" } } },
      ],
    },
  };

  const SUBTASK = {
    key: "YO-519",
    names: {},
    fields: {
      summary: "Write the parser",
      issuetype: { name: "Sub-task" },
      status: { name: "Done" },
      parent: { key: "YO-518", fields: { summary: "Parse raw CSV files" } },
      description: {
        type: "doc",
        version: 1,
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Plan" }] },
          { type: "paragraph", content: [{ type: "text", text: "Sub-task body." }] },
        ],
      },
      attachment: [
        { id: "61000", filename: "parser.png", size: 2048, mimeType: "image/png", content: "https://site/attachment/content/61000" },
      ],
    },
  };

  const PARENT_FILE = "YO-518_Parse_raw_CSV_files.md";
  const SUBTASK_FILE = "YO-519_Write_the_parser.md";
  const withoutAttachments = { ...SUBTASK, fields: { ...SUBTASK.fields, attachment: [] } };

  // Answers per issue key, so the parent and each sub-task get their own payload.
  function mockJiraSite(issues) {
    global.fetch = jest.fn((url) => {
      const href = String(url);
      const key = decodeURIComponent(href.match(/\/issue\/([^/?]+)/)[1]);
      if (!issues[key]) return Promise.resolve(jsonResponse({}, 404));
      if (href.includes("/comment")) return Promise.resolve(jsonResponse({ comments: [], total: 0 }));
      if (href.includes("/remotelink")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse(issues[key]));
    });
  }

  const downloaded = (name) => blobs[downloads.indexOf(name)];

  it("saves each sub-task as its own file with its own attachments, linked both ways by absolute path", async () => {
    permissionGranted = true;
    mockJiraSite({ "YO-518": PARENT, "YO-519": SUBTASK });

    await exportTicketMarkdown(INFO, button, feedback);

    expect(requestedAssets).toEqual(["YO-519_files/parser.png", PARENT_FILE, SUBTASK_FILE]);
    // Written through the downloads API, so no page download and no multi-download prompt.
    expect(downloads).toEqual([]);
    // The main ticket's path is what lands on the clipboard.
    expect(copiedText).toBe(`${DOWNLOAD_DIR}/${PARENT_FILE}`);

    const parent = savedFiles[PARENT_FILE];
    expect(parent).toContain(`| [YO-519](${DOWNLOAD_DIR}/${SUBTASK_FILE}) | Write the parser | Done |`);
    expect(parent).toContain("| [YO-520](https://site.atlassian.net/browse/YO-520) | Hidden one | To Do |");
    expect(parent).toMatch(/Sub-task YO-520 could not be exported/);
    expect(parent).not.toContain("parser.png");

    const subtask = savedFiles[SUBTASK_FILE];
    expect(subtask).toContain("# YO-519: Write the parser");
    expect(subtask).toContain(`parent_file: "${DOWNLOAD_DIR}/${PARENT_FILE}"`);
    expect(subtask).toContain(`attachments_dir: "${DOWNLOAD_DIR}/YO-519_files"`);
    expect(subtask).toContain(`[parser.png](${DOWNLOAD_DIR}/YO-519_files/parser.png)`);
    // A standalone document, so its headings start at the normal level.
    expect(subtask).toContain("## Description");
    expect(subtask).toContain("### Plan");
  });

  it("falls back to page downloads, linked relatively, without the downloads permission", async () => {
    mockJiraSite({ "YO-518": PARENT, "YO-519": withoutAttachments });

    await exportTicketMarkdown(INFO, button, feedback);

    expect(downloads).toEqual([PARENT_FILE, SUBTASK_FILE]);
    expect(downloaded(PARENT_FILE)).toContain(`| [YO-519](./${SUBTASK_FILE}) | Write the parser | Done |`);
    expect(downloaded(SUBTASK_FILE)).toContain(`parent_file: "./${PARENT_FILE}"`);
    expect(button.textContent).toContain("✓");
  });

  it("falls back to a page download for any file the downloads API refuses", async () => {
    permissionGranted = true;
    failDataUrls = true;
    mockJiraSite({ "YO-518": PARENT, "YO-519": withoutAttachments });

    await exportTicketMarkdown(INFO, button, feedback);

    expect(downloads).toEqual([PARENT_FILE, SUBTASK_FILE]);
  });

  it("lists sub-task attachments in the prompt and notes the opt-in in the sub-task's file", async () => {
    mockJiraSite({ "YO-518": PARENT, "YO-519": SUBTASK });

    const pending = exportTicketMarkdown(INFO, button, feedback);
    await waitFor(() => document.querySelector(MODAL));

    const modal = document.querySelector(MODAL);
    expect(modal.textContent).toContain("YO-518 and its sub-tasks have 1 image");
    expect(modal.textContent).toContain("YO-519 / parser.png");

    modalButton("export").click();
    await pending;

    expect(downloaded(SUBTASK_FILE)).toContain("[parser.png](https://site/attachment/content/61000)");
    expect(downloaded(SUBTASK_FILE)).toMatch(/Download attachments/);
    // The parent has nothing of its own to download, so it carries no such note.
    expect(downloaded(PARENT_FILE)).not.toMatch(/Download attachments/);
  });

  it("exports only the ticket when sub-tasks are turned off", async () => {
    storedSettings.enableSubtaskExport = false;
    mockJiraSite({ "YO-518": PARENT, "YO-519": SUBTASK });

    await exportTicketMarkdown(INFO, button, feedback);

    const requested = global.fetch.mock.calls.map(([url]) => String(url));
    expect(requested.some((url) => url.includes("YO-519"))).toBe(false);
    expect(downloads).toEqual([PARENT_FILE]);
    expect(blobText).toContain("| [YO-519](https://site.atlassian.net/browse/YO-519) | Write the parser | Done |");
  });
});

describe("copying the exported file's path", () => {
  it("copies the absolute path when the downloads API saved the file", async () => {
    permissionGranted = true;
    mockJiraFetch();

    await exportTicketMarkdown(INFO, button, feedback);

    expect(copiedText).toBe(`${DOWNLOAD_DIR}/YO-518_Parse_raw_CSV_files.md`);
    expect(button.textContent).toContain("✓");
  });

  it("copies the file name when Chrome does not say where the file went", async () => {
    mockJiraFetch();

    await exportTicketMarkdown(INFO, button, feedback);

    expect(downloads).toEqual(["YO-518_Parse_raw_CSV_files.md"]);
    expect(copiedText).toBe("YO-518_Parse_raw_CSV_files.md");
  });

  it("copies nothing when turned off", async () => {
    storedSettings.enableExportPathCopy = false;
    mockJiraFetch();

    await exportTicketMarkdown(INFO, button, feedback);

    expect(copiedText).toBeNull();
    expect(downloads).toHaveLength(1);
  });

  it("still reports success when the clipboard is unavailable", async () => {
    navigator.clipboard.writeText = jest.fn(() => Promise.reject(new Error("Document is not focused")));
    mockJiraFetch();

    await exportTicketMarkdown(INFO, button, feedback);

    expect(downloads).toHaveLength(1);
    expect(button.textContent).toContain("✓");
  });
});
