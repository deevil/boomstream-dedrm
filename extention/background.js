import computeIV from './decryptor.js';
import semaphore from './semaphore.js';
import m3u8Parser from './vendor/m3u8Parser.js';

const xorKey = 'bla_bla_bla';
const sem = semaphore(1);


chrome.action.onClicked.addListener(async (tab) => {
  /*if (tab.url.startsWith(extensions) || tab.url.startsWith(webstore)) {
    // We retrieve the action badge to check if the extension is 'ON' or 'OFF'
    const prevState = await chrome.action.getBadgeText({ tabId: tab.id });
    // Next state will always be the opposite
    const nextState = prevState === 'ON' ? 'OFF' : 'ON';

    // Set the action badge to the next state
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: nextState
    });

    if (nextState === 'ON') {
      // Insert the CSS file when the user turns the extension on
      await chrome.scripting.insertCSS({
        files: ['focus-mode.css'],
        target: { tabId: tab.id }
      });
    } else if (nextState === 'OFF') {
      // Remove the CSS file when the user turns the extension off
      await chrome.scripting.removeCSS({
        files: ['focus-mode.css'],
        target: { tabId: tab.id }
      });
    }
  }*/

  let uri;
  let triedPlayLists = new Set();
  let playlists = new Map();
  let processedPlaylists = new Set();

  const triggerPlaylistObtainProcess = () => {
    if (!uri) {
      sem.leave();
      return
    }

    const unprocessedPlaylists = Array.from(playlists.keys()).filter(pl => !processedPlaylists.has(pl));

    for (const unprocessedPlaylist of unprocessedPlaylists) {
      const playListData = playlists.get(unprocessedPlaylist);
      let extMediaReady = playListData.substring(playListData.indexOf('#EXT-X-MEDIA-READY'));
      extMediaReady = extMediaReady.substring(0, extMediaReady.indexOf('\n')).replace('#EXT-X-MEDIA-READY:', '').trim();
      const IV = computeIV(extMediaReady, xorKey)
      processedPlaylists.add(unprocessedPlaylist);

      const processedPlayListData = playListData.replace('[KEY]', uri).replace('[IV]', `0x${ IV }`);
      const url = 'data:application/vnd.apple.mpegurl;base64,' + btoa(processedPlayListData);
      const filename = 'playlist.m3u8';
      const parsed = m3u8Parser(processedPlayListData, unprocessedPlaylist);
      console.log(parsed);

      // chrome.downloads.download({url, filename})
    }

    sem.leave();
  }

  chrome.webRequest.onBeforeRequest.addListener(
    async (resp) => {
      if (resp.url.includes('/process/')) {
        uri = resp.url;
        sem.take(triggerPlaylistObtainProcess.bind(this));
      }

      if (resp.url.includes('.m3u8') && !triedPlayLists.has(resp.url)) {
        const data = await fetch(resp.url);
        const playlistData = await data.text();
        triedPlayLists.add(resp.url);
        if (playlistData.includes('EXT-X-MEDIA-READY')) {
          playlists.set(resp.url, playlistData);
          sem.take(triggerPlaylistObtainProcess.bind(this))
        }
      }

    }, {urls: [ '<all_urls>' ]}, [])
});

