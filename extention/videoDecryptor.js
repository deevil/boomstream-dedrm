const decrypt = async (ciphertext, key, iv) => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv
    },
    key,
    ciphertext
  );

  // return decrypted;
  const extra = decrypted.length % 16;
  return extra > 0 ? decrypted.slice(1, decrypted.length-extra) : decrypted.slice(1);
}

export default decrypt;