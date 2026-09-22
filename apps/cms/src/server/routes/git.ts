import { Hono } from 'hono';
import { z } from 'zod';

import {
  listPosts,
  listProjects,
  readPost,
  readProject,
  savePost,
  saveProject,
  today,
  validateCorpus,
  validatePost,
  validateProject,
} from '@codeblin/content';

import {
  commit,
  contentDirtyPaths,
  hasStagedChanges,
  publishCommitMessage,
  push,
  readGitState,
  readRecentCommits,
  sitePublishMessage,
  stage,
  stageContent,
  stageRecord,
  withGitLock,
} from '../git.ts';

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
  return withGitLock(async () => {
    if (body.paths && body.paths.length > 0) {
      await stage(body.paths);
    }
    const hash = await commit(body.message);
    return context.json({ hash, ...(await readGitState()) });
  });
});

git.post('/push', async (context) => {
  return withGitLock(async () => {
    await push();
    return context.json({ ok: true, ...(await readGitState()) });
  });
});

const publishSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(['posts', 'projects']).default('posts'),
  /** live = go onto the site. draft = push current draft so the live site drops it. */
  as: z.enum(['live', 'draft']).default('live'),
  message: z.string().min(3).max(72).optional(),
});

/**
 * Mark a record live or draft on disk. Does not commit or push.
 * Live writes are blocked by validation errors so a broken post cannot go onto
 * the local site.
 */
function writeLocalVisibility(
  kind: 'posts' | 'projects',
  slug: string,
  as: 'live' | 'draft',
): { title: string; status: 'published' | 'draft'; errors: string[] } {
  if (kind === 'posts') {
    const post = readPost(slug);
    const frontmatter =
      as === 'live'
        ? {
            ...post.frontmatter,
            status: 'published' as const,
            publishedAt: post.frontmatter.publishedAt ?? today(),
            updatedAt: today(),
          }
        : { ...post.frontmatter, status: 'draft' as const, updatedAt: today() };
    if (as === 'live') {
      const errors = validatePost({ ...post, frontmatter })
        .filter((issue) => issue.level === 'error')
        .map((issue) => issue.message);
      if (errors.length > 0) return { title: post.frontmatter.title, status: 'draft', errors };
    }
    savePost(slug, frontmatter, post.blocks);
    return { title: frontmatter.title, status: frontmatter.status, errors: [] };
  }

  const project = readProject(slug);
  const frontmatter = { ...project.frontmatter, published: as === 'live' };
  if (as === 'live') {
    const errors = validateProject({ ...project, frontmatter })
      .filter((issue) => issue.level === 'error')
      .map((issue) => issue.message);
    if (errors.length > 0) return { title: project.frontmatter.name, status: 'draft', errors };
  }
  saveProject(slug, frontmatter, project.blocks);
  return {
    title: frontmatter.name,
    status: as === 'live' ? 'published' : 'draft',
    errors: [],
  };
}

/**
 * Push one record to origin. Only `content/<kind>/<slug>/` is staged.
 * `as: live` marks it published first. `as: draft` keeps it unpublished so
 * the production build omits it — that is how a local unpublish reaches the site.
 */
