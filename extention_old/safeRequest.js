
export class SafeRequestError extends Error {}

const safeRequest = async (url, headers = {}, triesLeft = 10) => {
  if (triesLeft === 0) {
    throw new SafeRequestError();
  }

  const resp = await fetch(url, {
    method: 'GET',
    headers,
    referrerPolicy: 'unsafe-url'
  });
  if (resp.status > 401) {
    console.log(`failed request ${ url } with status ${ resp.status }, retrying`);
    await new Promise(res => setTimeout(res, Math.random() * 60000));
    return safeRequest(url, headers, triesLeft - 1);
  }

  return resp;
}

export default safeRequest;