import { createDropdown, positionMenu } from "./dropdown.js";
import { STATUS_LIST } from "../config/constants.js";

const MENU = "#jira-ticket-status-dropdown-menu";

function rect(values) {
  return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, ...values };
}

function mount() {
  // Jira's breadcrumb nav hides overflow, which is what clipped the old menu.
  document.body.innerHTML = "<nav style=\"overflow: hidden\"><div id=\"group\"></div></nav>";
  const selected = { value: null };
  const onSelect = jest.fn();
  const wrapper = createDropdown(selected, onSelect);
  document.getElementById("group").appendChild(wrapper);
  return { wrapper, button: wrapper.querySelector("button"), menu: document.querySelector(MENU), selected, onSelect };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  delete global.chrome;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createDropdown", () => {
  it("attaches the menu to the body so an overflow-hidden ancestor cannot clip it", () => {
    const { wrapper, menu } = mount();

    expect(menu.parentElement).toBe(document.body);
    expect(wrapper.contains(menu)).toBe(false);
    expect(menu.style.position).toBe("fixed");
  });

  it("opens under the button, right-aligned to it", () => {
    const { button, menu } = mount();
    button.getBoundingClientRect = () => rect({ top: 100, bottom: 128, right: 600 });

    button.click();

    expect(menu.style.display).toBe("block");
    expect(menu.style.top).toBe("132px");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("lists the statuses and reports the one picked", async () => {
    const { button, menu, selected, onSelect } = mount();
    await flush();

    const items = [...menu.querySelectorAll("[role=\"menuitem\"]")].map((item) => item.textContent);
    expect(items).toEqual(["(Use page status)", ...STATUS_LIST]);

    button.click();
    menu.querySelectorAll("[role=\"menuitem\"]")[2].click();

    expect(selected.value).toBe(STATUS_LIST[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(menu.style.display).toBe("none");
  });

  it("closes on an outside click and on Escape", () => {
    const { button, menu } = mount();

    button.click();
    document.body.click();
    expect(menu.style.display).toBe("none");

    button.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.style.display).toBe("none");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("removes the menu when the button group is cleaned up", () => {
    const { wrapper } = mount();

    wrapper._abortController.abort();

    expect(document.querySelector(MENU)).toBeNull();
  });

  it("replaces a menu left behind by a group Jira removed", () => {
    mount();
    document.getElementById("group").remove();
    mount();

    expect(document.querySelectorAll(MENU)).toHaveLength(1);
  });

  it("ignores a resize, which has no node target", () => {
    const { button } = mount();
    button.getBoundingClientRect = () => rect({ top: 10, bottom: 38, right: 300 });
    button.click();

    expect(() => window.dispatchEvent(new Event("resize"))).not.toThrow();
  });
});

describe("positionMenu", () => {
  it("flips above the button when there is no room below", () => {
    const menu = document.createElement("div");
    Object.defineProperty(menu, "offsetHeight", { value: 200 });
    const anchor = document.createElement("button");
    anchor.getBoundingClientRect = () => rect({ top: window.innerHeight - 40, bottom: window.innerHeight - 12, right: 500 });

    positionMenu(menu, anchor);

    expect(menu.style.top).toBe(`${window.innerHeight - 40 - 4 - 200}px`);
  });
});
