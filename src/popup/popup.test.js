import { initPopup, pickJiraSite } from "./popup.js";

const SITE = "https://roboticsplus.atlassian.net";

let tabs;
let settings;

function mountPopup() {
  document.body.innerHTML = `
    <button id="weeklyFilter"><span id="weeklyFilterRange"></span></button>
    <p id="weeklyFilterHint" hidden></p>
    <button id="openSettings"></button>
  `;
}

function installChromeMock({ activeTab, jiraTabs = [] }) {
  global.chrome = {
    runtime: { lastError: undefined, openOptionsPage: jest.fn() },
    storage: { sync: { get: (keys, callback) => callback(settings) } },
    tabs: {
      query: (query, callback) => callback(query.active ? [activeTab].filter(Boolean) : jiraTabs),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  tabs = global.chrome.tabs;
}

beforeEach(() => {
  settings = {};
  mountPopup();
  window.close = jest.fn();
});

afterEach(() => {
  delete global.chrome;
});

describe("pickJiraSite", () => {
  it("prefers the active Jira tab, and reuses it", () => {
    expect(pickJiraSite({ url: `${SITE}/browse/DF-1` }, "other.atlassian.net", []))
      .toEqual({ origin: SITE, reuseTab: true });
  });

  it("falls back to the site in the options, then any open Jira tab", () => {
    expect(pickJiraSite({ url: "https://example.com" }, "roboticsplus", []))
      .toEqual({ origin: SITE, reuseTab: false });
    expect(pickJiraSite({}, "", [{ url: `${SITE}/jira/your-work` }]))
      .toEqual({ origin: SITE, reuseTab: false });
  });

  it("returns null when no Jira site is known", () => {
    expect(pickJiraSite({ url: "chrome://extensions" }, "", [])).toBeNull();
  });
});

describe("initPopup", () => {
  it("navigates the active Jira tab to the weekly filter", async () => {
    installChromeMock({ activeTab: { id: 7, url: `${SITE}/browse/DF-108` } });
    await initPopup();

    document.getElementById("weeklyFilter").click();

    const [tabId, { url }] = tabs.update.mock.calls[0];
    expect(tabId).toBe(7);
    expect(url.startsWith(`${SITE}/issues?jql=`)).toBe(true);
    expect(decodeURIComponent(url)).toContain("status = Done");
    expect(window.close).toHaveBeenCalled();
  });

  it("opens a new tab when the active tab is not Jira", async () => {
    settings = { jiraSite: "roboticsplus.atlassian.net" };
    installChromeMock({ activeTab: { id: 3 } });
    await initPopup();

    document.getElementById("weeklyFilter").click();

    expect(tabs.update).not.toHaveBeenCalled();
    expect(tabs.create.mock.calls[0][0].url.startsWith(`${SITE}/issues?jql=`)).toBe(true);
  });

  it("uses the configured number of days and JQL", async () => {
    settings = { weeklyFilterDays: 14, weeklyFilterJql: "resolved >= \"{{startDate}}\"" };
    installChromeMock({ activeTab: { id: 1, url: `${SITE}/browse/DF-1` } });
    await initPopup();

    expect(document.getElementById("weeklyFilterRange").textContent).toContain("last 14 days");

    document.getElementById("weeklyFilter").click();
    expect(decodeURIComponent(tabs.update.mock.calls[0][1].url)).toMatch(/jql=resolved >= "\d{4}-\d{2}-\d{2}"$/);
  });

  it("disables the item and explains why when no Jira site is known", async () => {
    installChromeMock({ activeTab: { id: 1 } });
    await initPopup();

    expect(document.getElementById("weeklyFilter").disabled).toBe(true);
    expect(document.getElementById("weeklyFilterHint").hidden).toBe(false);
  });

  it("hides the item when the feature is turned off", async () => {
    settings = { enableWeeklyFilter: false };
    installChromeMock({ activeTab: { id: 1, url: `${SITE}/browse/DF-1` } });
    await initPopup();

    expect(document.getElementById("weeklyFilter").hidden).toBe(true);
  });

  it("opens the settings page", async () => {
    installChromeMock({ activeTab: { id: 1 } });
    await initPopup();

    document.getElementById("openSettings").click();

    expect(global.chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
