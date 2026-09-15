import { writeFileSync } from 'node:fs';

import { taxonomySchema, type Taxonomy } from '../schema/taxonomy.ts';
import { taxonomyFile } from './paths.ts';
import { invalidateTaxonomyCache } from './taxonomy.ts';

export function writeTaxonomy(taxonomy: Taxonomy): void {
  const parsed = taxonomySchema.parse(taxonomy);
  writeFileSync(taxonomyFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  invalidateTaxonomyCache();
}
