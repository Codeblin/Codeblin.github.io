import type { APIRoute } from 'astro';

import { buildSearchIndex } from '~/lib/search-index.ts';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildSearchIndex()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
