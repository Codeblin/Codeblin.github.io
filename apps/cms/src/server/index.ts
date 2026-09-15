import { serve } from '@hono/node-server';

import { app } from './app.ts';

const HOST = '127.0.0.1';
const PORT = 4323;

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, (info) => {
  console.log(`[cms-api] http://${info.address}:${info.port}`);
});
