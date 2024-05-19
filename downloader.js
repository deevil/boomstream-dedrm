import m3u8Parser from './extention/vendor/m3u8Parser.js';
import fs from 'fs';
import crypto from 'crypto';

function translate(algo) {
  switch (algo) {
    case 'AES-128': return 'AES-128-CBC';
    default: return algo;
  }
}

const decrypt = (buffer, algo, key, iv) => {
  const decipher = crypto.createDecipheriv(translate(algo), key, iv);
  decipher.setAutoPadding(true);
  const result = Buffer.concat([decipher.update(buffer), decipher.final()]);
  const extra = result.length % 16;
  return extra > 0 ? result.slice(1, result.length-extra) : result.slice(1);
}

const init = async () => {

  const url = '';
  const data = ``;
  const playlist = m3u8Parser(data, url);
  console.log(playlist)

  const playlistKeyData = playlist.key[0];
  const keyResponse = await fetch(playlistKeyData.uri);
  const key = await keyResponse.text();
  console.log('key', key);

  console.log(playlist.segments[0])
  // const files = [];

  for(const segment of playlist.segments){
    console.log(`processing segment ${segment.sn}`);
    const r = await fetch(segment.url);
    const buffer = await r.arrayBuffer();
    const decryptedBuffer = decrypt(Buffer.from(buffer), playlistKeyData.method, key, Buffer.from(playlistKeyData.iv.substring(2), 'hex'));
    fs.appendFileSync('./result.mp4', decryptedBuffer);
  }

  console.log('processed!')

/*
  const finalBlob = await new Blob(acc).arrayBuffer();
  fs.writeFileSync('test.ts', Buffer.from(finalBlob));*/

}

export default init();