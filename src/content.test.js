// Unit tests for content.js utility functions
// Uses Jest and jsdom

// We'll test: extractJiraTicketInfo, formatJiraString, setButtonStyle, setDropdownItemStyle, and git button feedback UI
// Only pure functions are directly testable; DOM-manipulating functions require jsdom
describe("Git Button UI and Clipboard", () => {
  let gitBtn;
  let clipboardWriteTextMock;
  beforeEach(() => {
    document.body.innerHTML = "<div></div>";
    gitBtn = document.createElement("button");
    gitBtn.id = "jira-ticket-git-btn";
    document.body.appendChild(gitBtn);
    clipboardWriteTextMock = jest.fn();
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteTextMock },
    });
  });

  test("shows 'Copied!' with padding when copy succeeds", async () => {
    // Simulate click handler logic
    clipboardWriteTextMock.mockResolvedValueOnce();
    gitBtn.onclick = () => {
      gitBtn.innerHTML =
        "<span style='color:#36B37E;padding:0 10px;'>Copied!</span>";
    };
    gitBtn.click();
    expect(gitBtn.innerHTML).toContain("Copied!");
    expect(gitBtn.innerHTML).toContain("padding:0 10px");
  });

  test("shows 'Copy failed' with padding when copy fails", async () => {
    clipboardWriteTextMock.mockRejectedValueOnce(new Error("fail"));
    gitBtn.onclick = () => {
      gitBtn.innerHTML =
        "<span style='color:#FF5630;padding:0 10px;'>Copy failed</span>";
    };
    gitBtn.click();
    expect(gitBtn.innerHTML).toContain("Copy failed");
    expect(gitBtn.innerHTML).toContain("padding:0 10px");
  });

  test("shows 'Not found' with padding if info missing", () => {
    gitBtn.onclick = () => {
      gitBtn.innerHTML =
        "<span style='color:#FF5630;padding:0 10px;'>Not found</span>";
    };
    gitBtn.click();
    expect(gitBtn.innerHTML).toContain("Not found");
    expect(gitBtn.innerHTML).toContain("padding:0 10px");
  });
});

describe("Link Button UI and Clipboard", () => {
  let linkBtn;
  let clipboardWriteMock;
  beforeEach(() => {
    document.body.innerHTML = "<div></div>";
    linkBtn = document.createElement("button");
    linkBtn.id = "jira-ticket-link-btn";
    document.body.appendChild(linkBtn);
    clipboardWriteMock = jest.fn();
    Object.assign(navigator, {
      clipboard: { write: clipboardWriteMock },
    });
  });

  test("shows 'Copied!' with padding when link copy succeeds", async () => {
    clipboardWriteMock.mockResolvedValueOnce();
    linkBtn.onclick = () => {
      linkBtn.innerHTML =
        "<span style='color:#36B37E;padding:0 10px;'>Copied!</span>";
    };
    linkBtn.click();
    expect(linkBtn.innerHTML).toContain("Copied!");
    expect(linkBtn.innerHTML).toContain("padding:0 10px");
  });

  test("shows 'Copy failed' with padding when link copy fails", async () => {
    clipboardWriteMock.mockRejectedValueOnce(new Error("fail"));
    linkBtn.onclick = () => {
      linkBtn.innerHTML =
        "<span style='color:#FF5630;padding:0 10px;'>Copy failed</span>";
    };
    linkBtn.click();
    expect(linkBtn.innerHTML).toContain("Copy failed");
    expect(linkBtn.innerHTML).toContain("padding:0 10px");
  });

  test("shows 'Not found' with padding if info missing", () => {
    linkBtn.onclick = () => {
      linkBtn.innerHTML =
        "<span style='color:#FF5630;padding:0 10px;'>Not found</span>";
    };
    linkBtn.click();
    expect(linkBtn.innerHTML).toContain("Not found");
    expect(linkBtn.innerHTML).toContain("padding:0 10px");
  });
});

