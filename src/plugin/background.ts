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

let pluginState: { [key: string]: number } = null;

const statePerTab: Map<string, {
  semaphore: Semaphore,
  processedUrls: Set<string>,
  isOnTrack: boolean
}> = new Map();

const setBadgeForWebsiteByTab = async (tab) => {
  const website = new URL(tab.url).origin;
  const tabsForTheWebsite = (await chrome.tabs.query({}))
    .filter(foundTab => {
      const foundTabWebsite = new URL(foundTab.url).origin;
      return foundTabWebsite === website;
    });

  for (const foundTab of tabsForTheWebsite) {
    await chrome.action.setBadgeText({
      tabId: foundTab.id,
      text: stateBadgeTexts[pluginState[website] ? states.LISTEN : states.STOPPED]
    });
  }
}

const injectScriptIntoTab = async (tab)=>{
  // todo check that script has already been injected or not


  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false },
    files: [
      'inject.js'
    ]
  });
}

chrome.webNavigation.onCommitted.addListener(async (info) => {
  pluginState = await chrome.storage.session.get();
  if (!pluginState) {
    pluginState = {}
    await chrome.storage.session.set(pluginState);
  }

  const tab = await chrome.tabs.get(info.tabId);
  const website = new URL(tab.url)?.origin;

  statePerTab.set(info.tabId, {
    semaphore: new Semaphore(1),
    processedUrls: new Set(),
    isOnTrack: !!(website && pluginState[website])
  });

  if(statePerTab.get(info.tabId).isOnTrack && info.frameId === 0){
    await injectScriptIntoTab(tab);
  }

  await setBadgeForWebsiteByTab(info);
});

chrome.action.onClicked.addListener(async (tab) => {
  const website = new URL(tab.url).origin;
  const tabsForTheWebsite = (await chrome.tabs.query({}))
    .filter(foundTab => {
      const foundTabWebsite = new URL(foundTab.url).origin;
      return foundTabWebsite === website;
    });

  if (!pluginState[website]) {
    await injectScriptIntoTab(tab);
    pluginState[website] = 1;
    await chrome.storage.session.set(pluginState);
  } else {
    delete pluginState[website];
    await chrome.storage.session.set(pluginState);

    for (const foundTab of tabsForTheWebsite) {
      chrome.tabs.reload(foundTab.id);
    }
  }

  await setBadgeForWebsiteByTab(tab);
});

chrome.webRequest.onBeforeSendHeaders.addListener(async (request) => {
  if (request.tabId === -1 || !statePerTab.get(request.tabId)?.isOnTrack) {
    return;
  }

  const tabState = statePerTab.get(request.tabId);
  const ext = request.url.split('?')[0].split('#')[0].split('.').pop();
  if ((!request.url.includes('/process/') && ext !== 'm3u8') || tabState.processedUrls.has(request.url)) {
    return;
  }

  tabState.processedUrls.add(request.url);
  await tabState.semaphore.acquire();


  const headers = request.requestHeaders.reduce((prev, current) => {
    prev[current.name] = current.value;
    return prev;
  }, {});


  const response = await chrome.tabs.sendMessage(request.tabId, {
    url: request.url,
    headers
  });

  await tabState.semaphore.release();
  // do something with response here, not outside the function
}, { urls: ['<all_urls>'] }, ['requestHeaders', 'extraHeaders']);
