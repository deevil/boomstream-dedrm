const decryptXor = (source_text, key) => {
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
  const decrypted = decryptXor(extMediaReady, xorKey)

  let computedIV = '';
  for (let i = 20; i < 36; i++) {
    computedIV += ('0' + decrypted[i].charCodeAt(0).toString(16)).slice(-2);
  }
  return computedIV;
}

const decryptAes = async (ciphertext, key, iv) => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv
    },
    key,
    ciphertext
  ) as any;

  // return decrypted;
  const extra = decrypted.length % 16;
  return extra > 0 ? decrypted.slice(1, decrypted.length-extra) : decrypted.slice(1);
}


export default {
  decryptXor,
  computeIV,
  decryptAes
};
