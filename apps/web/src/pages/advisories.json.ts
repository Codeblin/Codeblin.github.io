import type { APIRoute } from 'astro';

import { loadAdvisories } from '~/lib/advisories.ts';

export const GET: APIRoute = async () => {
  const items = await loadAdvisories();
  return new Response(JSON.stringify(items), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': import.meta.env.DEV ? 'no-store' : 'public, max-age=1800',
    },
  });
};
