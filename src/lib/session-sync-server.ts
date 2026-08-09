import https from 'node:https';

const KEEP_ALIVE_URL = 'https://telebeat.ethiotelecom.et/superBrainGameApi/my/userTimes';
const JSESSIONID = '9DC6DB74962ABD711493663355218410';
const REQUEST_TIMEOUT_MS = 10_000;

export interface KeepAliveResult {
  response: unknown;
  httpStatus: number;
  error?: string;
}

/** Same as session-up.py: verify=False for Telebirr TLS. */
function telebeatGet(
  url: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer | string) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });

    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
    });
  });
}

export async function sendSessionKeepAlive(token: string): Promise<KeepAliveResult> {
  const tokenPreview = token ? `${token.slice(0, 12)}…` : '(empty)';
  console.log(`[session-sync] keep-alive request token=${tokenPreview}`);

  try {
    const { status, body } = await telebeatGet(KEEP_ALIVE_URL, {
      'User-Agent': 'Mozilla/5.0',
      Accept: '*/*',
      token,
      Referer: 'https://telebeat.ethiotelecom.et/',
      Cookie: `JSESSIONID=${JSESSIONID}`,
    });

    console.log(`[session-sync] keep-alive status=${status} body=${body.slice(0, 200)}`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = { raw: body.trim().replace(/\n/g, ' ').slice(0, 120) };
    }

    return { httpStatus: status, response: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint =
      message === 'fetch failed' || message.includes('certificate')
        ? `${message} (TLS — using insecure HTTPS like session-up.py)`
        : message;
    console.error(`[session-sync] keep-alive failed token=${tokenPreview} error=${hint}`);
    return { httpStatus: 0, response: { error: hint }, error: hint };
  }
}
