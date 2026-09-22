import { existsSync } from 'node:fs';
import path from 'node:path';

import { walkBlocks } from './schema/blocks.ts';
import type { Post } from './schema/post.ts';
import type { Project } from './schema/project.ts';
import type { LoadedPost } from './repository/posts.ts';
import type { LoadedProject } from './repository/projects.ts';
import { readTaxonomy } from './repository/taxonomy.ts';

/**
 * One validator, used by the CMS before publish and by CI before deploy, so
 * nothing can be published locally that then fails in the pipeline.
 *
 * Errors block. Warnings are surfaced and ignored. Info is advisory only.
 */

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  /** `posts/<slug>` or `projects/<slug>`, matching the on-disk layout. */
  record: string;
  message: string;
  line?: number;
}

export interface ValidationReport {
  issues: Issue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const EXCERPT_MIN = 40;
const EXCERPT_MAX = 320;
const MAX_TAGS = 8;
const LONG_CODE_BLOCK = 80;

export function validateCorpus(
  posts: readonly LoadedPost[],
  projects: readonly LoadedProject[] = [],
): ValidationReport {
  const issues: Issue[] = [];
  const taxonomy = readTaxonomy();
  const knownCategories = new Set(taxonomy.categories.map((category) => category.slug));

  const seenRecords = new Map<number, string>();
  for (const post of posts) {
    const record = `posts/${post.slug}`;
    const previous = seenRecords.get(post.frontmatter.record);
    if (previous) {
      issues.push({
        level: 'error',
        record,
        message: `Record //${pad(post.frontmatter.record)} is already used by ${previous}.`,
      });
    } else {
      seenRecords.set(post.frontmatter.record, record);
    }
    issues.push(...validatePost(post, knownCategories));
  }

  const seenProjectRecords = new Map<number, string>();
  for (const project of projects) {
    const record = `projects/${project.slug}`;
    const previous = seenProjectRecords.get(project.frontmatter.record);
    if (previous) {
      issues.push({
        level: 'error',
        record,
        message: `Record //${pad(project.frontmatter.record)} is already used by ${previous}.`,
      });
    } else {
      seenProjectRecords.set(project.frontmatter.record, record);
    }
    issues.push(...validateProject(project));
  }

  return {
    issues,
    errorCount: issues.filter((issue) => issue.level === 'error').length,
    warningCount: issues.filter((issue) => issue.level === 'warning').length,
    infoCount: issues.filter((issue) => issue.level === 'info').length,
  };
}

export function validatePost(post: LoadedPost, knownCategories?: ReadonlySet<string>): Issue[] {
  const record = `posts/${post.slug}`;
  const issues: Issue[] = [];
  const { frontmatter } = post;
  const categories =
    knownCategories ?? new Set(readTaxonomy().categories.map((category) => category.slug));

  const add = (level: IssueLevel, message: string, line?: number): void => {
    issues.push({ level, record, message, line });
  };

  for (const diagnostic of post.diagnostics) {
    add(diagnostic.level, diagnostic.message, diagnostic.line);
  }

  if (!categories.has(frontmatter.category)) {
    add('error', `Unknown category "${frontmatter.category}". Add it to taxonomy.json.`);
  }

  if (frontmatter.status === 'published') {
    if (!frontmatter.publishedAt) add('error', 'A published post needs publishedAt.');
    if (!frontmatter.excerpt) add('error', 'A published post needs an excerpt.');
  }

  const excerpt = frontmatter.excerpt ?? '';
  if (excerpt && (excerpt.length < EXCERPT_MIN || excerpt.length > EXCERPT_MAX)) {
    add('warning', `Excerpt is ${excerpt.length} characters; aim for ${EXCERPT_MIN}–${EXCERPT_MAX}.`); // prettier-ignore
  }
  if (!frontmatter.subtitle) add('warning', 'No subtitle. It carries real weight in the layout.');
  if (frontmatter.tags.length > MAX_TAGS) add('warning', `More than ${MAX_TAGS} tags.`);
  if (!frontmatter.cover) add('info', 'No cover image.');

  issues.push(...validateMedia(post, record));
  issues.push(...validateOutline(post, record));

  return issues;
}

export function validateProject(project: LoadedProject): Issue[] {
  const record = `projects/${project.slug}`;
  const issues: Issue[] = project.diagnostics.map((diagnostic) => ({
    level: diagnostic.level,
    record,
    message: diagnostic.message,
    line: diagnostic.line,
  }));
  issues.push(...validateMedia(project, record));
  return issues;
}

/** Every referenced media file must actually exist in the record directory. */
function validateMedia(document: Post | Project, record: string): Issue[] {
  const issues: Issue[] = [];
  const references = new Set<string>();

  const cover = document.frontmatter.cover;
  if (cover) references.add(cover.src);

  for (const block of walkBlocks(document.blocks)) {
    if (block.type === 'image') references.add(block.src);
    if (block.type === 'video') {
      if (!block.src.startsWith('youtube:')) references.add(block.src);
      if (block.poster) references.add(block.poster);
    }
    if (block.type === 'gallery') for (const item of block.items) references.add(item.src);
  }

  for (const reference of references) {
    if (!reference.startsWith('./')) continue;
    const absolute = path.join(document.directory, reference.slice(2));
    if (!existsSync(absolute)) {
      issues.push({ level: 'error', record, message: `Missing media file ${reference}.` });
    }
  }

  return issues;
}

/** Heading ranks must not skip, or the document outline lies to a screen reader. */
function validateOutline(post: Post, record: string): Issue[] {
  const issues: Issue[] = [];
  let previousLevel = 2;
  for (const block of post.blocks) {
    if (block.type === 'heading') {
      if (block.level > previousLevel + 1) {
        issues.push({
          level: 'warning',
          record,
          message: `Heading "${block.text}" jumps from level ${previousLevel} to ${block.level}.`,
        });
      }
      previousLevel = block.level;
    }
    if (block.type === 'code' && block.source.split('\n').length > LONG_CODE_BLOCK) {
      issues.push({
        level: 'warning',
        record,
        message: `A code block is longer than ${LONG_CODE_BLOCK} lines. Consider trimming it.`,
      });
    }
  }
  return issues;
}

export function pad(record: number): string {
  return record.toString().padStart(4, '0');
}

function formatLevel(level: IssueLevel): string {
  if (level === 'error') return 'ERROR  ';
  if (level === 'warning') return 'WARNING';
  return 'INFO   ';
}

export function formatReport(report: ValidationReport): string {
  if (report.issues.length === 0) return 'Content valid — no issues.';
  return report.issues
    .map((issue) => {
      const location = issue.line ? `${issue.record}:${issue.line}` : issue.record;
      return `${formatLevel(issue.level)} ${location}  ${issue.message}`;
    })
    .join('\n');
}
