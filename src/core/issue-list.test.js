import { copyIssueList, findActionBar, readIssueList } from "./issue-list.js";
import { createTextButtonFeedback } from "./clipboard.js";
import { createIssueListButton } from "../ui/buttons.js";
import { PAGE_CONFIGS } from "../config/selectors.js";
import { FEEDBACK_TIMING } from "../config/constants.js";

const CONFIG = PAGE_CONFIGS.find((config) => config.id === "issue-search");

// Trimmed from the real filter page: each header action sits in its own wrapper.
const HEADER = `
  <h1><span>Weekly Filter</span></h1>
  <div id="action-bar">
    <div><div data-testid="rovo-navigation-button-gnin"><a><button>Search all apps</button></a></div></div>
    <div><button data-testid="actions-pluggable-items.ui.filter-button--trigger">Apps</button><div></div></div>
    <div><button>Share</button></div>
    <div><button data-testid="issue-navigator-action-meatball-menu.ui.menu-trigger">More actions</button></div>
  </div>
`;

function row(key, summary) {
  return `
    <tr data-testid="native-issue-table.ui.issue-row">
      <td><a data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell">${key}</a></td>
      <td><span data-testid="native-issue-table.common.ui.issue-cells.issue-summary.issue-summary-cell">${summary}</span></td>
    </tr>
  `;
}

let clipboardText;

beforeEach(() => {
  clipboardText = null;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn((text) => { clipboardText = text; return Promise.resolve(); }) },
  });
  delete global.chrome;
});

afterEach(() => {
  document.body.innerHTML = "";
  jest.useRealTimers();
});

describe("issue-search config", () => {
  it("matches the search and filter URLs", () => {
    [
      "https://site.atlassian.net/issues?jql=assignee%20%3D%20currentUser()",
      "https://site.atlassian.net/issues/?filter=15770",
      "https://site.atlassian.net/issues/DF-108?jql=project%20%3D%20DF",
      "https://site.atlassian.net/jira/software/c/projects/DF/issues?jql=x",
    ].forEach((url) => expect(CONFIG.urlPattern.test(url)).toBe(true));
    expect(CONFIG.urlPattern.test("https://site.atlassian.net/browse/DF-108")).toBe(false);
  });
});

describe("findActionBar", () => {
  it("finds the bar that holds the header actions", () => {
    document.body.innerHTML = HEADER;
    expect(findActionBar(CONFIG.selectors.actionBarItem)).toBe(document.getElementById("action-bar"));
  });

  it("returns null when the page has no header actions", () => {
    document.body.innerHTML = "<h1>Board</h1>";
    expect(findActionBar(CONFIG.selectors.actionBarItem)).toBeNull();
  });
});

describe("readIssueList", () => {
  it("reads each row's key and summary in order, tidying whitespace", () => {
    document.body.innerHTML = `<table><tbody>${row("DF-108", "Fix   the\n login")}${row("DF-110", "Add export")}</tbody></table>`;

    expect(readIssueList(CONFIG.selectors)).toEqual([
      { ticketId: "DF-108", title: "Fix the login" },
      { ticketId: "DF-110", title: "Add export" },
    ]);
  });

  it("skips a row that is still loading", () => {
    document.body.innerHTML = `<table><tbody>${row("DF-108", "")}${row("DF-110", "Add export")}</tbody></table>`;
    expect(readIssueList(CONFIG.selectors)).toEqual([{ ticketId: "DF-110", title: "Add export" }]);
  });
});

describe("copyIssueList", () => {
  it("copies one bullet line per issue by default", async () => {
    const btn = document.createElement("button");
    const feedback = { success: jest.fn(), fail: jest.fn(), notfound: jest.fn() };

    await copyIssueList([{ ticketId: "DF-108", title: "Fix login" }, { ticketId: "DF-110", title: "Add export" }], btn, feedback);

    expect(clipboardText).toBe("• DF-108: Fix login\n• DF-110: Add export");
    expect(feedback.success).toHaveBeenCalledWith(btn, 2);
  });

  it("uses the line format from the options", async () => {
    global.chrome = { storage: { sync: { get: (keys, callback) => callback({ issueListFormat: "- [{{ticketId}}] {{title}}" }) } } };
    const feedback = { success: jest.fn(), fail: jest.fn(), notfound: jest.fn() };

    await copyIssueList([{ ticketId: "DF-108", title: "Fix login" }], document.createElement("button"), feedback);

    expect(clipboardText).toBe("- [DF-108] Fix login");
  });

  it("reports an empty list instead of copying nothing", async () => {
    const feedback = { success: jest.fn(), fail: jest.fn(), notfound: jest.fn() };

    await copyIssueList([], document.createElement("button"), feedback);

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(feedback.notfound).toHaveBeenCalled();
  });

  it("reports a clipboard failure", async () => {
    navigator.clipboard.writeText = jest.fn(() => Promise.reject(new Error("denied")));
    const feedback = { success: jest.fn(), fail: jest.fn(), notfound: jest.fn() };

    await copyIssueList([{ ticketId: "DF-1", title: "A" }], document.createElement("button"), feedback);

    expect(feedback.fail).toHaveBeenCalled();
  });
});

describe("createIssueListButton", () => {
  it("copies the page's results and shows how many, then resets", async () => {
    jest.useFakeTimers();
    document.body.innerHTML = `${HEADER}<table><tbody>${row("DF-108", "Fix login")}</tbody></table>`;
    const btn = createIssueListButton(() => readIssueList(CONFIG.selectors));

    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(clipboardText).toBe("• DF-108: Fix login");
    expect(btn.textContent).toBe("✓ Copied 1");

    jest.advanceTimersByTime(FEEDBACK_TIMING.success + 10);
    expect(btn.textContent).toBe("Copy list");
    expect(btn.dataset.feedbackActive).toBe("false");
  });

  it("says so when there are no results", () => {
    const btn = document.createElement("button");
    createTextButtonFeedback("Copy list").notfound(btn);
    expect(btn.textContent).toBe("No results");
  });
});
