import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

const UI_PORT = '4322';
const API_PORT = '4323';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const ALLOWED_ORIGINS = new Set([
  `http://127.0.0.1:${UI_PORT}`,
  `http://localhost:${UI_PORT}`,
  `http://[::1]:${UI_PORT}`,
]);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseHost(header: string): { name: string; port: string } | null {
  const host = header.trim().toLowerCase();
  if (!host) return null;
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end < 0 || host[end + 1] !== ':') return null;
    return { name: host.slice(1, end), port: host.slice(end + 2) };
  }
  const colon = host.lastIndexOf(':');
  if (colon < 0) return null;
  return { name: host.slice(0, colon), port: host.slice(colon + 1) };
}

function isAllowedHost(header: string): boolean {
  const parsed = parseHost(header);
  if (!parsed) return false;
  return LOOPBACK.has(parsed.name) && (parsed.port === UI_PORT || parsed.port === API_PORT);
}

/**
 * Every request, including reads. A tab on another origin must not be able
 * to enumerate drafts, even if it cannot mutate them.
 *
 * Host must be loopback on the CMS UI (4322, Vite proxy) or the API (4323).
 * The proxy keeps the browser Host unless changeOrigin rewrites it.
 */
export function assertLocalRequest(context: Context): void {
  const host = context.req.header('host') ?? '';
  if (!isAllowedHost(host)) {
    throw new HTTPException(403, { message: `Refusing host "${host}".` });
  }

  if (!MUTATING.has(context.req.method)) return;

  const origin = context.req.header('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    throw new HTTPException(403, { message: 'Origin is not the CMS UI.' });
  }

  const site = context.req.header('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
    throw new HTTPException(403, { message: 'Cross-site request blocked.' });
  }

  const type = context.req.header('content-type') ?? '';
  const isMultipart = type.startsWith('multipart/form-data');
  const isJson = type.startsWith('application/json');
  if (!isJson && !isMultipart) {
    throw new HTTPException(415, { message: 'Mutations must be JSON or multipart.' });
  }
}
