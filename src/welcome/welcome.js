document.addEventListener("DOMContentLoaded", () => {
  const versionSpan = document.getElementById("version");
  const openSettingsBtn = document.getElementById("openSettings");
  const openSettingsFooterBtn = document.getElementById("openSettingsFooter");

  if (chrome && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (versionSpan) {
      versionSpan.textContent = manifest.version;
    }
  }

  function openOptions() {
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("dist/options/options.html"));
    }
  }

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", openOptions);
  }

  if (openSettingsFooterBtn) {
    openSettingsFooterBtn.addEventListener("click", openOptions);
  }
});
