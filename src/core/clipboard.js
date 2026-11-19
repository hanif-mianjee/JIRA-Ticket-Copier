import { COLORS } from "../ui/styles.js";
import { getFormat } from "./storage.js";
import { fetchIssueSummary } from "./jira-api.js";
import { BUTTON_TEXT, FEEDBACK_TIMING } from "../config/constants.js";

export function formatMessage(format, info) {
  return format
    .replace(/{{\s*ticketId\s*}}/g, info.ticketId)
    .replace(/{{\s*title\s*}}/g, info.title)
    .replace(/{{\s*status\s*}}/g, info.status || "");
}

export function copyText(text) {
  return navigator.clipboard.writeText(text);
}

export function copyAsLink(text, url) {
  const htmlContent = `<a href="${url}">${text}</a>`;
  const htmlBlob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([text], { type: "text/plain" });
  return navigator.clipboard.write([
    new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
  ]);
}

export function createFeedbackHandler(setContent, resetContent, resetDelay = 1200) {
  return {
    success: (btn) => {
      setContent(btn, "success");
      setTimeout(() => resetContent(btn), resetDelay);
    },
    fail: (btn) => {
      setContent(btn, "fail");
      setTimeout(() => resetContent(btn), resetDelay + 600);
    },
    notfound: (btn) => {
      setContent(btn, "notfound");
      setTimeout(() => resetContent(btn), resetDelay + 600);
    },
    // Restores the button immediately, with no success or failure state, for when
    // an action was abandoned rather than finished.
    reset: (btn) => resetContent(btn),
  };
}

export const mainButtonFeedback = {
  success: (btn) => {
    btn.dataset.feedbackActive = "true";
    const originalBg = btn.style.background;
    btn.textContent = BUTTON_TEXT.copied;
    btn.style.setProperty("background", COLORS.success, "important");
    setTimeout(() => {
      btn.textContent = BUTTON_TEXT.copyTicketInfo;
      btn.style.setProperty("background", originalBg || COLORS.buttonBg, "important");
      btn.dataset.feedbackActive = "false";
    }, FEEDBACK_TIMING.success);
  },
  fail: (btn) => {
    btn.dataset.feedbackActive = "true";
    const originalBg = btn.style.background;
    btn.textContent = BUTTON_TEXT.failed;
    btn.style.setProperty("background", COLORS.error, "important");
    setTimeout(() => {
      btn.textContent = BUTTON_TEXT.copyTicketInfo;
      btn.style.setProperty("background", originalBg || COLORS.buttonBg, "important");
      btn.dataset.feedbackActive = "false";
    }, FEEDBACK_TIMING.error);
  },
};

/**
 * Feedback for a text button that is not the main "Copy Info" button. Success
 * reports how many items were copied.
 * @param {string} label - The button's resting text.
 * @returns {Object} {success(btn, count), fail(btn), notfound(btn)}.
 */
export function createTextButtonFeedback(label) {
  const show = (btn, text, color, duration) => {
    btn.dataset.feedbackActive = "true";
    btn.textContent = text;
    btn.style.setProperty("background", color, "important");
    setTimeout(() => {
      btn.textContent = label;
      btn.style.setProperty("background", COLORS.buttonBg, "important");
      btn.dataset.feedbackActive = "false";
    }, duration);
  };

  return {
    success: (btn, count) => show(btn, count ? `✓ Copied ${count}` : BUTTON_TEXT.copied, COLORS.success, FEEDBACK_TIMING.success),
    fail: (btn) => show(btn, BUTTON_TEXT.failed, COLORS.error, FEEDBACK_TIMING.error),
    notfound: (btn) => show(btn, BUTTON_TEXT.noResults, COLORS.error, FEEDBACK_TIMING.error),
  };
}

