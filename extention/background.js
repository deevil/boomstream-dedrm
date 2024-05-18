import computeIV from './decryptor.js';
import Semaphore from './semaphore.js';
import m3u8Parser from './vendor/m3u8Parser.js';

const xorKey = 'bla_bla_bla';
const sem = new Semaphore(1);


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

  //current uri and masterPlaylists (last seen via requests)
  let uri;
  let masterPlayList = {
    url: null,
    data: null
  };

  let obtainedPlaylists = new Set();
  let processedMasterPlaylists = new Set();

  const triggerPlaylistObtainProcess = async (uriLocal, masterPlayListLocalUrl, masterPlayListLocalData) => {

    await sem.acquire();

    if (!uriLocal || !masterPlayListLocalUrl || processedMasterPlaylists.has(masterPlayList)) {
      await sem.release();
      return
    }

    console.log('inside!')
    console.log(uriLocal, masterPlayListLocalUrl)

    const masterPlayListMetaData = m3u8Parser(masterPlayListLocalData, masterPlayListLocalUrl);
    const maxLevel = masterPlayListMetaData.levels.sort((a, b) => b.bandwidth - a.bandwidth)[0];
    const responsePlaylist = await fetch(maxLevel.url);
    const playListWithMaxResolutionData = await responsePlaylist.text();

    let extMediaReady = playListWithMaxResolutionData.substring(playListWithMaxResolutionData.indexOf('#EXT-X-MEDIA-READY'));
    extMediaReady = extMediaReady.substring(0, extMediaReady.indexOf('\n')).replace('#EXT-X-MEDIA-READY:', '').trim();
    const IV = computeIV(extMediaReady, xorKey)
    const processedPlayListData = playListWithMaxResolutionData.replace('[KEY]', uri).replace('[IV]', `0x${ IV }`);

    console.log(processedPlayListData)
    const url = 'data:application/vnd.apple.mpegurl;base64,' + btoa(processedPlayListData);
    const filename = 'playlist.m3u8';
    // chrome.downloads.download({url, filename})

    processedMasterPlaylists.add(masterPlayList);
    await sem.release();
  }

  chrome.webRequest.onBeforeRequest.addListener(
    async (resp) => {
      if (resp.url.includes('/process/')) {
        uri = resp.url;
        await triggerPlaylistObtainProcess(uri, masterPlayList.url, masterPlayList.data);
      }

      const ext = resp.url.split('?')[0].split('#')[0].split('.').pop();
     // console.log(resp.url, ext, ext === 'm3u8');
      if (ext === 'm3u8' && !obtainedPlaylists.has(resp.url)) {
        const data = await fetch(resp.url);
        const playlistData = await data.text();
        obtainedPlaylists.add(resp.url);
        if (playlistData.includes('EXT-X-STREAM-INF')) {
          masterPlayList = {
            url: resp.url,
            data: playlistData
          };
          await triggerPlaylistObtainProcess(uri, masterPlayList.url, masterPlayList.data);
        }
      }

    }, {urls: [ '<all_urls>' ]}, [])
});

