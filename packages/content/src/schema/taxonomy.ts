import { z } from 'zod';
import { slugSchema } from './post.ts';

export const categorySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(60),
  /** Three-letter code used in dense listings and record rows. */
  abbr: z.string().regex(/^[A-Z]{2,4}$/),
  description: z.string().min(1).max(240),
  order: z.number().int().min(0),
});

export const tagSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(240).default(''),
});

export const seriesSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(80),
  description: z.string().max(240).default(''),
});

export const taxonomySchema = z.object({
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  series: z.array(seriesSchema).default([]),
});

export type Category = z.infer<typeof categorySchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Series = z.infer<typeof seriesSchema>;
export type Taxonomy = z.infer<typeof taxonomySchema>;
