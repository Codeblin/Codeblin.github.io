import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { collectHeadings } from '../derive/document.ts';
import { splitDocument } from '../markdown/frontmatter.ts';
import { parseBlocks, type Diagnostic } from '../markdown/parse.ts';
import type { Block } from '../schema/blocks.ts';
import type { HeadingRef } from '../schema/post.ts';
import { pagesRoot } from './paths.ts';

/**
 * Standalone pages (about, contact). They use the same block vocabulary as
 * articles but carry almost no metadata — a page is a document, not a record.
 */
export const pageFrontmatterSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(320),
  eyebrow: z.string().max(40).optional(),
});

export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

export interface LoadedPage {
  name: string;
  directory: string;
  frontmatter: PageFrontmatter;
  blocks: Block[];
  headings: HeadingRef[];
  diagnostics: Diagnostic[];
}

const cache = new Map<string, { mtimeMs: number; page: LoadedPage }>();

export function readPage(name: string): LoadedPage {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid page name: ${name}`);

  const file = path.join(pagesRoot, `${name}.md`);
  const mtimeMs = statSync(file).mtimeMs;

  const cached = cache.get(name);
  if (cached && cached.mtimeMs === mtimeMs) return cached.page;

  const { data, body } = splitDocument(readFileSync(file, 'utf8'));
  const parsed = pageFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`content/pages/${name}.md has invalid frontmatter — ${detail}`);
  }

  const { blocks, diagnostics } = parseBlocks(body);
  const page: LoadedPage = {
    name,
    directory: pagesRoot,
    frontmatter: parsed.data,
    blocks,
    headings: collectHeadings(blocks),
    diagnostics,
  };

  cache.set(name, { mtimeMs, page });
  return page;
}

export function invalidatePageCache(name?: string): void {
  if (name) cache.delete(name);
  else cache.clear();
}