git.post('/publish', async (context) => {
  const body = publishSchema.parse(await context.req.json());
  return withGitLock(async () => {
    const steps: Array<{ id: string; ok: boolean; detail: string }> = [];
    const mark = (id: string, ok: boolean, detail: string): void => {
      steps.push({ id, ok, detail });
    };

    try {
      const as = body.as;
      const written = writeLocalVisibility(body.kind, body.slug, as);
      if (written.errors.length > 0) {
        mark('validate', false, written.errors.join('; '));
        return context.json({ ok: false, steps, error: written.errors.join('; ') }, 400);
      }
      if (as === 'live' && body.kind === 'projects') {
        const corpus = validateCorpus(listPosts({ includeDrafts: true }), listProjects({ includeUnpublished: true }));
        if (corpus.errorCount > 0) {
          mark('validate', false, `${corpus.errorCount} corpus errors`);
          return context.json({ ok: false, steps, error: `${corpus.errorCount} corpus errors` }, 400);
        }
      }
      const title = written.title;
      mark('validate', true, as === 'draft' ? 'Draft validated' : 'Content validated');
      mark('save', true, 'Record written');

      const scoped = await stageRecord(body.kind, body.slug);
      mark('stage', true, scoped);

      if (!(await hasStagedChanges(scoped))) {
        mark('commit', true, 'No record changes — commit skipped');
        mark('push', true, 'Already up to date');
        return context.json({ ok: true, skipped: true, as, steps, git: await readGitState() });
      }

      const message = body.message ?? publishCommitMessage(body.kind, title, as);
      const hash = await commit(message, [scoped]);
      mark('commit', true, hash);

      await push();
      mark('push', true, as === 'draft' ? 'Draft on origin' : 'Published');

      return context.json({ ok: true, as, steps, git: await readGitState() });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown failure';
      const last = steps.at(-1)?.id ?? 'start';
      mark('failed', false, `${last}: ${detail}`);
      return context.json({ ok: false, steps, error: detail }, 500);
    }
  });
});

const publishAllSchema = z.object({
  message: z.string().min(3).max(72).optional(),
});

/**
 * Commit and push every change under `content/` — edits, taxonomy, and
 * deletions. Per-record publish cannot stage a removed directory.
 */
git.post('/publish-all', async (context) => {
  const body = publishAllSchema.parse(await context.req.json());
  return withGitLock(async () => {
    const steps: Array<{ id: string; ok: boolean; detail: string }> = [];
    const mark = (id: string, ok: boolean, detail: string): void => {
      steps.push({ id, ok, detail });
    };

    try {
      const corpus = validateCorpus(listPosts(), listProjects());
      if (corpus.errorCount > 0) {
        mark('validate', false, `${corpus.errorCount} published-record errors`);
        return context.json({ ok: false, steps, error: `${corpus.errorCount} published-record errors` }, 400);
      }
      mark('validate', true, 'Published content validated');

      const before = await readGitState();
      const pending = contentDirtyPaths(before.dirty);
      const scoped = await stageContent();
      mark('stage', true, scoped);

      const staged = await hasStagedChanges(scoped);
      if (!staged && before.ahead === 0) {
        mark('commit', true, 'No content changes — commit skipped');
        mark('push', true, 'Already up to date');
        return context.json({ ok: true, skipped: true, steps, git: await readGitState() });
      }

      if (staged) {
        const message = body.message ?? sitePublishMessage(pending);
        const hash = await commit(message, [scoped]);
        mark('commit', true, hash);
      } else {
        mark('commit', true, 'No new content — pushing existing commits');
      }

      await push();
      mark('push', true, pending.length ? `Published ${pending.length} content paths` : 'Pushed');

      return context.json({ ok: true, steps, git: await readGitState() });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown failure';
      const last = steps.at(-1)?.id ?? 'start';
      mark('failed', false, `${last}: ${detail}`);
      return context.json({ ok: false, steps, error: detail }, 500);
    }
  });
});

const localSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(['posts', 'projects']).default('posts'),
  as: z.enum(['live', 'draft']),
});

/** Change visibility on disk only — no commit, no push. */
git.post('/local', async (context) => {
  const { slug, kind, as } = localSchema.parse(await context.req.json());
  return withGitLock(async () => {
    const written = writeLocalVisibility(kind, slug, as);
    if (written.errors.length > 0) {
      return context.json({ ok: false, status: written.status, kind, error: written.errors.join('; ') }, 400);
    }
    return context.json({ ok: true, status: written.status, kind });
  });
});

git.post('/unpublish', async (context) => {
  const { slug, kind } = localSchema.omit({ as: true }).parse(await context.req.json());
  return withGitLock(async () => {
    const written = writeLocalVisibility(kind, slug, 'draft');
    return context.json({ ok: true, status: written.status, kind });
  });
});
