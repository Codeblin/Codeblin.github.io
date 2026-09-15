import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type { Block } from '../schema/blocks.ts';
import { postFrontmatterSchema, SLUG_PATTERN, type PostFrontmatter } from '../schema/post.ts';
import { documentFile, mediaDirectory, postDirectory } from './paths.ts';
import { invalidatePostCache, listPosts, serializePost } from './posts.ts';
import { atomicWrite, newBlockId, slugify } from './write.ts';

export interface CreatePostInput {
  title: string;
  slug?: string;
  category: string;
}

export function nextPostRecord(): number {
  const records = listPosts({ includeDrafts: true }).map((post) => post.frontmatter.record);
  return (records.length > 0 ? Math.max(...records) : 0) + 1;
}

export function allocateSlug(title: string, requested?: string): string {
  const base = requested ?? slugify(title);
  if (!SLUG_PATTERN.test(base)) {
    throw new Error(`Slug "${base}" is not a valid slug.`);
  }
  if (!existsSync(postDirectory(base))) return base;
  for (let index = 2; index < 50; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existsSync(postDirectory(candidate))) return candidate;
  }
  throw new Error(`Could not allocate a free slug from "${base}".`);
}

export function createPost(input: CreatePostInput): { slug: string; record: number } {
  const slug = allocateSlug(input.title, input.slug);
  const directory = postDirectory(slug);
  mkdirSync(mediaDirectory(directory), { recursive: true });

  const frontmatter: PostFrontmatter = {
    record: nextPostRecord(),
    title: input.title,
    status: 'draft',
    category: input.category,
    tags: [],
    featured: false,
  };

  const blocks: Block[] = [{ id: newBlockId(), type: 'prose', markdown: '' }];
  atomicWrite(documentFile(directory), serializePost(frontmatter, blocks));
  invalidatePostCache(slug);
  return { slug, record: frontmatter.record };
}

export function savePost(slug: string, frontmatter: PostFrontmatter, blocks: readonly Block[]): void {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  const parsed = postFrontmatterSchema.parse(frontmatter);
  atomicWrite(documentFile(postDirectory(slug)), serializePost(parsed, blocks));
  invalidatePostCache(slug);
}

export function deletePost(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  const directory = postDirectory(slug);
  if (!existsSync(directory)) throw new Error(`No post at ${slug}.`);
  rmSync(directory, { recursive: true, force: false });
  invalidatePostCache(slug);
}

const MEDIA_NAME = /^[\w.-]+\.(png|jpe?g|webp|gif|avif|mp4)$/i;

export function listMedia(slug: string): string[] {
  const directory = mediaDirectory(postDirectory(slug));
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => MEDIA_NAME.test(name) && !name.startsWith('.'))
    .sort();
}

/**
 * Allowed magic bytes. SVG is rejected by construction — it is a script
 * vector, and nothing in this corpus needs it.
 */
const MAGIC: Array<{ ext: string; test: (bytes: Buffer) => boolean }> = [
  { ext: 'png', test: (bytes) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  { ext: 'jpg', test: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { ext: 'webp', test: (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
  { ext: 'gif', test: (bytes) => bytes.length >= 6 && (bytes.toString('ascii', 0, 6) === 'GIF87a' || bytes.toString('ascii', 0, 6) === 'GIF89a') },
  { ext: 'mp4', test: (bytes) => bytes.length >= 8 && bytes.toString('ascii', 4, 8) === 'ftyp' },
];

export function sniffMedia(bytes: Buffer): string | null {
  for (const candidate of MAGIC) {
    if (candidate.test(bytes)) return candidate.ext === 'jpg' ? 'jpg' : candidate.ext;
  }
  return null;
}

export function saveMedia(slug: string, originalName: string, bytes: Buffer): string {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  const kind = sniffMedia(bytes);
  if (!kind) throw new Error('Unrecognised or disallowed media type.');

  const stem = slugify(originalName.replace(/\.[^.]+$/, '')) || 'image';
  const directory = mediaDirectory(postDirectory(slug));
  mkdirSync(directory, { recursive: true });

  let filename = `${stem}.${kind}`;
  let index = 2;
  while (existsSync(path.join(directory, filename))) {
    filename = `${stem}-${index}.${kind}`;
    index += 1;
  }

  writeFileSync(path.join(directory, filename), bytes);
  return `./media/${filename}`;
}

export function deleteMedia(slug: string, filename: string): void {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  if (!MEDIA_NAME.test(filename) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid media filename.');
  }
  const file = path.join(mediaDirectory(postDirectory(slug)), filename);
  if (!existsSync(file)) throw new Error(`No media file ${filename}.`);
  unlinkSync(file);
}

export function readMedia(slug: string, filename: string): Buffer {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  if (!MEDIA_NAME.test(filename) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid media filename.');
  }
  return readFileSync(path.join(mediaDirectory(postDirectory(slug)), filename));
}
