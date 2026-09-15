import { z } from 'zod';
import type { Block } from './blocks.ts';
import { safeHrefSchema } from './blocks.ts';
import { coverSchema, slugSchema } from './post.ts';
import type { HeadingRef } from './post.ts';

export const PROJECT_STATUSES = ['active', 'maintained', 'archived', 'research'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projectFrontmatterSchema = z.object({
  record: z.number().int().positive(),
  name: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  status: z.enum(PROJECT_STATUSES),
  /** Month precision — projects do not start on a particular day. */
  startedAt: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM.'),
  technologies: z.array(slugSchema).min(1).max(12),
  repository: safeHrefSchema.nullish(),
  homepage: safeHrefSchema.nullish(),
  featured: z.boolean().default(false),
  cover: coverSchema.optional(),
  published: z.boolean().default(true),
});

export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

export interface Project {
  slug: string;
  directory: string;
  frontmatter: ProjectFrontmatter;
  blocks: Block[];
  headings: HeadingRef[];
}
