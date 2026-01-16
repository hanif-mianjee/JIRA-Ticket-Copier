import { getGitIconSVG, getLinkIconSVG, getSmallLinkIconSVG } from "./icons.js";
import { setButtonStyle, setIconButtonStyle, setListButtonStyle, COLORS } from "./styles.js";
import {
  copyTicketInfo,
  copyGitMessage,
  copyLinkMessage,
  mainButtonFeedback,
  createIconButtonFeedback,
  createListButtonFeedback,
} from "../core/clipboard.js";
import { BUTTON_TEXT } from "../config/constants.js";

export function createCopyButton(getInfo, selectedStatusRef) {
  const btn = document.createElement("button");
  btn.id = "jira-ticket-copy-btn";
  btn.textContent = BUTTON_TEXT.copyTicketInfo;
  btn.setAttribute("aria-label", "Copy JIRA ticket info to clipboard");
  btn.setAttribute("tabindex", "0");
  setButtonStyle(btn, true);

  btn.onclick = () => {
    const info = getInfo();
    copyTicketInfo(info, selectedStatusRef.value, btn, mainButtonFeedback);
  };

  return btn;
}

export function createGitButton(getInfo) {
  const btn = document.createElement("button");
  btn.id = "jira-ticket-git-btn";
  btn.setAttribute("aria-label", "Copy git commit message");
  btn.setAttribute("tabindex", "0");
  setIconButtonStyle(btn);
  btn.innerHTML = getGitIconSVG();

  const feedback = createIconButtonFeedback(getGitIconSVG);

  btn.onclick = () => {
    const info = getInfo();
    copyGitMessage(info, btn, feedback);
  };

  return btn;
}

export function createLinkButton(getInfo) {
  const btn = document.createElement("button");
  btn.id = "jira-ticket-link-btn";
  btn.setAttribute("aria-label", "Copy ticket link");
  btn.setAttribute("tabindex", "0");
  setIconButtonStyle(btn);
  btn.innerHTML = getLinkIconSVG();

  const feedback = createIconButtonFeedback(getLinkIconSVG);

  btn.onclick = () => {
    const info = getInfo();
    copyLinkMessage(info, btn, feedback);
  };

  return btn;
}

export function createListLinkButton(getInfo) {
  const btn = document.createElement("button");
  btn.className = "jira-list-copy-link-btn";
  btn.setAttribute("aria-label", "Copy ticket link");
  btn.setAttribute("tabindex", "0");
  setListButtonStyle(btn);
  btn.innerHTML = getSmallLinkIconSVG();

  const feedback = createListButtonFeedback(getSmallLinkIconSVG);

  btn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const info = getInfo();
    copyLinkMessage(info, btn, feedback);
  };

  return btn;
}
