import { COLORS, setButtonStyle, setDropdownItemStyle } from "./styles.js";
import { getStatusList } from "../core/storage.js";
import { getChevronDownSVG } from "./icons.js";

const DROPDOWN_STYLES_ID = "jira-copier-dropdown-styles";
const MENU_ID = "jira-ticket-status-dropdown-menu";
const MENU_GAP_PX = 4;

/**
 * Append dropdown styles only once to prevent duplicate style tags
 */
function appendDropdownStyles() {
  if (document.getElementById(DROPDOWN_STYLES_ID)) return;
  
  const style = document.createElement("style");
  style.id = DROPDOWN_STYLES_ID;
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #${MENU_ID}::-webkit-scrollbar {
      width: 8px;
    }
    #${MENU_ID}::-webkit-scrollbar-track {
      background: #F4F5F7;
    }
    #${MENU_ID}::-webkit-scrollbar-thumb {
      background: #C1C7D0;
      border-radius: 4px;
    }
    #${MENU_ID}::-webkit-scrollbar-thumb:hover {
      background: #A5ADBA;
    }
    @media (prefers-reduced-motion: reduce) {
      #jira-ticket-status-dropdown-wrapper *,
      #${MENU_ID},
      #${MENU_ID} * {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Place the menu under the button, right-aligned to it, or above it when there
 * is not enough room below.
 * @param {HTMLElement} menu - The open menu.
 * @param {HTMLElement} anchor - The button it belongs to.
 */
export function positionMenu(menu, anchor) {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const menuHeight = menu.offsetHeight;
  const fitsBelow = rect.bottom + MENU_GAP_PX + menuHeight <= window.innerHeight;
  const top = fitsBelow || rect.top < menuHeight ? rect.bottom + MENU_GAP_PX : rect.top - MENU_GAP_PX - menuHeight;

  menu.style.top = `${Math.max(0, top)}px`;
  menu.style.right = `${Math.max(0, viewportWidth - rect.right)}px`;
}

/**
 * Build the status override dropdown.
 * The menu is attached to document.body with fixed positioning rather than
 * nested in the button group: Jira's breadcrumb container hides overflow, which
 * clipped a menu positioned inside it.
 * @param {Object} selectedStatusRef - Holds the chosen status in `value`.
 * @param {Function} onSelect - Called after a status is picked.
 * @returns {HTMLElement} The dropdown wrapper, with `_abortController` for cleanup.
 */
export function createDropdown(selectedStatusRef, onSelect) {
  // Append styles once
  appendDropdownStyles();

  // A menu left behind by a button group Jira re-rendered away.
  const stale = document.getElementById(MENU_ID);
  if (stale) {
    if (stale._abortController) stale._abortController.abort();
    stale.remove();
  }

  const dropdownWrapper = document.createElement("div");
  dropdownWrapper.id = "jira-ticket-status-dropdown-wrapper";
  Object.assign(dropdownWrapper.style, {
    display: "inline-block",
    position: "relative",
    fontSize: "13px",
  });

  const dropdownBtn = document.createElement("button");
  dropdownBtn.innerHTML = getChevronDownSVG();
  dropdownBtn.setAttribute("aria-label", "Select status override");
  dropdownBtn.setAttribute("aria-haspopup", "true");
  dropdownBtn.setAttribute("aria-expanded", "false");
  dropdownBtn.title = "Override status";
  setButtonStyle(dropdownBtn, false);
  // Override to match main button height and center the icon
  Object.assign(dropdownBtn.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "28px",
    padding: "0 5px",
  });

  const dropdownMenu = document.createElement("div");
  dropdownMenu.id = MENU_ID;
  dropdownMenu.setAttribute("role", "menu");
  Object.assign(dropdownMenu.style, {
    display: "none",
    position: "fixed",
    top: "0",
    right: "0",
    background: COLORS.dropdownBg,
    border: `1px solid ${COLORS.dropdownBorder}`,
    borderRadius: "4px",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
    zIndex: "9999999",
    minWidth: "180px",
    maxHeight: "280px",
    overflowY: "auto",
    fontSize: "13px",
    animation: "fadeIn 0.15s ease",
  });

  const isOpen = () => dropdownMenu.style.display !== "none";

  const closeMenu = () => {
    dropdownMenu.style.display = "none";
    dropdownBtn.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    dropdownMenu.style.display = "block";
    dropdownBtn.setAttribute("aria-expanded", "true");
    positionMenu(dropdownMenu, dropdownBtn);
  };

  const selectStatus = (status) => {
    selectedStatusRef.value = status;
    closeMenu();
    onSelect();
  };

  const defaultItem = document.createElement("div");
  defaultItem.textContent = "(Use page status)";
  defaultItem.setAttribute("role", "menuitem");
  setDropdownItemStyle(defaultItem, true);
  defaultItem.onclick = () => selectStatus(null);
  dropdownMenu.appendChild(defaultItem);

  getStatusList().then((statusList) => {
    statusList.forEach((status) => {
      const item = document.createElement("div");
      item.textContent = status;
      item.setAttribute("role", "menuitem");
      setDropdownItemStyle(item);
      item.onclick = () => selectStatus(status);
      dropdownMenu.appendChild(item);
    });
    if (isOpen()) positionMenu(dropdownMenu, dropdownBtn);
  });

  dropdownBtn.onclick = (e) => {
    e.stopPropagation();
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  // Use AbortController to prevent memory leaks from accumulated event listeners
  const abortController = new AbortController();
  const { signal } = abortController;

  document.addEventListener("click", closeMenu, { signal });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeMenu();
  }, { signal });

  // Fixed positioning does not follow the button, so keep it attached while the
  // page or any scroll container moves. Capture catches scrolls on inner panels.
  const followButton = (e) => {
    if (!isOpen() || (e.target instanceof Node && dropdownMenu.contains(e.target))) return;
    if (!dropdownBtn.isConnected) {
      closeMenu();
      return;
    }
    positionMenu(dropdownMenu, dropdownBtn);
  };
  window.addEventListener("scroll", followButton, { capture: true, passive: true, signal });
  window.addEventListener("resize", followButton, { signal });

  signal.addEventListener("abort", () => dropdownMenu.remove());

  // Store abort controller on wrapper for cleanup when element is removed
  dropdownWrapper._abortController = abortController;
  dropdownMenu._abortController = abortController;

  dropdownWrapper.appendChild(dropdownBtn);
  document.body.appendChild(dropdownMenu);

  return dropdownWrapper;
}
