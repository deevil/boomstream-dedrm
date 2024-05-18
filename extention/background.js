const xorKey = 'bla_bla_bla';
const decrypt = (source_text, key) => {
  let result = '';
  while (key.length < source_text.length) {
    key += key;
  }

  for (let n = 0; n < source_text.length; n += 2) {
    let c = parseInt(source_text.slice(n, n + 2), 16) ^ key.charCodeAt(Math.floor(n / 2));
    result += String.fromCharCode(c);
  }

  return result;
}

const computeIV = (extMediaReady, xorKey)=>{
  const decrypted = decrypt(extMediaReady, xorKey)

  let computedIV = '';
  for (let i = 20; i < 36; i++) {
    computedIV += ('0' + decrypted[i].charCodeAt(0).toString(16)).slice(-2);
  }
  return computedIV;
}

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

  const triggerPlaylistObtainProcess = ()=>{
    if(!uri){
      return
    }

    const unprocessedPlaylists = Array.from(playlists.keys()).filter(pl=> !processedPlaylists.has(pl));

    for(const unprocessedPlaylist of unprocessedPlaylists){
      const playListData = playlists.get(unprocessedPlaylist);
      let extMediaReady = playListData.substring(playListData.indexOf('#EXT-X-MEDIA-READY'));
      extMediaReady = extMediaReady.substring(0, extMediaReady.indexOf('\n')).replace('#EXT-X-MEDIA-READY:', '').trim();
      const IV = computeIV(extMediaReady, xorKey)
      processedPlaylists.add(unprocessedPlaylist);

      const processedPlayListData = playListData.replace('[KEY]', uri).replace('[IV]', `0x${IV}`);
     // const url = `data:text/plain,${processedPlayListData}`;
      const filename = 'playlist.m3u8';
     // chrome.downloads.download({url, filename});

      chrome.downloads.download({url: 'data:application/vnd.apple.mpegurl;base64,' + btoa(processedPlayListData), filename})


    }
  }

  chrome.webRequest.onBeforeRequest.addListener(
    async (resp) => {
      if (resp.url.includes('/process/')) {
        uri = resp.url;
        triggerPlaylistObtainProcess()
      }

      if (resp.url.includes('.m3u8') && !triedPlayLists.has(resp.url)) {
        const data = await fetch(resp.url);
        const playlistData = await data.text();
        triedPlayLists.add(resp.url);
        if(playlistData.includes('EXT-X-MEDIA-READY')){
          playlists.set(resp.url, playlistData);
          console.log('found playlist');
          triggerPlaylistObtainProcess();
        }
      }

    }, {urls: [ '<all_urls>' ]}, [])
});




