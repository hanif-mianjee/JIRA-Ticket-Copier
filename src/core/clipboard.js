import { COLORS } from "../ui/styles.js";
import { getFormat } from "./storage.js";
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
  };
}

export const mainButtonFeedback = {
  success: (btn) => {
    btn.dataset.feedbackActive = "true";
    const originalBg = btn.style.background;
    btn.textContent = BUTTON_TEXT.copied;
    btn.style.background = COLORS.success;
    setTimeout(() => {
      btn.textContent = BUTTON_TEXT.copyTicketInfo;
      btn.style.background = originalBg || COLORS.buttonBg;
      btn.dataset.feedbackActive = "false";
    }, FEEDBACK_TIMING.success);
  },
  fail: (btn) => {
    btn.dataset.feedbackActive = "true";
    const originalBg = btn.style.background;
    btn.textContent = BUTTON_TEXT.failed;
    btn.style.background = COLORS.error;
    setTimeout(() => {
      btn.textContent = BUTTON_TEXT.copyTicketInfo;
      btn.style.background = originalBg || COLORS.buttonBg;
      btn.dataset.feedbackActive = "false";
    }, FEEDBACK_TIMING.error);
  },
};

export function createIconButtonFeedback(getIconFn) {
  const setContent = (btn, type) => {
    btn.dataset.feedbackActive = "true";
    if (type === "success") {
      btn.style.background = COLORS.success;
      btn.innerHTML = "<span style='font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✓</span>";
    } else if (type === "fail") {
      btn.style.background = COLORS.error;
      btn.innerHTML = "<span style='font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✗</span>";
    } else if (type === "notfound") {
      btn.style.background = COLORS.error;
      btn.innerHTML = "<span style='font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>!</span>";
    }
  };
  const resetContent = (btn) => {
    btn.dataset.feedbackActive = "false";
    btn.style.background = COLORS.iconButtonBg;
    btn.innerHTML = getIconFn();
  };
  return createFeedbackHandler(setContent, resetContent);
}

export function createListButtonFeedback(getIconFn) {
  const setContent = (btn, type) => {
    btn.dataset.feedbackActive = "true";
    if (type === "success") {
      btn.style.background = COLORS.success;
      btn.innerHTML = "<span style='font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✓</span>";
    } else if (type === "fail") {
      btn.style.background = COLORS.error;
      btn.innerHTML = "<span style='font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>✗</span>";
    } else if (type === "notfound") {
      btn.style.background = COLORS.error;
      btn.innerHTML = "<span style='font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;width:100%;height:100%;'>!</span>";
    }
  };
  const resetContent = (btn) => {
    btn.dataset.feedbackActive = "false";
    btn.style.background = COLORS.iconButtonBg;
    btn.innerHTML = getIconFn();
  };
  return createFeedbackHandler(setContent, resetContent, 1200);
}

export async function copyTicketInfo(info, statusOverride, btn, feedback) {
  if (!info.ticketId || !info.title) {
    feedback.fail(btn);
    return;
  }
  const statusToUse = statusOverride || info.status;
  if (!statusToUse) {
    btn.textContent = BUTTON_TEXT.statusNotFound;
    btn.style.background = COLORS.error;
    setTimeout(() => {
      btn.textContent = BUTTON_TEXT.copyTicketInfo;
      btn.style.background = COLORS.buttonBgActive;
    }, FEEDBACK_TIMING.error);
    return;
  }
  const format = await getFormat("ticketInfoFormat");
  const text = formatMessage(format, { ...info, status: statusToUse });
  copyText(text)
    .then(() => feedback.success(btn))
    .catch(() => feedback.fail(btn));
}

export async function copyGitMessage(info, btn, feedback) {
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

export async function copyLinkMessage(info, btn, feedback) {
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
