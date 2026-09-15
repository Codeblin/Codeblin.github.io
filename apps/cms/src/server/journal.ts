import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { repositoryRoot } from '@codeblin/content';

/** Append-only recovery journal. Gitignored. Never served. */
export function journal(slug: string, payload: unknown): void {
  const directory = path.join(repositoryRoot, '.cms', 'journal');
  mkdirSync(directory, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), slug, payload }) + '\n';
  appendFileSync(path.join(directory, `${slug}.ndjson`), line, 'utf8');
}
