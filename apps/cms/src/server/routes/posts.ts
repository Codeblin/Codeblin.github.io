import { Hono } from 'hono';
import { z } from 'zod';

import {
  BLOCK_TYPES,
  createPost,
  deletePost,
  emptyBlock,
  listPosts,
  readPost,
  savePost,
  postFrontmatterSchema,
  blockSchema,
  validatePost,
  type Block,
} from '@codeblin/content';

import { journal } from '../journal.ts';

const createSchema = z.object({
  title: z.string().min(1).max(120),
  slug: z.string().optional(),
  category: z.string().min(1),
});

const saveSchema = z.object({
  frontmatter: postFrontmatterSchema,
  blocks: z.array(blockSchema),
});

export const posts = new Hono();

posts.get('/', (context) => {
  const all = listPosts({ includeDrafts: true });
  return context.json({
    posts: all.map((post) => ({
      slug: post.slug,
      record: post.frontmatter.record,
      title: post.frontmatter.title,
      status: post.frontmatter.status,
      category: post.frontmatter.category,
      tags: post.frontmatter.tags,
      publishedAt: post.frontmatter.publishedAt ?? null,
      updatedAt: post.frontmatter.updatedAt ?? null,
      featured: post.frontmatter.featured,
      wordCount: post.wordCount,
      readingMinutes: post.readingMinutes,
      issues: validatePost(post),
    })),
  });
});

posts.get('/blocks/empty/:type', (context) => {
  const type = context.req.param('type');
  if (!BLOCK_TYPES.includes(type as (typeof BLOCK_TYPES)[number])) {
    return context.json({ error: `Unknown block type ${type}` }, 400);
  }
  return context.json({ block: emptyBlock(type as (typeof BLOCK_TYPES)[number]) });
});

posts.get('/:slug', (context) => {
  const slug = context.req.param('slug');
  try {
    const post = readPost(slug);
    return context.json({
      slug: post.slug,
      frontmatter: post.frontmatter,
      blocks: post.blocks,
      headings: post.headings,
      wordCount: post.wordCount,
      readingMinutes: post.readingMinutes,
      issues: validatePost(post),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Not found';
    return context.json({ error: message }, 404);
  }
});

posts.post('/', async (context) => {
  const body = createSchema.parse(await context.req.json());
  const created = createPost(body);
  return context.json(created, 201);
});

posts.put('/:slug', async (context) => {
  const slug = context.req.param('slug');
  const body = saveSchema.parse(await context.req.json());
  savePost(slug, body.frontmatter, body.blocks as Block[]);
  journal(slug, { kind: 'save', title: body.frontmatter.title, blocks: body.blocks.length });
  const post = readPost(slug);
  return context.json({
    slug: post.slug,
    frontmatter: post.frontmatter,
    blocks: post.blocks,
    issues: validatePost(post),
    savedAt: new Date().toISOString(),
  });
});

posts.delete('/:slug', (context) => {
  const slug = context.req.param('slug');
  deletePost(slug);
  return context.json({ ok: true });
});
