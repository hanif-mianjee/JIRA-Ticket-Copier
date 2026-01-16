import { STATUS_LIST } from "../config/selectors.js";
import { COLORS, setButtonStyle, setDropdownItemStyle } from "./styles.js";
import { getStatusList } from "../core/storage.js";
import { getChevronDownSVG } from "./icons.js";

export function createDropdown(selectedStatusRef, onSelect) {
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
  Object.assign(dropdownMenu.style, {
    display: "none",
    position: "absolute",
    top: "calc(100% + 4px)",
    right: "0",
    background: COLORS.dropdownBg,
    border: `1px solid ${COLORS.dropdownBorder}`,
    borderRadius: "4px",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
    zIndex: "9999999",
    minWidth: "180px",
    maxHeight: "280px",
    overflowY: "auto",
    animation: "fadeIn 0.15s ease",
  });

  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #jira-ticket-status-dropdown-wrapper div::-webkit-scrollbar {
      width: 8px;
    }
    #jira-ticket-status-dropdown-wrapper div::-webkit-scrollbar-track {
      background: #F4F5F7;
    }
    #jira-ticket-status-dropdown-wrapper div::-webkit-scrollbar-thumb {
      background: #C1C7D0;
      border-radius: 4px;
    }
    #jira-ticket-status-dropdown-wrapper div::-webkit-scrollbar-thumb:hover {
      background: #A5ADBA;
    }
  `;
  document.head.appendChild(style);

  const defaultItem = document.createElement("div");
  defaultItem.textContent = "(Use page status)";
  setDropdownItemStyle(defaultItem, true);
  defaultItem.onclick = () => {
    selectedStatusRef.value = null;
    dropdownMenu.style.display = "none";
    onSelect();
  };
  dropdownMenu.appendChild(defaultItem);

  getStatusList().then((statusList) => {
    statusList.forEach((status) => {
      const item = document.createElement("div");
      item.textContent = status;
      setDropdownItemStyle(item);
      item.onclick = () => {
        selectedStatusRef.value = status;
        dropdownMenu.style.display = "none";
        onSelect();
      };
      dropdownMenu.appendChild(item);
    });
  });

  dropdownBtn.onclick = (e) => {
    e.stopPropagation();
    dropdownMenu.style.display = dropdownMenu.style.display === "none" ? "block" : "none";
  };

  document.addEventListener("click", () => {
    dropdownMenu.style.display = "none";
  });

  dropdownWrapper.appendChild(dropdownBtn);
  dropdownWrapper.appendChild(dropdownMenu);

  return dropdownWrapper;
}
