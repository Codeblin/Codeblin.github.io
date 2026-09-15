import { readdirSync, readFileSync, statSync } from 'node:fs';

import { collectHeadings } from '../derive/document.ts';
import { composeDocument, splitDocument } from '../markdown/frontmatter.ts';
import { parseBlocks, type Diagnostic } from '../markdown/parse.ts';
import { serializeBlocks } from '../markdown/serialize.ts';
import type { Block } from '../schema/blocks.ts';
import { SLUG_PATTERN } from '../schema/post.ts';
import { projectFrontmatterSchema, type Project, type ProjectFrontmatter } from '../schema/project.ts';
import { documentFile, projectDirectory, projectsRoot } from './paths.ts';

export interface LoadedProject extends Project {
  diagnostics: Diagnostic[];
}

const cache = new Map<string, { mtimeMs: number; project: LoadedProject }>();

export function listProjectSlugs(): string[] {
  try {
    return readdirSync(projectsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .filter((name) => SLUG_PATTERN.test(name))
      .sort();
  } catch {
    return [];
  }
}

export function readProject(slug: string): LoadedProject {
  const directory = projectDirectory(slug);
  const file = documentFile(directory);
  const mtimeMs = statSync(file).mtimeMs;

  const cached = cache.get(slug);
  if (cached && cached.mtimeMs === mtimeMs) return cached.project;

  const { data, body } = splitDocument(readFileSync(file, 'utf8'));
  const parsed = projectFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`content/projects/${slug}/index.md has invalid frontmatter — ${detail}`);
  }

  const { blocks, diagnostics } = parseBlocks(body);
  const project: LoadedProject = {
    slug,
    directory,
    frontmatter: parsed.data,
    blocks,
    headings: collectHeadings(blocks),
    diagnostics,
  };

  cache.set(slug, { mtimeMs, project });
  return project;
}

export function listProjects(options: { includeUnpublished?: boolean } = {}): LoadedProject[] {
  const statusOrder: Record<string, number> = {
    active: 0,
    research: 1,
    maintained: 2,
    archived: 3,
  };
  return listProjectSlugs()
    .map((slug) => readProject(slug))
    .filter((project) => options.includeUnpublished || project.frontmatter.published)
    .sort((a, b) => {
      if (a.frontmatter.featured !== b.frontmatter.featured) {
        return a.frontmatter.featured ? -1 : 1;
      }
      const rank =
        (statusOrder[a.frontmatter.status] ?? 9) - (statusOrder[b.frontmatter.status] ?? 9);
      if (rank !== 0) return rank;
      return b.frontmatter.startedAt.localeCompare(a.frontmatter.startedAt);
    });
}

export function invalidateProjectCache(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}

const PROJECT_FRONTMATTER_ORDER: Array<keyof ProjectFrontmatter> = [
  'record',
  'name',
  'tagline',
  'status',
  'startedAt',
  'technologies',
  'repository',
  'homepage',
  'featured',
  'cover',
  'published',
];

export function serializeProject(frontmatter: ProjectFrontmatter, blocks: readonly Block[]): string {
  const ordered: Record<string, unknown> = {};
  for (const key of PROJECT_FRONTMATTER_ORDER) {
    const value = frontmatter[key];
    if (value !== undefined && value !== null) ordered[key] = value;
  }
  return composeDocument(ordered, serializeBlocks(blocks));
}
