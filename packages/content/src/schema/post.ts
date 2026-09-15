import { z } from 'zod';
import type { Block } from './blocks.ts';
import { mediaPathSchema, safeHrefSchema } from './blocks.ts';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(SLUG_PATTERN, 'Slugs are lowercase words joined by single hyphens.');

/** ISO calendar date, no time and no zone — publication dates are days. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates are YYYY-MM-DD.')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Not a real calendar date.',
  });

export const STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof STATUSES)[number];

export const coverSchema = z.object({
  src: mediaPathSchema,
  alt: z.string().min(1, 'A cover image needs alt text.'),
  duotone: z.boolean().optional(),
});

export const seriesRefSchema = z.object({
  id: slugSchema,
  order: z.number().int().positive(),
});

export const postFrontmatterSchema = z.object({
  record: z.number().int().positive(),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  excerpt: z.string().max(400).optional(),

  status: z.enum(STATUSES),
  publishedAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),

  category: slugSchema,
  tags: z.array(slugSchema).max(8).default([]),

  cover: coverSchema.optional(),
  series: seriesRefSchema.optional(),
  featured: z.boolean().default(false),

  /** Author-only scratch space. Stripped from every output, including RSS. */
  draftNotes: z.string().nullish(),
  /** Set only when this article was first published somewhere else. */
  canonical: safeHrefSchema.nullish(),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

export interface HeadingRef {
  anchor: string;
  text: string;
  level: 2 | 3 | 4;
  /** Hex offset shown in the table of contents; index of the heading, in hex. */
  offset: string;
}

/** A post as the rest of the system sees it: frontmatter, blocks, derived data. */
export interface Post {
  slug: string;
  /** Absolute path to the record directory, for media resolution. */
  directory: string;
  frontmatter: PostFrontmatter;
  blocks: Block[];
  headings: HeadingRef[];
  readingMinutes: number;
  wordCount: number;
}
