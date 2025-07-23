document.addEventListener("DOMContentLoaded", () => {
  const commitFormatInput = document.getElementById("commitFormat");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  // Load saved format
  chrome.storage.sync.get(["commitFormat"], (result) => {
    if (result.commitFormat) {
      commitFormatInput.value = result.commitFormat;
    }
  });

  saveBtn.addEventListener("click", () => {
    const format = commitFormatInput.value.trim();
    chrome.storage.sync.set({ commitFormat: format }, () => {
      status.textContent = "Saved!";
      setTimeout(() => (status.textContent = ""), 1500);
    });
  });
});
