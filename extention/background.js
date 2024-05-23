import Semaphore from './semaphore.js';
import m3u8Parser from './vendor/m3u8Parser.js';
import decryptor from './decryptor.js';

const xorKey = 'bla_bla_bla';
const semRequest = new Semaphore(1);
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

const masterPlayListPerTab = new Map();
const processedMasterPlaylistsPerTab = new Map();
const processedMasterPlaylistVideoPerTab = new Map();

const setState = async (tabId, tabState) => {
  state[tabId] = tabState;
  await chrome.storage.session.set(state);
}

const safeRequest = async (url, triesLeft = 3)=>{
  if(triesLeft === 0){
    chrome.notifications.create('video-download-failed',
      {
        type: "basic",
        iconUrl: "images/icon-128.png",
        title: "Video download failed",
        message: "Video download failed, try to reload page",
      });
    throw new Error();
  }

  const resp = await fetch(url);
  if(resp.status > 401){
    console.log(`failed request with status ${resp.status}, retrying`);
    await new Promise(res=> setTimeout(res, Math.random() * 1000));
    return safeRequest(url, triesLeft - 1);
  }

  return resp;
}

const getBlobUrl = async (blob) => {
  const url = chrome.runtime.getURL('offscreen.html');
  try {
    await chrome.offscreen.createDocument({
      url,
      reasons: [ 'BLOBS' ],
      justification: 'MV3 requirement'
    });
  } catch (err) {
    if (!err.message.startsWith('Only a single offscreen')) throw err;
  }
  const client = (await clients.matchAll({includeUncontrolled: true}))
    .find(c => c.url === url);
  const mc = new MessageChannel();
  client.postMessage(blob, [ mc.port2 ]);
  const res = await new Promise(cb => (mc.port1.onmessage = cb));
  return res.data;
}

chrome.webNavigation.onCommitted.addListener(async (info) => {
  processedMasterPlaylistsPerTab.set(info.tabId, new Set());
  processedMasterPlaylistVideoPerTab.set(info.tabId, new Set());

  state = await chrome.storage.local.get();
  if (!state[info.tabId]) {
    await setState(info.tabId, states.STOPPED);
  }

  if (state[info.tabId] === states.LISTEN) {
    chrome.webRequest.onBeforeRequest.addListener(requestListener, {urls: [ '<all_urls>' ]}, []);
  }

  await chrome.action.setBadgeText({
    tabId: info.tabId,
    text: stateBadgeTexts[state[info.tabId]]
  });
});

const triggerPlaylistObtainProcess = async (tabId, processUrl) => {
  const processedMasterPlaylists = processedMasterPlaylistsPerTab.get(tabId);
  const processedMasterPlaylistVideo = processedMasterPlaylistVideoPerTab.get(tabId);
  const masterPlaylist = masterPlayListPerTab.get(tabId);

  if (state[tabId] === states.STOPPED || processedMasterPlaylistVideo.has(masterPlaylist.url) || !masterPlaylist || !masterPlaylist.url) {
    return;
  }

  const masterPlayListMetaData = m3u8Parser(masterPlaylist.data, masterPlaylist.url);
  const maxLevel = masterPlayListMetaData.levels.sort((a, b) => b.bandwidth - a.bandwidth)[0];
  const responsePlaylist = await safeRequest(maxLevel.url);
  const playListWithMaxResolutionData = await responsePlaylist.text();

  let extMediaReady = playListWithMaxResolutionData.substring(playListWithMaxResolutionData.indexOf('#EXT-X-MEDIA-READY'));
  extMediaReady = extMediaReady.substring(0, extMediaReady.indexOf('\n')).replace('#EXT-X-MEDIA-READY:', '').trim();
  const IV = decryptor.computeIV(extMediaReady, xorKey)
  const processedPlayListData = playListWithMaxResolutionData.replace('[KEY]', processUrl).replace('[IV]', `0x${ IV }`);


  const tab = await chrome.tabs.get(tabId);
  const safeTitleName = tab.title.trim().replaceAll(/[\/:\*\?"<>\|]/g, '');

  if(!processedMasterPlaylists.has(masterPlaylist.url)) {
    const playlistUrl = `data:application/vnd.apple.mpegurl;base64,${ btoa(processedPlayListData) }`;
    const playlistFilename = `${ safeTitleName }.m3u8`;
    chrome.downloads.download({
      url: playlistUrl,
      filename: playlistFilename
    });
    processedMasterPlaylists.add(masterPlaylist.url);
  }

  const playlist = m3u8Parser(processedPlayListData, maxLevel.url);
  const playlistKeyData = playlist.key[0];
  const keyResponse = await safeRequest(playlistKeyData.uri);
  const key = await keyResponse.text();
  const filesData = [];

  for (const segment of playlist.segments) {
    console.log(`processing segment ${ segment.sn } [${ Math.round(segment.sn / playlist.segments.length * 100) }]`);

    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: `${ Math.round(segment.sn / playlist.segments.length * 100) }%`
    });


    const r = await safeRequest(segment.url);
    const buffer = await r.arrayBuffer();
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key).buffer, {
      name: 'AES-CBC',
      length: 128
    }, false, [ 'decrypt' ])

    const ivBuffer = new Uint8Array(playlistKeyData.iv.substring(2).match(/[\da-f]{2}/gi).map(function (h) {
      return parseInt(h, 16)
    }));

    const decrypted = await decryptor.decryptAes(buffer, cryptoKey, ivBuffer.buffer);
    filesData.push(decrypted);
  }

  console.log('processed!')

  const videoBlob = await new Blob(filesData, {type: 'application/octet-stream'});
  const videoFilename = `${ safeTitleName }.ts`;

  const videoBlobUrl = await getBlobUrl(videoBlob);
  chrome.downloads.download({url: videoBlobUrl, filename: videoFilename});

  processedMasterPlaylistVideo.add(masterPlaylist.url);
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: stateBadgeTexts[states.LISTEN]
  });
}

const requestListener = async (resp) => {
  await semRequest.acquire();

  if (resp.tabId === -1) {
    await semRequest.release();
    return;
  }

  try {
    if (resp.url.includes('/process/') && masterPlayListPerTab.has(resp.tabId)) {
      await triggerPlaylistObtainProcess(resp.tabId, resp.url);
    }

    const ext = resp.url.split('?')[0].split('#')[0].split('.').pop();

    if (ext === 'm3u8') {
      const data = await safeRequest(resp.url);
      const playlistData = await data.text();
      if (playlistData.includes('EXT-X-STREAM-INF')) {
        masterPlayListPerTab.set(resp.tabId, {
          url: resp.url,
          data: playlistData
        });
      }
    }

  } catch (e) {
    console.log(e)
    console.log(e.stack);
    await chrome.action.setBadgeText({
      tabId: resp.tabId,
      text: stateBadgeTexts[state[resp.tabId]]
    });
  }

  await semRequest.release();
}

chrome.action.onClicked.addListener(async (tab) => {

  if (state[tab.id] === states.STOPPED) {
    await setState(tab.id, states.LISTEN);
    chrome.webRequest.onBeforeRequest.addListener(requestListener, {urls: [ '<all_urls>' ]}, []);

  } else if (state[tab.id] === states.LISTEN) {
    await setState(tab.id, states.STOPPED);
    chrome.webRequest.onBeforeRequest.removeListener(requestListener);
  }

  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: stateBadgeTexts[state[tab.id]]
  });
});

