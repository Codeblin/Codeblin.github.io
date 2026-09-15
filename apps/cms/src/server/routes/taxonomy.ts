import { Hono } from 'hono';

import { readTaxonomy, writeTaxonomy, taxonomySchema } from '@codeblin/content';

export const taxonomy = new Hono();

taxonomy.get('/', (context) => context.json(readTaxonomy()));

taxonomy.put('/', async (context) => {
  const body = taxonomySchema.parse(await context.req.json());
  writeTaxonomy(body);
  return context.json(readTaxonomy());
});