export function createIconButtonFeedback(getIconFn) {
  const setContent = (btn, type) => {
    btn.dataset.feedbackActive = "true";
    if (type === "success") {
      btn.style.setProperty("background", COLORS.success, "important");
      btn.innerHTML = "<span style='font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✓</span>";
    } else if (type === "fail") {
      btn.style.setProperty("background", COLORS.error, "important");
      btn.innerHTML = "<span style='font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✗</span>";
    } else if (type === "notfound") {
      btn.style.setProperty("background", COLORS.error, "important");
      btn.innerHTML = "<span style='font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>!</span>";
    }
  };
  const resetContent = (btn) => {
    btn.dataset.feedbackActive = "false";
    btn.style.setProperty("background", COLORS.iconButtonBg, "important");
    btn.innerHTML = getIconFn();
  };
  return createFeedbackHandler(setContent, resetContent);
}

export function createListButtonFeedback(getIconFn) {
  const setContent = (btn, type) => {
    btn.dataset.feedbackActive = "true";
    if (type === "success") {
      btn.style.setProperty("background", COLORS.success, "important");
      btn.innerHTML = "<span style='font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✓</span>";
    } else if (type === "fail") {
      btn.style.setProperty("background", COLORS.error, "important");
      btn.innerHTML = "<span style='font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✗</span>";
    } else if (type === "notfound") {
      btn.style.setProperty("background", COLORS.error, "important");
      btn.innerHTML = "<span style='font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>!</span>";
    }
  };
  const resetContent = (btn) => {
    btn.dataset.feedbackActive = "false";
    btn.style.setProperty("background", COLORS.iconButtonBg, "important");
    btn.innerHTML = getIconFn();
  };
  return createFeedbackHandler(setContent, resetContent, 1200);
}

/**
 * Fill in a title or status the page did not show, from the Jira API. The
 * board's issue popup, for one, renders no status field the selectors find.
 * Nothing is fetched when the page already had what is needed.
 * @param {Object} info - Info scraped from the page.
 * @param {string[]} needed - Which of "title" and "status" the caller needs.
 * @returns {Promise<Object>} The info, with anything that could be fetched filled in.
 */
export async function fillMissingInfo(info, needed) {
  if (!info.ticketId || needed.every((field) => info[field])) return info;
  const fetched = await fetchIssueSummary(info.ticketId);
  return { ...info, title: info.title || fetched.title, status: info.status || fetched.status };
}

export async function copyTicketInfo(pageInfo, statusOverride, btn, feedback) {
  const info = await fillMissingInfo(pageInfo, statusOverride ? ["title"] : ["title", "status"]);
  if (!info.ticketId || !info.title) {
    feedback.fail(btn);
    return;
  }
  const statusToUse = statusOverride || info.status;
  if (!statusToUse) {
    btn.textContent = BUTTON_TEXT.statusNotFound;
    btn.style.setProperty("background", COLORS.error, "important");
    setTimeout(() => {
      btn.textContent = BUTTON_TEXT.copyTicketInfo;
      btn.style.setProperty("background", COLORS.buttonBgActive, "important");
    }, FEEDBACK_TIMING.error);
    return;
  }
  const format = await getFormat("ticketInfoFormat");
  const text = formatMessage(format, { ...info, status: statusToUse });
  copyText(text)
    .then(() => feedback.success(btn))
    .catch(() => feedback.fail(btn));
}

export async function copyGitMessage(pageInfo, btn, feedback) {
  const info = await fillMissingInfo(pageInfo, ["title"]);
  if (!info.ticketId || !info.title) {
    feedback.notfound(btn);
    return;
  }
  const format = await getFormat("commitFormat");
  const text = formatMessage(format, info);
  copyText(text)
    .then(() => feedback.success(btn))
    .catch(() => feedback.fail(btn));
}

export async function copyLinkMessage(pageInfo, btn, feedback) {
  const info = await fillMissingInfo(pageInfo, ["title"]);
  if (!info.ticketId || !info.title) {
    feedback.notfound(btn);
    return;
  }
  const format = await getFormat("linkFormat");
  const text = formatMessage(format, info);
  copyAsLink(text, info.ticketUrl)
    .then(() => feedback.success(btn))
    .catch(() => feedback.fail(btn));
}
