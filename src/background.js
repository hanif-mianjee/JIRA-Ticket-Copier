chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "dist/welcome/welcome.html"
    });
  } else if (details.reason === "update") {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    
    if (previousVersion !== currentVersion) {
      chrome.tabs.create({
        url: "dist/welcome/welcome.html"
      });
    }
  }
});
