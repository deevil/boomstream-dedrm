import safeRequest from './safeRequest.js';
import triggerPlaylistObtainProcess from './obtainPlaylist.js';

let masterPlaylist = null;

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log(request);

  if (request.url.includes('/process/') && masterPlaylist) {
    await triggerPlaylistObtainProcess(request.url, request.headers, masterPlaylist);
    masterPlaylist = null;
  }

  const ext = request.url.split('?')[0].split('#')[0].split('.').pop();

  if (ext === 'm3u8') {
    const data = await safeRequest(request.url, request.headers);
    const playlistData = await data.text();
    if (playlistData.includes('EXT-X-STREAM-INF')) {
      masterPlaylist = {
        url: request.url,
        data: playlistData
      };
    }
  }












  sendResponse({}); // call after request processed


/*    console.log(sender.tab ?
      "from a content script:" + sender.tab.url :
      "from the extension");
    if (request.greeting === "hello")
      sendResponse({farewell: "goodbye"});*/


    // todo trigger on web request




});