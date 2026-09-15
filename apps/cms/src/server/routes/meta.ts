import { Hono } from 'hono';

import { listPosts, listProjects, readTaxonomy, validateCorpus } from '@codeblin/content';

import { readGitState, readRecentCommits } from '../git.ts';

export const meta = new Hono();

meta.get('/health', (context) =>
  context.json({ ok: true, preview: 'http://127.0.0.1:4321' }),
);

meta.get('/meta', async (context) => {
  const posts = listPosts({ includeDrafts: true });
  const projects = listProjects({ includeUnpublished: true });
  const taxonomy = readTaxonomy();
  const report = validateCorpus(posts, projects);
  const published = posts.filter((post) => post.frontmatter.status === 'published');
  const drafts = posts.filter((post) => post.frontmatter.status === 'draft');

  const [git, commits] = await Promise.all([readGitState(), readRecentCommits(8)]);

  const draftAges = drafts.map((post) => ({
    slug: post.slug,
    title: post.frontmatter.title,
    updatedAt: post.frontmatter.updatedAt ?? null,
  }));

  return context.json({
    counts: {
      posts: posts.length,
      published: published.length,
      drafts: drafts.length,
      projects: projects.length,
      categories: taxonomy.categories.length,
      tags: taxonomy.tags.length,
    },
    recent: published.slice(0, 6).map((post) => ({
      slug: post.slug,
      title: post.frontmatter.title,
      publishedAt: post.frontmatter.publishedAt ?? null,
      record: post.frontmatter.record,
    })),
    draftAges,
    validation: report,
    git,
    commits,
    preview: 'http://127.0.0.1:4321',
  });
});
