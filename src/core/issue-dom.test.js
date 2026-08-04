import { buildMediaFilenameMap, buildReplyParentMap, readIssueFromDom } from "./issue-dom.js";

// Structure copied from a real Jira issue page: a reply lives inside its parent's
// item element, wrapped in a reply container.
const THREAD_HTML = `
  <div data-testid="issue.activity.comments-list">
    <ul>
      <li>
        <span data-testid="comment-base-item-93853">
          <div data-testid="issue-comment-base.ui.comment.ak-comment.93853-header">
            <h3>Deborah Castres</h3>
            <span data-testid="issue-timestamp.relative-time">1 hour ago</span>
          </div>
          <div data-testid="issue-comment-base.ui.comment.ak-comment.93853-body">
            <div class="ak-renderer-document"><p>Parent body</p></div>
          </div>
          <ul>
            <li>
              <section data-testid="issue-view-activity-comment.comment-reply-wrapper.reply-container">
                <span data-testid="comment-base-item-93856">
                  <div data-testid="issue-comment-base.ui.comment.ak-comment.93856-header">
                    <h3>Hanif Mianjee</h3>
                    <span data-testid="issue-timestamp.relative-time">5 minutes ago</span>
                  </div>
                  <div data-testid="issue-comment-base.ui.comment.ak-comment.93856-body">
                    <div class="ak-renderer-document"><p>Reply body</p></div>
                  </div>
                </span>
              </section>
            </li>
          </ul>
        </span>
      </li>
    </ul>
  </div>
`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buildReplyParentMap", () => {
  it("maps a reply to its parent comment", () => {
    document.body.innerHTML = THREAD_HTML;
    const map = buildReplyParentMap(document);

    expect(map.get("93856")).toBe("93853");
    expect(map.has("93853")).toBe(false);
  });

  it("returns an empty map when there are no comments", () => {
    document.body.innerHTML = "<div></div>";
    expect(buildReplyParentMap(document).size).toBe(0);
  });
});

describe("buildMediaFilenameMap", () => {
  it("pairs media ids with the file names shown on the page", () => {
    document.body.innerHTML = `
      <div data-node-type="media" data-id="uuid-1" data-file-name="report.html"></div>
      <span data-node-type="mediaInline" data-id="uuid-2" data-file-name="notes (2).html"></span>
      <div data-node-type="media" data-id="uuid-3"></div>
    `;
    const map = buildMediaFilenameMap(document);

    expect(map.get("uuid-1")).toBe("report.html");
    expect(map.get("uuid-2")).toBe("notes (2).html");
    expect(map.has("uuid-3")).toBe(false);
  });
});

describe("readIssueFromDom", () => {
  const info = { ticketId: "YO-518", title: "Parse CSV", status: "Done", ticketUrl: "https://site.atlassian.net/browse/YO-518" };

  it("reads comments with their reply parents, keeping replies after parents", () => {
    document.body.innerHTML = THREAD_HTML;
    const ticket = readIssueFromDom(document, info);

    expect(ticket.degraded).toBe(true);
    expect(ticket.comments).toHaveLength(2);
    expect(ticket.comments.map((comment) => comment.id)).toEqual(["93853", "93856"]);
    expect(ticket.comments[0].author).toBe("Deborah Castres");
    expect(ticket.comments[0].markdown).toBe("Parent body");
    expect(ticket.comments[1].parentId).toBe("93853");
  });

  it("flips top-level order to oldest first without moving replies", () => {
    document.body.innerHTML = `
      <span data-testid="comment-base-item-30">
        <div data-testid="issue-comment-base.ui.comment.ak-comment.30-header"><h3>Newest</h3></div>
        <ul><li>
          <section data-testid="issue-view-activity-comment.comment-reply-wrapper.reply-container">
            <span data-testid="comment-base-item-31">
              <div data-testid="issue-comment-base.ui.comment.ak-comment.31-header"><h3>Replier</h3></div>
            </span>
          </section>
        </li></ul>
      </span>
      <span data-testid="comment-base-item-10">
        <div data-testid="issue-comment-base.ui.comment.ak-comment.10-header"><h3>Oldest</h3></div>
      </span>
    `;
    const ticket = readIssueFromDom(document, info);

    expect(ticket.comments.map((comment) => comment.author)).toEqual(["Oldest", "Newest", "Replier"]);
    expect(ticket.comments[2].parentId).toBe("30");
  });

  it("keeps a relative timestamp verbatim, since the page has no real date", () => {
    document.body.innerHTML = THREAD_HTML;
    const ticket = readIssueFromDom(document, info);
    expect(ticket.comments.map((comment) => comment.created)).toEqual(["1 hour ago", "5 minutes ago"]);
  });

  it("reads an absolute date and the edited flag out of the header", () => {
    document.body.innerHTML = `
      <span data-testid="comment-base-item-1">
        <div data-testid="issue-comment-base.ui.comment.ak-comment.1-header">
          <h3>Xue Yin Zhang</h3>
          <span>July 23, 2026 at 9:13 PM</span>
          <div data-testid="issue-comment-base.ui.comment.ak-tool-tip--container">(edited)</div>
        </div>
        <div data-testid="issue-comment-base.ui.comment.ak-comment.1-body">
          <div class="ak-renderer-document">Body</div>
        </div>
      </span>
    `;
    const ticket = readIssueFromDom(document, info);

    expect(ticket.comments[0].created).toBe("July 23, 2026 at 9:13 PM");
    expect(ticket.comments[0].edited).toBe(true);
  });

  it("reads the description and issue type", () => {
    document.body.innerHTML = `
      <button data-testid="issue.views.issue-base.foundation.change-issue-type.button" aria-label="Bug - Change work type"></button>
      <div data-testid="issue.views.field.rich-text.description">
        <div class="ak-renderer-document"><p>The description.</p></div>
      </div>
    `;
    const ticket = readIssueFromDom(document, info);

    expect(ticket.type).toBe("Bug");
    expect(ticket.sections).toEqual([{ label: "Description", markdown: "The description." }]);
  });

  it("falls back to the scraped info when the page has nothing else", () => {
    document.body.innerHTML = "<div></div>";
    const ticket = readIssueFromDom(document, info);

    expect(ticket.key).toBe("YO-518");
    expect(ticket.title).toBe("Parse CSV");
    expect(ticket.status).toBe("Done");
    expect(ticket.sections).toEqual([]);
    expect(ticket.comments).toEqual([]);
    expect(ticket.warnings).toHaveLength(1);
  });
});
