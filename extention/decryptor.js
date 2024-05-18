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




export default computeIV;
