import m3u8Parser from './vendor/m3u8Parser.js';
import decryptor from './decryptor.js';
import safeRequest from './safeRequest.js';

const xorKey = 'bla_bla_bla';

function downloadBlob(blob, name) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = name;
  document.body.appendChild(link);

  link.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    })
  );

  document.body.removeChild(link);
}


const triggerPlaylistObtainProcess = async (processUrl, headers, masterPlaylist) => {
  const masterPlayListMetaData = m3u8Parser(masterPlaylist.data, masterPlaylist.url);
  const maxLevel = masterPlayListMetaData.levels.sort((a, b) => b.bandwidth - a.bandwidth)[0];
  const responsePlaylist = await safeRequest(maxLevel.url, headers);
  const playListWithMaxResolutionData = await responsePlaylist.text();

  let extMediaReady = playListWithMaxResolutionData.substring(playListWithMaxResolutionData.indexOf('#EXT-X-MEDIA-READY'));
  extMediaReady = extMediaReady.substring(0, extMediaReady.indexOf('\n')).replace('#EXT-X-MEDIA-READY:', '').trim();
  const IV = decryptor.computeIV(extMediaReady, xorKey)
  const processedPlayListData = playListWithMaxResolutionData.replace('[KEY]', processUrl).replace('[IV]', `0x${ IV }`);

  const safeTitleName = document.title.trim().replaceAll(/[\/:\*\?"<>\|]/g, '');
  const playlistBlob = await new Blob(processedPlayListData, {type: 'application/vnd.apple.mpegurl'});
  const playlistFilename = `${ safeTitleName }.m3u8`;
  downloadBlob(playlistBlob, playlistFilename);

  const playlist = m3u8Parser(processedPlayListData, maxLevel.url);
  const playlistKeyData = playlist.key[0];
  const keyResponse = await safeRequest(playlistKeyData.uri, headers);
  const key = await keyResponse.text();
  const filesData = [];

  for (const segment of playlist.segments) {
    console.log(`processing segment ${ segment.sn } [${ Math.round(segment.sn / playlist.segments.length * 100) }]`);

/*    await chrome.action.setBadgeText({ //todo write smth about the progress on current tab
      tabId: tab.id,
      text: `${ Math.round(segment.sn / playlist.segments.length * 100) }%`
    });*/


    const r = await safeRequest(segment.url, headers);
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

  downloadBlob(videoBlob, videoFilename);
}

export default triggerPlaylistObtainProcess

