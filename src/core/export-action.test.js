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
          requestedAssets.push(...message.assets.map((asset) => asset.path));
          return callback({
            granted: permissionGranted,
            saved: message.assets.map((asset) => ({ path: asset.path, absolutePath: `${DOWNLOAD_DIR}/${asset.path}` })),
            failed: [],
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
  requestedAssets = [];
  optionsOpened = false;
  permissionGranted = false;
  storedSettings = {};
  document.body.innerHTML = "";

  // jsdom has no object URLs, no real navigation, and its Blob cannot be read
  // back, so the contents are captured as the Blob is built.
  global.Blob = jest.fn(function MockBlob(parts) {
    blobText = parts.join("");
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

    expect(requestedAssets).toEqual(["YO-396_files/body-shot.png", "YO-396_files/TheYield_Delivery.csv"]);
    // Absolute, so the file can be read from anywhere without moving the folder.
    // Quoted because a leading slash is not a safe bare YAML scalar.
    expect(blobText).toContain(`attachments_dir: "${DOWNLOAD_DIR}/YO-396_files"`);
    expect(blobText).toContain(`![body-shot.png](${DOWNLOAD_DIR}/YO-396_files/body-shot.png)`);
    // The underscore is escaped in link text so it cannot start emphasis.
    expect(blobText).toContain(`[TheYield\\_Delivery.csv](${DOWNLOAD_DIR}/YO-396_files/TheYield_Delivery.csv)`);
    // The table links the saved copy and keeps Jira as the source.
    expect(blobText).toContain("[Jira](https://site/attachment/content/52150)");
    expect(document.querySelector(MODAL)).toBeNull();
  });

  it("does not prompt when the permission is already granted", async () => {
    permissionGranted = true;
    mockJiraFetch(withAttachments());

    await exportTicketMarkdown({ ...INFO, ticketId: "YO-396" }, button, feedback);

    expect(document.querySelector(MODAL)).toBeNull();
    expect(downloads).toHaveLength(1);
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
