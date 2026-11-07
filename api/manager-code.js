import { createHash, timingSafeEqual } from 'node:crypto';

// In-memory rate limiting per client IP (resets on instance restart)
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout

function checkRateLimit(ip) {
  const now = Date.now();
  // Clean up expired entries periodically
  if (attempts.size > 1000) {
    for (const [key, val] of attempts.entries()) {
      if (val.resetAt < now) attempts.delete(key);
    }
  }
  const record = attempts.get(ip);
  if (!record || record.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetInSeconds: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count += 1;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count };
}

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

  const ip = (request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    response.setHeader('Retry-After', limit.resetInSeconds);
    return response.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const code = request.body?.code;
  const configured = process.env.AGAZATY_MANAGER_CODE;
  if (!configured || !/^[0-9]{4}$/.test(configured)) return response.status(503).json({ error: 'Unavailable' });
  if (typeof code !== 'string' || !/^[0-9]{4}$/.test(code)) return response.status(400).json({ error: 'Invalid code' });
  
  const actual = createHash('sha256').update(configured).digest();
  const submitted = createHash('sha256').update(code).digest();
  const isMatch = timingSafeEqual(actual, submitted);
  
  // If correct code, reset the attempt counter for this IP
  if (isMatch) {
    attempts.delete(ip);
  }

  return response.status(200).json({ manager: isMatch });
}
