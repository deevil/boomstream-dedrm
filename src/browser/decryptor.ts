const decryptXor = (sourceText: string, key: string) => {
  let result = '';
  while (key.length < sourceText.length) {
    key += key;
  }

  for (let n = 0; n < sourceText.length; n += 2) {
    const c = parseInt(sourceText.slice(n, n + 2), 16) ^ key.charCodeAt(Math.floor(n / 2));
    result += String.fromCharCode(c);
  }

  return result;
};

const computeIV = (extMediaReady: string, xorKey: string)=>{
  const decrypted = decryptXor(extMediaReady, xorKey);

  let computedIV = '';
  for (let i = 20; i < 36; i++) {
    computedIV += ('0' + decrypted[i].charCodeAt(0).toString(16)).slice(-2);
  }
  return computedIV;
};

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
  return extra > 0 ? decrypted.slice(1, decrypted.length - extra) : decrypted.slice(1);
};


export default {
  decryptXor,
  computeIV,
  decryptAes
};
