export const COLORS = {
  buttonBg: "#0052CC",
  buttonBgHover: "#0065FF",
  buttonBgActive: "#0747A6",
  buttonText: "#FFFFFF",
  dropdownBg: "#FFFFFF",
  dropdownText: "#172B4D",
  dropdownHoverBg: "#DEEBFF",
  dropdownHoverText: "#0052CC",
  dropdownBorder: "#DFE1E6",
  error: "#DE350B",
  success: "#00875A",
  iconButtonBg: "#42526E",
  iconButtonBgHover: "#344563",
  iconButtonBgActive: "#253858",
  shadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  shadowHover: "0 6px 12px rgba(0, 0, 0, 0.15)",
};

export function setButtonStyle(btn, isLeft) {
  Object.assign(btn.style, {
    background: COLORS.buttonBg,
    color: COLORS.buttonText,
    border: "none",
    borderRadius: isLeft ? "3px 0 0 3px" : "0 3px 3px 0",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: "500",
    boxShadow: COLORS.shadow,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    outline: "none",
    lineHeight: "1.3",
    position: "relative",
  });

  btn.onmouseenter = () => {
    if (btn.dataset.feedbackActive === "true") return;
    btn.style.background = COLORS.buttonBgHover;
    btn.style.boxShadow = COLORS.shadowHover;
    btn.style.transform = "translateY(-1px)";
  };

  btn.onmouseleave = () => {
    if (btn.dataset.feedbackActive === "true") return;
    btn.style.background = COLORS.buttonBg;
    btn.style.boxShadow = COLORS.shadow;
    btn.style.transform = "translateY(0)";
  };

  btn.onmousedown = () => {
    btn.style.background = COLORS.buttonBgActive;
    btn.style.transform = "translateY(0)";
    btn.style.outline = "none";
  };

  btn.onfocus = () => {
    btn.style.outline = "none";
  };

  btn.onblur = () => {
    btn.style.outline = "none";
  };
}

export function setDropdownItemStyle(item, isDefault = false) {
  Object.assign(item.style, {
    padding: "8px 16px",
    cursor: "pointer",
    background: COLORS.dropdownBg,
    color: isDefault ? "#6B778C" : COLORS.dropdownText,
    fontSize: "12px",
    fontWeight: isDefault ? "400" : "500",
    fontStyle: isDefault ? "italic" : "normal",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    borderBottom: `1px solid ${COLORS.dropdownBorder}`,
  });

  item.onmouseenter = () => {
    item.style.background = COLORS.dropdownHoverBg;
    item.style.color = COLORS.dropdownHoverText;
    item.style.paddingLeft = "18px";
  };

  item.onmouseleave = () => {
    item.style.background = COLORS.dropdownBg;
    item.style.color = isDefault ? "#6B778C" : COLORS.dropdownText;
    item.style.paddingLeft = "16px";
  };
}

export function setIconButtonStyle(btn, options = {}) {
  const { height = "28px", marginLeft = "6px", padding = "0 8px" } = options;
  Object.assign(btn.style, {
    background: COLORS.iconButtonBg,
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    padding,
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height,
    minWidth: height,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    marginLeft,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
    position: "relative",
  });

  btn.onmouseenter = () => {
    if (btn.dataset.feedbackActive === "true") return;
    btn.style.background = COLORS.iconButtonBgHover;
    btn.style.transform = "translateY(-1px)";
    btn.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.16)";
  };

  btn.onmouseleave = () => {
    if (btn.dataset.feedbackActive === "true") return;
    btn.style.background = COLORS.iconButtonBg;
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.12)";
  };

  btn.onmousedown = () => {
    btn.style.background = COLORS.iconButtonBgActive;
    btn.style.transform = "translateY(0)";
    btn.style.outline = "none";
  };

  btn.onfocus = () => {
    btn.style.outline = "none";
  };

  btn.onblur = () => {
    btn.style.outline = "none";
  };
}

export function setListButtonStyle(btn) {
  Object.assign(btn.style, {
    background: COLORS.iconButtonBg,
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    padding: "0 5px",
    cursor: "pointer",
    fontSize: "12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "22px",
    width: "22px",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    marginLeft: "6px",
    flexShrink: "0",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
    outline: "none",
  });

  btn.onmouseenter = () => {
    if (btn.dataset.feedbackActive === "true") return;
    btn.style.background = COLORS.iconButtonBgHover;
    btn.style.transform = "scale(1.1)";
    btn.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.15)";
  };

  btn.onmouseleave = () => {
    if (btn.dataset.feedbackActive === "true") return;
    btn.style.background = COLORS.iconButtonBg;
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.1)";
  };

  btn.onfocus = () => {
    btn.style.outline = "none";
  };

  btn.onblur = () => {
    btn.style.outline = "none";
  };

  btn.onmousedown = () => {
    btn.style.outline = "none";
  };
}
