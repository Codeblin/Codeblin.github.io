import { readFileSync, statSync } from 'node:fs';

import { taxonomySchema, type Category, type Series, type Tag, type Taxonomy } from '../schema/taxonomy.ts';
import { taxonomyFile } from './paths.ts';

let cached: { mtimeMs: number; taxonomy: Taxonomy } | null = null;

export function readTaxonomy(): Taxonomy {
  const mtimeMs = statSync(taxonomyFile).mtimeMs;
  if (cached && cached.mtimeMs === mtimeMs) return cached.taxonomy;

  const parsed = taxonomySchema.safeParse(JSON.parse(readFileSync(taxonomyFile, 'utf8')));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`content/taxonomy.json is invalid — ${detail}`);
  }

  const taxonomy: Taxonomy = {
    ...parsed.data,
    categories: [...parsed.data.categories].sort((a, b) => a.order - b.order),
  };
  cached = { mtimeMs, taxonomy };
  return taxonomy;
}

export function findCategory(slug: string): Category | undefined {
  return readTaxonomy().categories.find((category) => category.slug === slug);
}

export function findTag(slug: string): Tag | undefined {
  return readTaxonomy().tags.find((tag) => tag.slug === slug);
}

export function findSeries(slug: string): Series | undefined {
  return readTaxonomy().series.find((series) => series.slug === slug);
}

/**
 * A tag used in content but missing from the registry still gets a page — the
 * registry only supplies the display name and standfirst.
 */
export function resolveTag(slug: string): Tag {
  return findTag(slug) ?? { slug, name: humanise(slug), description: '' };
}

export function humanise(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0]?.toUpperCase() + word.slice(1)))
    .join(' ');
}

export function invalidateTaxonomyCache(): void {
  cached = null;
}
