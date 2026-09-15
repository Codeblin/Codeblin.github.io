import { readdirSync, readFileSync, statSync } from 'node:fs';

import { deriveDocument } from '../derive/document.ts';
import { composeDocument, splitDocument } from '../markdown/frontmatter.ts';
import { parseBlocks, type Diagnostic } from '../markdown/parse.ts';
import { serializeBlocks } from '../markdown/serialize.ts';
import type { Block } from '../schema/blocks.ts';
import { postFrontmatterSchema, SLUG_PATTERN, type Post, type PostFrontmatter } from '../schema/post.ts';
import { documentFile, postDirectory, postsRoot } from './paths.ts';

export interface LoadedPost extends Post {
  diagnostics: Diagnostic[];
}

interface CacheEntry {
  mtimeMs: number;
  post: LoadedPost;
}

/**
 * Keyed on modification time so a dev-server rebuild after a CMS autosave
 * always sees the new file, while a production build reads each record once.
 */
const cache = new Map<string, CacheEntry>();

export function listPostSlugs(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(postsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  return entries.filter((name) => SLUG_PATTERN.test(name)).sort();
}

export function readPost(slug: string): LoadedPost {
  const directory = postDirectory(slug);
  const file = documentFile(directory);
  const mtimeMs = statSync(file).mtimeMs;

  const cached = cache.get(slug);
  if (cached && cached.mtimeMs === mtimeMs) return cached.post;

  const raw = readFileSync(file, 'utf8');
  const post = parsePostDocument(slug, directory, raw);
  cache.set(slug, { mtimeMs, post });
  return post;
}

export function parsePostDocument(slug: string, directory: string, raw: string): LoadedPost {
  const { data, body } = splitDocument(raw);
  const parsed = postFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`content/posts/${slug}/index.md has invalid frontmatter — ${detail}`);
  }

  const { blocks, diagnostics } = parseBlocks(body);
  const derived = deriveDocument(blocks);

  return {
    slug,
    directory,
    frontmatter: parsed.data,
    blocks,
    headings: derived.headings,
    readingMinutes: derived.readingMinutes,
    wordCount: derived.wordCount,
    diagnostics,
  };
}

export interface PostQuery {
  /** Drafts are excluded unless explicitly asked for; production never asks. */
  includeDrafts?: boolean;
  category?: string;
  tag?: string;
  series?: string;
  limit?: number;
}

export function listPosts(query: PostQuery = {}): LoadedPost[] {
  const includeDrafts = query.includeDrafts ?? false;
  const posts = listPostSlugs()
    .map((slug) => readPost(slug))
    .filter((post) => includeDrafts || post.frontmatter.status === 'published')
    .filter((post) => !query.category || post.frontmatter.category === query.category)
    .filter((post) => !query.tag || post.frontmatter.tags.includes(query.tag))
    .filter((post) => !query.series || post.frontmatter.series?.id === query.series)
    .sort(byNewestFirst);

  return query.limit ? posts.slice(0, query.limit) : posts;
}

export function byNewestFirst(a: Post, b: Post): number {
  const left = a.frontmatter.publishedAt ?? '0000-00-00';
  const right = b.frontmatter.publishedAt ?? '0000-00-00';
  if (left === right) return b.frontmatter.record - a.frontmatter.record;
  return right.localeCompare(left);
}

/**
 * Canonical frontmatter key order. Hand-edited files converge on this shape
 * the first time the CMS saves them, so diffs stay about content.
 */
const FRONTMATTER_ORDER: Array<keyof PostFrontmatter> = [
  'record',
  'title',
  'subtitle',
  'excerpt',
  'status',
  'publishedAt',
  'updatedAt',
  'category',
  'tags',
  'cover',
  'series',
  'featured',
  'draftNotes',
  'canonical',
];

export function serializePost(frontmatter: PostFrontmatter, blocks: readonly Block[]): string {
  const ordered: Record<string, unknown> = {};
  for (const key of FRONTMATTER_ORDER) {
    const value = frontmatter[key];
    if (value !== undefined && value !== null) ordered[key] = value;
  }
  return composeDocument(ordered, serializeBlocks(blocks));
}

/** Clears the read cache. The CMS calls this after writing to disk. */
export function invalidatePostCache(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}
