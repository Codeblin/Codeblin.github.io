import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

const ALLOWED_HOSTS = new Set(['127.0.0.1:4323', 'localhost:4323']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Every request, including reads. A tab on another origin must not be able
 * to enumerate drafts, even if it cannot mutate them.
 */
export function assertLocalRequest(context: Context): void {
  const host = context.req.header('host') ?? '';
  if (!ALLOWED_HOSTS.has(host)) {
    throw new HTTPException(403, { message: `Refusing host "${host}".` });
  }

  if (!MUTATING.has(context.req.method)) return;

  const origin = context.req.header('origin');
  if (origin && origin !== 'http://127.0.0.1:4322' && origin !== 'http://localhost:4322') {
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
