import safeRequest from './safeRequest';
import triggerPlaylistObtainProcess from './obtainPlaylist';
import Semaphore from './vendor/semaphore';

declare const chrome: any;


let masterPlaylist = null;
const sem = new Semaphore(1);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  await sem.acquire();
  console.log(request);

  if (request.url.includes('/process/') && masterPlaylist) {
    await triggerPlaylistObtainProcess(request.url, request.headers, masterPlaylist);
    masterPlaylist = null;
  }

  const ext = request.url.split('?')[0].split('#')[0].split('.').pop();

  if (ext === 'm3u8' && !masterPlaylist) { // todo if its chunk and not playlist, then will loop forever
    const data = await safeRequest(request.url, request.headers);
    const playlistData = await data.text();
    if (playlistData.includes('EXT-X-STREAM-INF')) {
      masterPlaylist = {
        url: request.url,
        data: playlistData
      };
    }
  }

  await sem.release();

  sendResponse({}); // call after request processed


  /*    console.log(sender.tab ?
        "from a content script:" + sender.tab.url :
        "from the extension");
      if (request.greeting === "hello")
        sendResponse({farewell: "goodbye"});*/


  // todo trigger on web request




});