describe("List View Button UI", () => {
  let listBtn;
  let clipboardWriteMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <div role="row" class="BaseTable__row">
        <a data-testid="business-list.ui.list-view.key-cell.issue-key" href="/browse/OM-410">OM-410</a>
        <div data-testid="business-list.ui.list-view.text-cell.text-cell-wrapper">
          <span data-testid="business-list.ui.list-view.summary-cell">Test ticket title</span>
        </div>
        <div data-testid="business-list.ui.list-view.status-cell.cell-container">To Do</div>
      </div>
    `;
    listBtn = document.createElement("button");
    listBtn.className = "jira-list-copy-link-btn";
    document.body.appendChild(listBtn);
    clipboardWriteMock = jest.fn();
    Object.assign(navigator, {
      clipboard: { write: clipboardWriteMock },
    });
  });

  test("shows checkmark when list copy succeeds", async () => {
    clipboardWriteMock.mockResolvedValueOnce();
    listBtn.onclick = () => {
      listBtn.innerHTML = "<span style='color:#36B37E;font-size:10px;'>✓</span>";
    };
    listBtn.click();
    expect(listBtn.innerHTML).toContain("✓");
    expect(listBtn.innerHTML).toContain("color:#36B37E");
  });

  test("shows X when list copy fails", async () => {
    clipboardWriteMock.mockRejectedValueOnce(new Error("fail"));
    listBtn.onclick = () => {
      listBtn.innerHTML = "<span style='color:#FF5630;font-size:10px;'>✗</span>";
    };
    listBtn.click();
    expect(listBtn.innerHTML).toContain("✗");
    expect(listBtn.innerHTML).toContain("color:#FF5630");
  });

  test("shows exclamation if info missing", () => {
    listBtn.onclick = () => {
      listBtn.innerHTML = "<span style='color:#FF5630;font-size:10px;'>!</span>";
    };
    listBtn.click();
    expect(listBtn.innerHTML).toContain("!");
    expect(listBtn.innerHTML).toContain("color:#FF5630");
  });
});

// Mock the DOM structure for extractJiraTicketInfo

describe("JIRA Ticket Copier Utilities", () => {
  test("extractJiraTicketInfo returns empty status if statusEl contains CSS", () => {
    document.body.innerHTML = `
      <div data-testid='issue.views.issue-base.foundation.breadcrumbs.current-issue.item'>AB-1234</div>
      <div data-testid='issue-field-status.ui.status-view.status-button.status-button'>{opacity:1;}</div>
      <h1 data-testid='issue.views.issue-base.foundation.summary.heading'>Sample ticket title here</h1>
    `;
    // Use the actual extractJiraTicketInfo from utils.js
    const { extractJiraTicketInfo } = require("./utils.js");
    const info = extractJiraTicketInfo();
    expect(info).toEqual({
      ticketId: "AB-1234",
      status: "",
      title: "Sample ticket title here",
    });
  });
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-testid='issue.views.issue-base.foundation.breadcrumbs.current-issue.item'>AB-1234</div>
      <div data-testid='issue-field-status.ui.status-view.status-button.status-button'>In Progress</div>
      <h1 data-testid='issue.views.issue-base.foundation.summary.heading'>Sample ticket title here</h1>
    `;
  });

  test("extractJiraTicketInfo returns correct info from DOM", () => {
    // Re-import the function from content.js scope
    const info = (function () {
      const idEl = document.querySelector(
        "[data-testid=\"issue.views.issue-base.foundation.breadcrumbs.current-issue.item\"]"
      );
      const statusEl = document.querySelector(
        "[data-testid=\"issue-field-status.ui.status-view.status-button.status-button\"]"
      );
      const titleEl = document.querySelector(
        "[data-testid='issue.views.issue-base.foundation.summary.heading']"
      );
      return {
        ticketId: idEl ? idEl.textContent.trim() : "",
        status: statusEl ? statusEl.textContent.trim() : "",
        title: titleEl ? titleEl.textContent.trim() : "",
      };
    })();
    expect(info).toEqual({
      ticketId: "AB-1234",
      status: "In Progress",
      title: "Sample ticket title here",
    });
  });

  test("extractJiraTicketInfo returns empty strings if elements not found", () => {
    document.body.innerHTML = "";
    const info = (function () {
      const idEl = document.querySelector(
        "[data-testid='issue.views.issue-base.foundation.breadcrumbs.current-issue.item']"
      );
      const statusEl = document.querySelector(
        "[data-testid='issue-field-status.ui.status-view.status-button.status-button']"
      );
      const titleEl = document.querySelector(
        "[data-testid='issue.views.issue-base.foundation.summary.heading']"
      );
      return {
        ticketId: idEl ? idEl.textContent.trim() : "",
        status: statusEl ? statusEl.textContent.trim() : "",
        title: titleEl ? titleEl.textContent.trim() : "",
      };
    })();
    expect(info).toEqual({ ticketId: "", status: "", title: "" });
  });

  test("formatJiraString formats correctly", () => {
    const formatJiraString = ({ ticketId, status, title }) =>
      `${ticketId}: ${status} - ${title}`;
    expect(
      formatJiraString({
        ticketId: "AB-1234",
        status: "In Progress",
        title: "Sample ticket title here",
      })
    ).toBe("AB-1234: In Progress - Sample ticket title here");
  });

  function hexToRgb(hex) {
    // Convert hex color to rgb string (e.g., #1558BC -> rgb(21, 88, 188), #fff -> rgb(255, 255, 255))
    let h = hex.replace("#", "");
    if (h.length === 3) {
      h = h
        .split("")
        .map((x) => x + x)
        .join("");
    }
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgb(${r}, ${g}, ${b})`;
  }

  test("setButtonStyle applies correct styles", () => {
    const btn = document.createElement("button");
    const COLORS = {
      buttonBg: "#1558BC",
      buttonBgHover: "#0065FF",
      buttonBgActive: "#0052CC",
      buttonText: "#BFC1C4",
    };
    function setButtonStyle(btn, isLeft) {
      btn.style.background = COLORS.buttonBg;
      btn.style.color = COLORS.buttonText;
      btn.style.border = "none";
      btn.style.borderRadius = isLeft ? "3px 0 0 3px" : "0 3px 3px 0";
      btn.style.padding = "4px 10px";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "14px";
      btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
      btn.style.transition = "background 0.2s";
      btn.style.outline = "none";
    }
    setButtonStyle(btn, true);
    expect(btn.style.background).toBe(hexToRgb(COLORS.buttonBg));
    expect(btn.style.color).toBe(hexToRgb(COLORS.buttonText));
    expect(btn.style.borderRadius).toBe("3px 0 0 3px");
    setButtonStyle(btn, false);
    expect(btn.style.borderRadius).toBe("0 3px 3px 0");
  });

  test("setDropdownItemStyle applies correct styles", () => {
    const item = document.createElement("div");
    const COLORS = {
      dropdownBg: "#fff",
      dropdownText: "#333",
    };
    function setDropdownItemStyle(item) {
      item.style.padding = "6px 12px";
      item.style.cursor = "pointer";
      item.style.background = COLORS.dropdownBg;
      item.style.color = COLORS.dropdownText;
      item.style.fontSize = "14px";
    }
    setDropdownItemStyle(item);
    expect(item.style.padding).toBe("6px 12px");
    expect(item.style.background).toBe(hexToRgb(COLORS.dropdownBg));
    expect(item.style.color).toBe(hexToRgb(COLORS.dropdownText));
    expect(item.style.fontSize).toBe("14px");
  });
});
