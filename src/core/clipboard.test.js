import { copyGitMessage, copyTicketInfo, fillMissingInfo } from "./clipboard.js";

const INFO = { ticketId: "DF-109", title: "Popup ticket", status: "", ticketUrl: "https://site.atlassian.net/browse/DF-109" };

let clipboardText;

function mockIssue(fields, status = 200) {
  global.fetch = jest.fn(() => Promise.resolve({ ok: status === 200, status, json: async () => ({ fields }) }));
}

function feedback() {
  return { success: jest.fn(), fail: jest.fn(), notfound: jest.fn() };
}

beforeEach(() => {
  clipboardText = null;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn((text) => { clipboardText = text; return Promise.resolve(); }) },
  });
  delete global.chrome;
});

afterEach(() => {
  delete global.fetch;
});

describe("fillMissingInfo", () => {
  it("fetches nothing when the page already showed what is needed", async () => {
    global.fetch = jest.fn();
    const info = { ...INFO, status: "Done" };

    expect(await fillMissingInfo(info, ["title", "status"])).toBe(info);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fills a missing status from the API, keeping what the page showed", async () => {
    mockIssue({ summary: "API title", status: { name: "In Progress" } });

    const filled = await fillMissingInfo(INFO, ["title", "status"]);

    expect(filled.status).toBe("In Progress");
    expect(filled.title).toBe("Popup ticket");
    expect(String(global.fetch.mock.calls[0][0])).toContain("/rest/api/3/issue/DF-109?fields=summary,status");
  });

  it("leaves the values empty when the API fails", async () => {
    mockIssue({}, 401);
    expect((await fillMissingInfo(INFO, ["status"])).status).toBe("");
  });
});

describe("copy buttons in a view without a status field", () => {
  it("copies ticket info with the status fetched from the API", async () => {
    mockIssue({ summary: "Popup ticket", status: { name: "In Progress" } });
    const handler = feedback();

    await copyTicketInfo(INFO, null, document.createElement("button"), handler);

    expect(clipboardText).toBe("DF-109: In Progress - Popup ticket");
    expect(handler.success).toHaveBeenCalled();
  });

  it("uses a chosen status override without fetching", async () => {
    global.fetch = jest.fn();

    await copyTicketInfo(INFO, "Blocked", document.createElement("button"), feedback());

    expect(clipboardText).toBe("DF-109: Blocked - Popup ticket");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("copies a git message using a title fetched from the API", async () => {
    mockIssue({ summary: "Fetched title", status: { name: "Done" } });

    await copyGitMessage({ ...INFO, title: "" }, document.createElement("button"), feedback());

    expect(clipboardText).toBe("DF-109: Fetched title");
  });
});
