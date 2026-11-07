import { createHash, timingSafeEqual } from 'node:crypto';

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin) {
    try {
      if (new URL(origin).host !== host) return response.status(403).json({ error: 'Forbidden' });
    } catch { return response.status(403).json({ error: 'Forbidden' }); }
  }
  const code = request.body?.code;
  const configured = process.env.AGAZATY_MANAGER_CODE;
  if (!configured || !/^[0-9]{4}$/.test(configured)) return response.status(503).json({ error: 'Unavailable' });
  if (typeof code !== 'string' || !/^[0-9]{4}$/.test(code)) return response.status(400).json({ error: 'Invalid code' });
  const actual = createHash('sha256').update(configured).digest();
  const submitted = createHash('sha256').update(code).digest();
  return response.status(200).json({ manager: timingSafeEqual(actual, submitted) });
}
