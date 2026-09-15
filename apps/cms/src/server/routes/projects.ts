import { Hono } from 'hono';
import { z } from 'zod';

import {
  createProject,
  deleteProject,
  listProjects,
  readProject,
  saveProject,
  projectFrontmatterSchema,
  blockSchema,
  validateProject,
  type Block,
} from '@codeblin/content';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().optional(),
  tagline: z.string().min(1).max(160),
});

const saveSchema = z.object({
  frontmatter: projectFrontmatterSchema,
  blocks: z.array(blockSchema),
});

export const projects = new Hono();

projects.get('/', (context) => {
  const all = listProjects({ includeUnpublished: true });
  return context.json({
    projects: all.map((project) => ({
      slug: project.slug,
      record: project.frontmatter.record,
      name: project.frontmatter.name,
      tagline: project.frontmatter.tagline,
      status: project.frontmatter.status,
      published: project.frontmatter.published,
      featured: project.frontmatter.featured,
      technologies: project.frontmatter.technologies,
      startedAt: project.frontmatter.startedAt,
      issues: validateProject(project),
    })),
  });
});

projects.get('/:slug', (context) => {
  try {
    const project = readProject(context.req.param('slug'));
    return context.json({
      slug: project.slug,
      frontmatter: project.frontmatter,
      blocks: project.blocks,
      headings: project.headings,
      issues: validateProject(project),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Not found';
    return context.json({ error: message }, 404);
  }
});

projects.post('/', async (context) => {
  const body = createSchema.parse(await context.req.json());
  return context.json(createProject(body), 201);
});

projects.put('/:slug', async (context) => {
  const slug = context.req.param('slug');
  const body = saveSchema.parse(await context.req.json());
  saveProject(slug, body.frontmatter, body.blocks as Block[]);
  const project = readProject(slug);
  return context.json({
    slug: project.slug,
    frontmatter: project.frontmatter,
    blocks: project.blocks,
    issues: validateProject(project),
    savedAt: new Date().toISOString(),
  });
});

projects.delete('/:slug', (context) => {
  deleteProject(context.req.param('slug'));
  return context.json({ ok: true });
});
