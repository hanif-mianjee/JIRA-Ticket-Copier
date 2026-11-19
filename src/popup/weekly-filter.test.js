import {
  DEFAULT_WEEKLY_FILTER_JQL,
  buildWeeklyFilterJql,
  buildWeeklyFilterUrl,
  formatJqlDate,
  getDateRange,
  normalizeDays,
  normalizeJiraSite,
} from "./weekly-filter.js";

const THURSDAY = new Date(2026, 10, 19, 15, 30);

describe("formatJqlDate", () => {
  it("pads the month and day", () => {
    expect(formatJqlDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("normalizeDays", () => {
  it("keeps a sensible whole number", () => {
    expect(normalizeDays("14")).toBe(14);
  });

  it("falls back to a week for anything unusable", () => {
    [undefined, "", "abc", 0, -3, 2.5].forEach((value) => expect(normalizeDays(value)).toBe(7));
  });

  it("caps very large ranges", () => {
    expect(normalizeDays(5000)).toBe(365);
  });
});

describe("getDateRange", () => {
  it("covers the last seven days, today included", () => {
    expect(getDateRange(7, THURSDAY)).toEqual({ startDate: "2026-11-13", endDate: "2026-11-19" });
  });

  it("covers just today for one day", () => {
    expect(getDateRange(1, THURSDAY)).toEqual({ startDate: "2026-11-19", endDate: "2026-11-19" });
  });

  it("crosses a month and year boundary", () => {
    expect(getDateRange(7, new Date(2027, 0, 3))).toEqual({ startDate: "2026-12-28", endDate: "2027-01-03" });
  });
});

describe("buildWeeklyFilterJql", () => {
  it("fills the default template, reaching the end of today", () => {
    const jql = buildWeeklyFilterJql("", { startDate: "2026-11-13", endDate: "2026-11-19" });

    expect(jql).toBe([
      "assignee = currentUser()",
      "AND status = Done",
      "AND statuscategorychangeddate >= \"2026-11-13\"",
      "AND statuscategorychangeddate <= \"2026-11-19 23:59\"",
    ].join("\n"));
  });

  it("fills a custom template", () => {
    const jql = buildWeeklyFilterJql("updated >= {{ startDate }} AND updated <= {{endDate}}", { startDate: "a", endDate: "b" });
    expect(jql).toBe("updated >= a AND updated <= b");
  });
});

describe("normalizeJiraSite", () => {
  it("accepts a bare site name, a host or a full URL", () => {
    expect(normalizeJiraSite("roboticsplus")).toBe("https://roboticsplus.atlassian.net");
    expect(normalizeJiraSite("RoboticsPlus.atlassian.net")).toBe("https://roboticsplus.atlassian.net");
    expect(normalizeJiraSite("https://roboticsplus.atlassian.net/browse/DF-108")).toBe("https://roboticsplus.atlassian.net");
  });

  it("rejects anything that is not Jira Cloud over https", () => {
    ["", "example.com", "http://site.atlassian.net", "evil.atlassian.net.example.com"]
      .forEach((value) => expect(normalizeJiraSite(value)).toBe(""));
  });
});

describe("buildWeeklyFilterUrl", () => {
  it("opens the issue search with the encoded JQL", () => {
    const url = buildWeeklyFilterUrl("https://roboticsplus.atlassian.net", { days: 7 }, THURSDAY);
    const jql = decodeURIComponent(url.split("?jql=")[1]);

    expect(url.startsWith("https://roboticsplus.atlassian.net/issues?jql=assignee%20%3D%20currentUser()%0AAND")).toBe(true);
    expect(jql).toBe(buildWeeklyFilterJql(DEFAULT_WEEKLY_FILTER_JQL, { startDate: "2026-11-13", endDate: "2026-11-19" }));
  });
});
