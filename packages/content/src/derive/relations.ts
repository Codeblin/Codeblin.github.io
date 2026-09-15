import type { Post } from '../schema/post.ts';

const SCORE_SERIES = 5;
const SCORE_SHARED_TAG = 3;
const SCORE_SAME_CATEGORY = 2;

/**
 * Related research, scored rather than random. Series membership dominates,
 * then shared tags, then category; recency breaks ties so an old post never
 * outranks a new one on an equal score.
 */
export function relatedPosts(subject: Post, all: readonly Post[], limit = 3): Post[] {
  const scored = all
    .filter((candidate) => candidate.slug !== subject.slug)
    .map((candidate) => ({ candidate, score: relatednessScore(subject, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.candidate.frontmatter.publishedAt ?? '').localeCompare(
        a.candidate.frontmatter.publishedAt ?? '',
      );
    });

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

function relatednessScore(subject: Post, candidate: Post): number {
  let score = 0;
  const subjectSeries = subject.frontmatter.series?.id;
  if (subjectSeries && candidate.frontmatter.series?.id === subjectSeries) score += SCORE_SERIES;
  if (candidate.frontmatter.category === subject.frontmatter.category) score += SCORE_SAME_CATEGORY;
  for (const tag of candidate.frontmatter.tags) {
    if (subject.frontmatter.tags.includes(tag)) score += SCORE_SHARED_TAG;
  }
  return score;
}

export interface Adjacent<T> {
  previous: T | null;
  next: T | null;
}

/**
 * Chronological neighbours within the same category, falling back to the whole
 * archive when a category has only one entry. `all` must be newest first.
 */
export function adjacentPosts(subject: Post, all: readonly Post[]): Adjacent<Post> {
  const withinCategory = all.filter(
    (post) => post.frontmatter.category === subject.frontmatter.category,
  );
  const scope = withinCategory.length > 1 ? withinCategory : all;
  const index = scope.findIndex((post) => post.slug === subject.slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: scope[index + 1] ?? null,
    next: scope[index - 1] ?? null,
  };
}

/** Every post in a series, ordered by its declared position. */
export function seriesPosts(seriesId: string, all: readonly Post[]): Post[] {
  return all
    .filter((post) => post.frontmatter.series?.id === seriesId)
    .sort((a, b) => (a.frontmatter.series?.order ?? 0) - (b.frontmatter.series?.order ?? 0));
}
