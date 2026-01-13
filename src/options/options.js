document.addEventListener("DOMContentLoaded", () => {
  const commitFormatInput = document.getElementById("commitFormat");
  const ticketInfoFormatInput = document.getElementById("ticketInfoFormat");
  const linkFormatInput = document.getElementById("linkFormat");
  const enableListViewInput = document.getElementById("enableListView");
  const status = document.getElementById("status");
  const form = document.getElementById("optionsForm");

  // Load saved formats
  function loadOptions() {
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        ["commitFormat", "ticketInfoFormat", "linkFormat", "enableListView"],
        (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error("Error loading formats:", chrome.runtime.lastError);
            status.textContent = "Error loading settings";
            return;
          }
          commitFormatInput.value = result.commitFormat || "";
          ticketInfoFormatInput.value = result.ticketInfoFormat || "";
          linkFormatInput.value = result.linkFormat || "";
          enableListViewInput.checked = result.enableListView !== false;
        }
      );
    } else {
      console.error("chrome.storage.sync is not available");
      status.textContent = "Storage unavailable";
    }
  }

  // Save handler
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const commitFormat = commitFormatInput.value.trim();
    const ticketInfoFormat = ticketInfoFormatInput.value.trim();
    const linkFormat = linkFormatInput.value.trim();
    const enableListView = enableListViewInput.checked;
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ commitFormat, ticketInfoFormat, linkFormat, enableListView }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error("Error saving formats:", chrome.runtime.lastError);
          status.textContent = "Error saving!";
          return;
        }
        status.textContent = "Saved!";
        setTimeout(() => (status.textContent = ""), 1500);
      });
    } else {
      console.error("chrome.storage.sync is not available");
      status.textContent = "Storage unavailable";
    }
  });

  loadOptions();
});
