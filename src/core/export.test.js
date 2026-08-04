import { buildExportFilename, buildTicketMarkdown, formatBytes } from "./export.js";

function ticket(overrides = {}) {
  return {
    key: "YO-518",
    title: "Parse raw CSV files",
    url: "https://site.atlassian.net/browse/YO-518",
    type: "Task",
    status: "Done",
    labels: [],
    components: [],
    fixVersions: [],
    sections: [],
    otherFields: [],
    links: [],
    children: [],
    attachments: [],
    remoteLinks: [],
    comments: [],
    degraded: false,
    warnings: [],
    ...overrides,
  };
}

describe("buildExportFilename", () => {
  it("keeps the hyphen inside the issue key", () => {
    expect(buildExportFilename("YO-518", "Parse CSV")).toBe("YO-518_Parse_CSV.md");
  });

  it("collapses the colon and spaces into one underscore", () => {
    expect(buildExportFilename("YO-518", ": a   b")).toBe("YO-518_a_b.md");
  });

  it("spells out an ampersand", () => {
    expect(buildExportFilename("YO-665", "Prediction & Harvest")).toBe("YO-665_Prediction_and_Harvest.md");
  });

  it("removes characters that are unsafe in a file name", () => {
    expect(buildExportFilename("YO-1", "a/b\\c?d*e|f<g>h\"i")).toBe("YO-1_a_b_c_d_e_f_g_h_i.md");
  });

  it("keeps non-Latin titles instead of dropping them", () => {
    expect(buildExportFilename("YO-2", "設定を更新")).toBe("YO-2_設定を更新.md");
  });

  it("falls back to the key when the title has nothing usable", () => {
    expect(buildExportFilename("YO-3", "🎉🎉")).toBe("YO-3.md");
  });

  it("caps the length without leaving a trailing separator", () => {
    const name = buildExportFilename("YO-4", "word ".repeat(100));
    expect(name.length).toBeLessThanOrEqual(150);
    expect(name).not.toMatch(/_\.md$/);
    expect(name.endsWith(".md")).toBe(true);
  });

  it("falls back entirely when there is no key or title", () => {
    expect(buildExportFilename("", "")).toBe("jira-ticket.md");
  });
});

describe("formatBytes", () => {
  it("scales to readable units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(201656)).toBe("196.9 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
  });

  it("returns an empty string for a missing size", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(undefined)).toBe("");
  });
});

