document.addEventListener("DOMContentLoaded", () => {
  const commitFormatInput = document.getElementById("commitFormat");
  const ticketInfoFormatInput = document.getElementById("ticketInfoFormat");
  const status = document.getElementById("status");
  const form = document.getElementById("optionsForm");

  // Load saved formats
  function loadOptions() {
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        ["commitFormat", "ticketInfoFormat"],
        (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.error("Error loading formats:", chrome.runtime.lastError);
            status.textContent = "Error loading settings";
            return;
          }
          commitFormatInput.value = result.commitFormat || "";
          ticketInfoFormatInput.value = result.ticketInfoFormat || "";
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
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ commitFormat, ticketInfoFormat }, () => {
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
