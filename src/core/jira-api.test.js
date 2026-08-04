import { JiraApiError, fetchIssueBundle, isIssueKey } from "./jira-api.js";

const ORIGIN = "https://site.atlassian.net";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetch(handler) {
  global.fetch = jest.fn((url) => Promise.resolve(handler(String(url))));
  return global.fetch;
}

const issuePayload = { key: "YO-518", fields: { summary: "Title" }, names: { customfield_1: "Acceptance Criteria" } };

afterEach(() => {
  delete global.fetch;
});

describe("isIssueKey", () => {
  it("accepts real issue keys", () => {
    expect(isIssueKey("YO-518")).toBe(true);
    expect(isIssueKey("ABC1-9")).toBe(true);
    expect(isIssueKey("A_B-1")).toBe(true);
  });

  it("rejects anything else", () => {
    ["", "yo-518", "YO", "YO-", "-1", "../../admin", "YO-518/x", null, 42].forEach((value) => {
      expect(isIssueKey(value)).toBe(false);
    });
  });
});

describe("fetchIssueBundle", () => {
  it("returns the issue, names, comments and remote links", async () => {
    mockFetch((url) => {
      if (url.includes("/comment")) return jsonResponse({ comments: [{ id: "1" }], total: 1 });
      if (url.includes("/remotelink")) return jsonResponse([{ object: { url: "https://x.test" } }]);
      return jsonResponse(issuePayload);
    });

    const bundle = await fetchIssueBundle("YO-518", { origin: ORIGIN });

    expect(bundle.issue.key).toBe("YO-518");
    expect(bundle.names.customfield_1).toBe("Acceptance Criteria");
    expect(bundle.comments).toHaveLength(1);
    expect(bundle.remoteLinks).toHaveLength(1);
    expect(bundle.warnings).toEqual([]);
  });

  it("asks for all fields, the field name map and the rendered HTML", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes("/comment")) return jsonResponse({ comments: [], total: 0 });
      if (url.includes("/remotelink")) return jsonResponse([]);
      return jsonResponse(issuePayload);
    });

    await fetchIssueBundle("YO-518", { origin: ORIGIN });

    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}/rest/api/3/issue/YO-518?fields=*all&expand=names,renderedFields`);
    expect(fetchMock.mock.calls[0][1].credentials).toBe("same-origin");
    // renderedBody is what lets an inline image in a comment be matched to its
    // attachment even when the comment is not on screen.
    expect(fetchMock.mock.calls[1][0]).toContain("expand=renderedBody");
  });

  it("pages through comments until the total is reached", async () => {
    const pages = {
      0: { comments: [{ id: "1" }, { id: "2" }], total: 3 },
      2: { comments: [{ id: "3" }], total: 3 },
    };
    mockFetch((url) => {
      if (url.includes("/comment")) {
        const startAt = Number(new URL(url).searchParams.get("startAt"));
        return jsonResponse(pages[startAt]);
      }
      if (url.includes("/remotelink")) return jsonResponse([]);
      return jsonResponse(issuePayload);
    });

    const bundle = await fetchIssueBundle("YO-518", { origin: ORIGIN });
    expect(bundle.comments.map((comment) => comment.id)).toEqual(["1", "2", "3"]);
  });

  it("stops paging and warns when the server keeps reporting more", async () => {
    mockFetch((url) => {
      if (url.includes("/comment")) return jsonResponse({ comments: [{ id: "x" }], total: 100000 });
      if (url.includes("/remotelink")) return jsonResponse([]);
      return jsonResponse(issuePayload);
    });

    const bundle = await fetchIssueBundle("YO-518", { origin: ORIGIN });
    expect(bundle.comments).toHaveLength(10);
    expect(bundle.warnings.join(" ")).toMatch(/Stopped after 10 pages/);
  });

  it("treats a missing remote-link endpoint as no links", async () => {
    mockFetch((url) => {
      if (url.includes("/comment")) return jsonResponse({ comments: [], total: 0 });
      if (url.includes("/remotelink")) return jsonResponse({}, 404);
      return jsonResponse(issuePayload);
    });

    const bundle = await fetchIssueBundle("YO-518", { origin: ORIGIN });
    expect(bundle.remoteLinks).toEqual([]);
    expect(bundle.warnings.join(" ")).toMatch(/remote links/);
  });

  it("keeps the issue when comments fail to load", async () => {
    mockFetch((url) => {
      if (url.includes("/comment")) return jsonResponse({}, 429);
      if (url.includes("/remotelink")) return jsonResponse([]);
      return jsonResponse(issuePayload);
    });

    const bundle = await fetchIssueBundle("YO-518", { origin: ORIGIN });
    expect(bundle.issue.key).toBe("YO-518");
    expect(bundle.comments).toEqual([]);
    expect(bundle.warnings.join(" ")).toMatch(/comments/);
  });

  it("throws when the issue itself cannot be read", async () => {
    mockFetch(() => jsonResponse({}, 401));
    await expect(fetchIssueBundle("YO-518", { origin: ORIGIN })).rejects.toThrow(JiraApiError);
  });

  it("rejects a bad key before making any request", async () => {
    const fetchMock = mockFetch(() => jsonResponse(issuePayload));
    await expect(fetchIssueBundle("../../admin", { origin: ORIGIN })).rejects.toThrow(JiraApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
