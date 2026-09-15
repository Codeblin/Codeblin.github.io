import { existsSync, mkdirSync, rmSync } from 'node:fs';

import type { Block } from '../schema/blocks.ts';
import { SLUG_PATTERN } from '../schema/post.ts';
import { projectFrontmatterSchema, type ProjectFrontmatter } from '../schema/project.ts';
import { documentFile, mediaDirectory, projectDirectory } from './paths.ts';
import { invalidateProjectCache, listProjects, serializeProject } from './projects.ts';
import { atomicWrite, newBlockId, slugify } from './write.ts';

export interface CreateProjectInput {
  name: string;
  slug?: string;
  tagline: string;
}

export function nextProjectRecord(): number {
  const records = listProjects({ includeUnpublished: true }).map(
    (project) => project.frontmatter.record,
  );
  return (records.length > 0 ? Math.max(...records) : 0) + 1;
}

export function createProject(input: CreateProjectInput): { slug: string; record: number } {
  const base = input.slug ?? slugify(input.name);
  if (!SLUG_PATTERN.test(base)) throw new Error(`Slug "${base}" is not a valid slug.`);
  if (existsSync(projectDirectory(base))) throw new Error(`Project ${base} already exists.`);

  const directory = projectDirectory(base);
  mkdirSync(mediaDirectory(directory), { recursive: true });

  const now = new Date();
  const startedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const frontmatter: ProjectFrontmatter = {
    record: nextProjectRecord(),
    name: input.name,
    tagline: input.tagline,
    status: 'research',
    startedAt,
    technologies: ['android'],
    featured: false,
    published: false,
  };

  const blocks: Block[] = [{ id: newBlockId(), type: 'prose', markdown: '' }];
  atomicWrite(documentFile(directory), serializeProject(frontmatter, blocks));
  invalidateProjectCache(base);
  return { slug: base, record: frontmatter.record };
}

export function saveProject(
  slug: string,
  frontmatter: ProjectFrontmatter,
  blocks: readonly Block[],
): void {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  const parsed = projectFrontmatterSchema.parse(frontmatter);
  atomicWrite(documentFile(projectDirectory(slug)), serializeProject(parsed, blocks));
  invalidateProjectCache(slug);
}

export function deleteProject(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  const directory = projectDirectory(slug);
  if (!existsSync(directory)) throw new Error(`No project at ${slug}.`);
  rmSync(directory, { recursive: true, force: false });
  invalidateProjectCache(slug);
}