describe("buildTicketMarkdown", () => {
  it("writes frontmatter, quoting values that need it", () => {
    const output = buildTicketMarkdown(ticket({
      title: "Fix: the thing",
      assignee: "Hanif Mianjee",
      labels: ["a", "b"],
      created: "2026-06-17T10:23:00.000+1000",
    }), "2026-08-04T16:20:00.000Z");

    expect(output).toContain("key: YO-518");
    expect(output).toContain("title: \"Fix: the thing\"");
    expect(output).toContain("assignee: Hanif Mianjee");
    expect(output).toContain("labels: [a, b]");
    expect(output).toContain("created: \"2026-06-17T10:23:00.000+1000\"");
    expect(output).toContain("exported: \"2026-08-04T16:20:00.000Z\"");
  });

  it("omits frontmatter keys with no value", () => {
    const output = buildTicketMarkdown(ticket());
    expect(output).not.toContain("resolution:");
    expect(output).not.toContain("labels:");
  });

  it("titles the document with the key and summary", () => {
    expect(buildTicketMarkdown(ticket())).toContain("# YO-518: Parse raw CSV files");
  });

  it("renders each rich-text section under its own heading", () => {
    const sections = [
      { label: "Description", markdown: "The description." },
      { label: "Acceptance Criteria", markdown: "- one\n- two" },
    ];
    const output = buildTicketMarkdown(ticket({ sections }));
    expect(output).toContain("## Description\n\nThe description.");
    expect(output).toContain("## Acceptance Criteria\n\n- one\n- two");
  });

  it("tables the linked work items with their relationship", () => {
    const links = [{
      relationship: "is blocked by",
      key: "YO-100",
      summary: "Blocker",
      status: "In Progress",
      url: "https://site.atlassian.net/browse/YO-100",
    }];
    const output = buildTicketMarkdown(ticket({ links }));
    expect(output).toContain("## Linked Work Items");
    expect(output).toContain("| is blocked by | [YO-100](https://site.atlassian.net/browse/YO-100) | Blocker | In Progress |");
  });

  it("tables child work items", () => {
    const children = [{ key: "YO-101", summary: "Subtask", status: "To Do", url: "" }];
    const output = buildTicketMarkdown(ticket({ children }));
    expect(output).toContain("## Child Work Items");
    expect(output).toContain("| YO-101 | Subtask | To Do |");
  });

  it("tables attachments with size and download link", () => {
    const attachments = [{
      filename: "report.html",
      size: 201656,
      mimeType: "text/html",
      url: "https://site.atlassian.net/rest/api/3/attachment/content/1",
      created: "2026-07-23T22:07:00.000+1000",
    }];
    const output = buildTicketMarkdown(ticket({ attachments }));
    expect(output).toContain("## Attachments");
    expect(output).toContain("[report.html](https://site.atlassian.net/rest/api/3/attachment/content/1) | 196.9 KB | text/html |");
  });

  it("lists remote links", () => {
    const remoteLinks = [{ relationship: "mentioned on", title: "Ops Sprints", url: "https://site.atlassian.net/wiki/x" }];
    const output = buildTicketMarkdown(ticket({ remoteLinks }));
    expect(output).toContain("## Remote Links");
    expect(output).toContain("- mentioned on: [Ops Sprints](https://site.atlassian.net/wiki/x)");
  });

  it("skips sections that have no data", () => {
    const output = buildTicketMarkdown(ticket());
    ["## Linked Work Items", "## Child Work Items", "## Attachments", "## Remote Links", "## Comments"]
      .forEach((heading) => expect(output).not.toContain(heading));
  });

  it("escapes a pipe inside a table cell", () => {
    const otherFields = [{ label: "Query", value: "a | b" }];
    const output = buildTicketMarkdown(ticket({ otherFields }));
    expect(output).toContain("| Query | a \\| b |");
  });

  it("flags a degraded export in the frontmatter and notes", () => {
    const output = buildTicketMarkdown(ticket({ degraded: true, warnings: ["API unavailable"] }));
    expect(output).toContain("export_source: page");
    expect(output).toContain("> **Export notes**");
    expect(output).toContain("> - API unavailable");
  });
});

describe("comment rendering", () => {
  const comment = (id, author, created, extra = {}) => ({
    id,
    author,
    created,
    edited: false,
    markdown: `Body of ${id}`,
    parentId: null,
    ...extra,
  });

  it("numbers top-level comments and nests replies under their parent", () => {
    const comments = [
      comment("93853", "Deborah Castres", "2026-07-14T09:12:00.000+1000"),
      // The reply id sorts after its parent, so order alone cannot imply threading.
      comment("93856", "Hanif Mianjee", "2026-07-14T11:04:00.000+1000", { parentId: "93853" }),
      comment("93860", "Nick Jobson", "2026-07-15T08:00:00.000+1000"),
    ];
    const output = buildTicketMarkdown(ticket({ comments }));

    expect(output).toContain("## Comments (3)");
    expect(output).toContain("### 1. Deborah Castres — 2026-07-14T09:12:00.000+1000");
    expect(output).toContain("#### ↳ Reply: Hanif Mianjee — 2026-07-14T11:04:00.000+1000");
    expect(output).toContain("### 2. Nick Jobson — 2026-07-15T08:00:00.000+1000");
    expect(output.indexOf("Reply: Hanif")).toBeLessThan(output.indexOf("2. Nick Jobson"));
  });

  it("marks an edited comment", () => {
    const comments = [comment("1", "A", "2026-01-01T00:00:00.000Z", { edited: true })];
    expect(buildTicketMarkdown(ticket({ comments }))).toContain("### 1. A — 2026-01-01T00:00:00.000Z — edited");
  });

  it("keeps a reply whose parent is missing as a top-level comment", () => {
    const comments = [comment("2", "Orphan", "2026-01-01T00:00:00.000Z", { parentId: "999" })];
    const output = buildTicketMarkdown(ticket({ comments }));
    expect(output).toContain("### 1. Orphan");
    expect(output).toContain("Body of 2");
  });

  it("falls back to Unknown when the author is missing", () => {
    const comments = [comment("3", "", "2026-01-01T00:00:00.000Z")];
    expect(buildTicketMarkdown(ticket({ comments }))).toContain("### 1. Unknown");
  });
});
