chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.tabs.create({
            url: "https://maxim100000.github.io/bookmark-path-extension/"
        });
    }
});