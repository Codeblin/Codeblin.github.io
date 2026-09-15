import { Hono } from 'hono';
import { z } from 'zod';

import {
  documentFile,
  listPosts,
  listProjects,
  postDirectory,
  projectDirectory,
  readPost,
  savePost,
  taxonomyFile,
  today,
  validateCorpus,
  validatePost,
} from '@codeblin/content';

import { commit, push, readGitState, readRecentCommits, stage } from '../git.ts';

export const git = new Hono();

git.get('/', async (context) => {
  const [state, commits] = await Promise.all([readGitState(), readRecentCommits()]);
  return context.json({ ...state, commits });
});

const commitSchema = z.object({
  message: z.string().min(3).max(72),
  paths: z.array(z.string()).optional(),
});

git.post('/commit', async (context) => {
  const body = commitSchema.parse(await context.req.json());
  if (body.paths && body.paths.length > 0) {
    await stage(body.paths);
  }
  const hash = await commit(body.message);
  return context.json({ hash, ...(await readGitState()) });
});

git.post('/push', async (context) => {
  await push();
  return context.json({ ok: true, ...(await readGitState()) });
});

const publishSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(['posts', 'projects']).default('posts'),
  message: z.string().min(3).max(72).optional(),
});

/**
 * Publish pipeline: validate → (set published) → stage scoped paths → commit → push.
 * A failure at any step leaves the files on disk. The client retries from the
 * failed step rather than restarting.
 */
git.post('/publish', async (context) => {
  const body = publishSchema.parse(await context.req.json());
  const steps: Array<{ id: string; ok: boolean; detail: string }> = [];

  const mark = (id: string, ok: boolean, detail: string): void => {
    steps.push({ id, ok, detail });
  };

  try {
    if (body.kind === 'posts') {
      const post = readPost(body.slug);
      const frontmatter = {
        ...post.frontmatter,
        status: 'published' as const,
        publishedAt: post.frontmatter.publishedAt ?? today(),
        updatedAt: today(),
      };
      savePost(body.slug, frontmatter, post.blocks);
      const saved = readPost(body.slug);
      const issues = validatePost(saved);
      const errors = issues.filter((issue) => issue.level === 'error');
      if (errors.length > 0) {
        mark('validate', false, errors.map((issue) => issue.message).join('; '));
        return context.json({ ok: false, steps }, 400);
      }
      mark('validate', true, 'Content validated');
      mark('save', true, 'Record written');

      const paths = [documentFile(postDirectory(body.slug)), taxonomyFile];
      await stage(paths);
      mark('stage', true, 'Paths staged');
    } else {
      const corpus = validateCorpus(listPosts({ includeDrafts: true }), listProjects({ includeUnpublished: true }));
      if (corpus.errorCount > 0) {
        mark('validate', false, `${corpus.errorCount} corpus errors`);
        return context.json({ ok: false, steps }, 400);
      }
      mark('validate', true, 'Corpus valid');
      await stage([documentFile(projectDirectory(body.slug))]);
      mark('stage', true, 'Paths staged');
    }

    const title =
      body.kind === 'posts' ? readPost(body.slug).frontmatter.title : body.slug;
    const message = body.message ?? `Publish ${title}`;
    const hash = await commit(message);
    mark('commit', true, hash);

    await push();
    mark('push', true, 'Published');

    return context.json({ ok: true, steps, git: await readGitState() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown failure';
    const last = steps.at(-1)?.id ?? 'start';
    mark('failed', false, `${last}: ${detail}`);
    return context.json({ ok: false, steps, error: detail }, 500);
  }
});

const unpublishSchema = z.object({
  slug: z.string().min(1),
});

git.post('/unpublish', async (context) => {
  const { slug } = unpublishSchema.parse(await context.req.json());
  const post = readPost(slug);
  savePost(slug, { ...post.frontmatter, status: 'draft' }, post.blocks);
  return context.json({ ok: true, status: 'draft' });
});
