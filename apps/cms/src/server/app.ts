import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { git } from './routes/git.ts';
import { media } from './routes/media.ts';
import { meta } from './routes/meta.ts';
import { posts } from './routes/posts.ts';
import { projects } from './routes/projects.ts';
import { taxonomy } from './routes/taxonomy.ts';
import { assertLocalRequest } from './guards.ts';

/**
 * Local CMS API. Bound to loopback only — see ARCHITECTURE.md §5.
 *
 * There is no authentication because there is no network. The guards exist
 * to keep a browser tab on a different origin from driving git or the
 * filesystem, which is the realistic threat on a development machine.
 */

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: ['http://127.0.0.1:4322', 'http://localhost:4322'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['content-type'],
    maxAge: 600,
  }),
);

app.use('*', async (context, next) => {
  assertLocalRequest(context);
  await next();
});

app.onError((error, context) => {
  if (error instanceof HTTPException) return error.getResponse();
  const message = error instanceof Error ? error.message : 'Internal error';
  console.error('[cms]', error);
  return context.json({ error: message }, 500);
});

app.route('/api', meta);
app.route('/api/posts', posts);
app.route('/api/posts', media);
app.route('/api/projects', projects);
app.route('/api/taxonomy', taxonomy);
app.route('/api/git', git);

app.notFound((context) => context.json({ error: 'Not found' }, 404));
