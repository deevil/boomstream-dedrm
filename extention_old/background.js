let state = null;

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
const setState = async (tabId, tabState) => {
  state[tabId] = tabState;
  await chrome.storage.session.set(state);
}

chrome.webNavigation.onCommitted.addListener(async (info) => { //todo replace tabs to website and activate automatically on websites
  state = await chrome.storage.local.get();
  if (!state[info.tabId]) {
    await setState(info.tabId, states.STOPPED);
  }

  if (state[info.tabId] === states.LISTEN) {
    // chrome.webRequest.onBeforeRequest.addListener(requestListener, {urls: [ '<all_urls>' ]}, []);
    chrome.webRequest.onBeforeSendHeaders.addListener(passRequestToTab, {urls: [ '<all_urls>' ]}, [ 'requestHeaders', 'extraHeaders' ]);
  }

  await chrome.action.setBadgeText({
    tabId: info.tabId,
    text: stateBadgeTexts[state[info.tabId]]
  });
});


const passRequestToTab = async (resp) => {
  if (resp.tabId === -1) {
    return;
  }

  const headers = resp.requestHeaders.reduce((prev, current) => {
    prev[current.name] = current.value;
    return prev;
  }, {});


  const response = await chrome.tabs.sendMessage(resp.tabId, {
    url: resp.url,
    headers
  });
  // do something with response here, not outside the function
  console.log(response);
}

chrome.action.onClicked.addListener(async (tab) => {

  // todo
  chrome.scripting.executeScript({
    target: {tabId: tab.id, allFrames: true},
    files: [
      'inject.js'
    ]
  });

  if (state[tab.id] === states.STOPPED) {
    await setState(tab.id, states.LISTEN);
    // chrome.webRequest.onBeforeRequest.addListener(requestListener, {urls: [ '<all_urls>' ]}, [])
    // chrome.webRequest.onBeforeSendHeaders.addListener(requestListener, {urls: [ '<all_urls>' ]}, [ 'requestHeaders', 'extraHeaders' ]);

    chrome.webRequest.onBeforeSendHeaders.addListener(passRequestToTab, {urls: [ '<all_urls>' ]}, [ 'requestHeaders', 'extraHeaders' ]);
  } else if (state[tab.id] === states.LISTEN) {
    await setState(tab.id, states.STOPPED);
    // chrome.webRequest.onBeforeRequest.removeListener(requestListener);
    // chrome.webRequest.onBeforeSendHeaders.removeListener(requestListener);
    chrome.webRequest.onBeforeSendHeaders.removeListener(passRequestToTab);
  }

  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: stateBadgeTexts[state[tab.id]]
  });
});

