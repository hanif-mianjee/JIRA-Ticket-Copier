document.addEventListener("DOMContentLoaded", () => {
  const commitFormatInput = document.getElementById("commitFormat");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  // Load saved format
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(["commitFormat"], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.error("Error loading commitFormat:", chrome.runtime.lastError);
        status.textContent = "Error loading settings";
        return;
      }
      if (result.commitFormat) {
        commitFormatInput.value = result.commitFormat;
        console.log("Loaded commitFormat:", result.commitFormat);
      } else {
        console.log("No commitFormat found, using default");
      }
    });
  } else {
    console.error("chrome.storage.sync is not available");
    status.textContent = "Storage unavailable";
  }

  saveBtn.addEventListener("click", () => {
    const format = commitFormatInput.value.trim();
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ commitFormat: format }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error("Error saving commitFormat:", chrome.runtime.lastError);
          status.textContent = "Error saving!";
          return;
        }
        status.textContent = "Saved!";
        console.log("Saved commitFormat:", format);
        setTimeout(() => (status.textContent = ""), 1500);
      });
    } else {
      console.error("chrome.storage.sync is not available");
      status.textContent = "Storage unavailable";
    }
  });
});
