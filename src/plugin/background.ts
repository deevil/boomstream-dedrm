import Semaphore from '../browser/vendor/semaphore';

declare const chrome: any;

const states = {
  STOPPED: 0,
  LISTEN: 1,
  ERR: 2
};
const stateBadgeTexts = {
  [states.STOPPED]: 'OFF',
  [states.LISTEN]: 'ON',
  [states.ERR]: 'ERR'
}

let pluginState: {
  trackedWebsites: { [key: string]: number }
} = null;

const statePerTab: Map<string, {
  semaphore: Semaphore,
  processedUrls: Set<string>
}> = new Map();


const setBadgeForWebsiteByTab = async(tab)=>{
  const website = new URL(tab.url).origin;
  const tabsForTheWebsite = (await chrome.tabs.query({}))
    .filter(foundTab => {
      const foundTabWebsite = new URL(foundTab.url).origin;
      return foundTabWebsite === website;
    });

  for (const foundTab of tabsForTheWebsite) {
    await chrome.action.setBadgeText({
      tabId: foundTab.id,
      text: stateBadgeTexts[pluginState.trackedWebsites[website] ? states.LISTEN: states.STOPPED]
    });
  }
}


chrome.webNavigation.onCommitted.addListener(async (info) => { //todo replace tabs to website and activate automatically on websites
  pluginState = await chrome.storage.local.get();
  if (!pluginState?.trackedWebsites) {
    pluginState = {
      trackedWebsites: {}
    }
    await chrome.storage.session.set(pluginState);
  }

  const website = new URL(info.url)?.origin;

  if (website && pluginState.trackedWebsites[website]) {
  }

  chrome.webRequest.onBeforeSendHeaders.addListener(passRequestToTab, { urls: ['<all_urls>'] }, ['requestHeaders', 'extraHeaders']);

  statePerTab.set(info.tabId, {
    semaphore: new Semaphore(1),
    processedUrls: new Set()
  });

  await setBadgeForWebsiteByTab(info);
});


const passRequestToTab = async (resp) => {
  if (resp.tabId === -1) {
    return;
  }

  // const semaphore = semaphorePerTab.get(resp.tabId); //todo

  const ext = resp.url.split('?')[0].split('#')[0].split('.').pop();
  if (!resp.url.includes('/process/') && ext !== 'm3u8') {
    return;
  }

  /*  if (processedRequestsUrls.has(resp.url)) { // should be per each tab //todo
      return;
    }

    //processedRequestsUrls.add(resp.url);*/

  const headers = resp.requestHeaders.reduce((prev, current) => {
    prev[current.name] = current.value;
    return prev;
  }, {});


  const response = await chrome.tabs.sendMessage(resp.tabId, {
    url: resp.url,
    headers
  });
  // do something with response here, not outside the function
}

chrome.action.onClicked.addListener(async (tab) => {
  const website = new URL(tab.url).origin;
  const tabsForTheWebsite = (await chrome.tabs.query({}))
    .filter(foundTab => {
      const foundTabWebsite = new URL(foundTab.url).origin;
      return foundTabWebsite === website;
    });

  if (!pluginState[website]) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      files: [
        'inject.js'
      ]
    });

    pluginState.trackedWebsites[website] = 1;
    await chrome.storage.session.set(pluginState);
  } else {
    delete pluginState.trackedWebsites[website];
    await chrome.storage.session.set(pluginState);

    for (const foundTab of tabsForTheWebsite) {
      chrome.tabs.reload(foundTab.id);
    }
  }

  await setBadgeForWebsiteByTab(tab);
});

