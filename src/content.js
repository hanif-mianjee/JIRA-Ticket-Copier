import { PAGE_CONFIGS } from "./config/selectors.js";
import { getSetting } from "./core/storage.js";
import { copyTicketInfo, mainButtonFeedback } from "./core/clipboard.js";
import { createCopyButton, createGitButton, createLinkButton, createListLinkButton } from "./ui/buttons.js";
import { createDropdown } from "./ui/dropdown.js";

console.log("[JIRA Ticket Copier] Content script loaded");

function extractInfo(selectors, context = document) {
  const ticketEl = context.querySelector(selectors.ticketId);
  const statusEl = context.querySelector(selectors.status);
  const titleEl = context.querySelector(selectors.title);

  let status = statusEl?.textContent?.trim() || "";
  if (/[{}]/.test(status)) status = "";

  const ticketId = ticketEl?.textContent?.trim() || "";
  const title = titleEl?.textContent?.trim() || "";

  let ticketUrl = window.location.href;
  if (ticketEl?.getAttribute("href")) {
    ticketUrl = `${window.location.origin}${ticketEl.getAttribute("href")}`;
  }

  return { ticketId, status, title, ticketUrl };
}

const BUTTON_CREATORS = {
  copyTicketInfo: (getInfo, selectedStatus) => createCopyButton(getInfo, selectedStatus),
  statusDropdown: (getInfo, selectedStatus, triggerCopy) => createDropdown(selectedStatus, triggerCopy),
  gitButton: (getInfo) => createGitButton(getInfo),
  linkButton: (getInfo) => createLinkButton(getInfo),
  listLinkButton: (getInfo) => createListLinkButton(getInfo),
};

function createButtonGroup(config, getInfo, parent) {
  const group = document.createElement("div");
  group.id = config.groupId;
  Object.assign(group.style, { marginLeft: "8px", display: "inline-flex", alignItems: "center" });
  parent.appendChild(group);

  const selectedStatus = { value: null };
  const triggerCopy = () => {
    const btn = document.getElementById("jira-ticket-copy-btn");
    copyTicketInfo(getInfo(), selectedStatus.value, btn, mainButtonFeedback);
  };

  config.buttons.forEach((buttonName) => {
    const creator = BUTTON_CREATORS[buttonName];
    if (creator) {
      const btn = creator(getInfo, selectedStatus, triggerCopy);
      group.appendChild(btn);
    }
  });
}

function injectSinglePageButtons(config) {
  if (document.getElementById(config.groupId)) return;

  const container = document.querySelector(config.selectors.container);
  if (!container) return;

  const info = extractInfo(config.selectors);
  if (!info.status) return;

  const insertAfter = document.querySelector(config.selectors.insertAfter);
  const parent = insertAfter?.parentNode || container.parentNode;
  const getInfo = () => extractInfo(config.selectors);

  createButtonGroup(config, getInfo, parent);
}

function injectListButtons(config) {
  const rows = document.querySelectorAll(config.selectors.row);

  rows.forEach((row) => {
    if (row.querySelector(`.${config.buttonClass}`)) return;

    const buttonContainer = row.querySelector(config.selectors.buttonContainer);
    if (!buttonContainer) return;

    Object.assign(buttonContainer.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });

    const getInfo = () => extractInfo(config.selectors, row);

    config.buttons.forEach((buttonName) => {
      if (buttonName === "listLinkButton") {
        buttonContainer.appendChild(createListLinkButton(getInfo));
      }
    });
  });
}

function observePage(config, injectFn) {
  injectFn(config);
  const observer = new MutationObserver(() => injectFn(config));
  observer.observe(document.body, { childList: true, subtree: true });
}

PAGE_CONFIGS.forEach((config) => {
  if (!config.urlPattern.test(window.location.href)) return;

  const isListView = !!config.selectors.row;
  const injectFn = isListView ? injectListButtons : injectSinglePageButtons;

  if (config.settingKey) {
    getSetting(config.settingKey).then((enabled) => {
      if (enabled) observePage(config, injectFn);
    });
  } else {
    observePage(config, injectFn);
  }
});
