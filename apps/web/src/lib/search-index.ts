import {
  deriveDocument,
  findCategory,
  listPosts,
  listProjects,
  stripMarkdown,
  walkBlocks,
} from '@codeblin/content';

/**
 * Build-time search index.
 *
 * A hand-written inverted index rather than a dependency: at a few hundred
 * documents this is a solved problem, and owning it keeps both the payload and
 * the ranking behaviour under our control. See ARCHITECTURE.md §2.7.
 *
 * Shape: a sorted term array with a parallel postings array, so the client can
 * binary-search for a prefix instead of scanning every key.
 */

export interface SearchDocument {
  /** Title. */
  t: string;
  /** Subtitle or tagline. */
  s: string;
  /** Excerpt. */
  e: string;
  /** URL. */
  u: string;
  /** Category or project status label. */
  c: string;
  /** Tags or technologies. */
  g: string[];
  /** Date stamp, already formatted. */
  d: string;
  /** Record number. */
  r: number;
  /** Kind: 0 = research, 1 = project. */
  k: 0 | 1;
}

export interface SearchIndex {
  docs: SearchDocument[];
  terms: string[];
  /** Postings run parallel to `terms`: pairs of document index and weight. */
  postings: Array<Array<[number, number]>>;
}

const WEIGHT = {
  title: 8,
  tags: 6,
  subtitle: 4,
  category: 4,
  excerpt: 3,
  heading: 3,
  body: 1,
  literal: 1,
} as const;

/** Caps per-document body text so the index cannot grow without bound. */
const BODY_LIMIT = 6000;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function buildSearchIndex(): SearchIndex {
  const docs: SearchDocument[] = [];
  const weights = new Map<string, Map<number, number>>();

  const add = (docId: number, text: string, weight: number): void => {
    for (const token of tokenize(text)) {
      if (token.length < 2) continue;
      let postings = weights.get(token);
      if (!postings) {
        postings = new Map();
        weights.set(token, postings);
      }
      postings.set(docId, (postings.get(docId) ?? 0) + weight);
    }
  };

  for (const post of listPosts()) {
    const { frontmatter } = post;
    const category = findCategory(frontmatter.category);
    const derived = deriveDocument(post.blocks);
    const docId = docs.length;

    docs.push({
      t: frontmatter.title,
      s: frontmatter.subtitle ?? '',
      e: frontmatter.excerpt ?? '',
      u: `/research/${post.slug}/`,
      c: category?.name ?? frontmatter.category,
      g: [...frontmatter.tags],
      d: frontmatter.publishedAt ?? '',
      r: frontmatter.record,
      k: 0,
    });

    add(docId, frontmatter.title, WEIGHT.title);
    add(docId, frontmatter.subtitle ?? '', WEIGHT.subtitle);
    add(docId, frontmatter.excerpt ?? '', WEIGHT.excerpt);
    add(docId, frontmatter.tags.join(' '), WEIGHT.tags);
    add(docId, category?.name ?? frontmatter.category, WEIGHT.category);
    for (const heading of post.headings) add(docId, heading.text, WEIGHT.heading);
    add(docId, derived.plainText.slice(0, BODY_LIMIT), WEIGHT.body);
    add(docId, derived.literalText.slice(0, BODY_LIMIT), WEIGHT.literal);
  }

  for (const project of listProjects()) {
    const { frontmatter } = project;
    const derived = deriveDocument(project.blocks);
    const docId = docs.length;

    docs.push({
      t: frontmatter.name,
      s: frontmatter.tagline,
      e: '',
      u: `/projects/${project.slug}/`,
      c: frontmatter.status,
      g: [...frontmatter.technologies],
      d: frontmatter.startedAt,
      r: frontmatter.record,
      k: 1,
    });

    add(docId, frontmatter.name, WEIGHT.title);
    add(docId, frontmatter.tagline, WEIGHT.subtitle);
    add(docId, frontmatter.technologies.join(' '), WEIGHT.tags);
    for (const heading of project.headings) add(docId, heading.text, WEIGHT.heading);
    add(docId, derived.plainText.slice(0, BODY_LIMIT), WEIGHT.body);
    add(docId, derived.literalText.slice(0, BODY_LIMIT), WEIGHT.literal);

    // Findings inside a project are searchable by their identifier.
    for (const block of walkBlocks(project.blocks)) {
      if (block.type === 'finding' && block.findingId) {
        add(docId, stripMarkdown(block.findingId), WEIGHT.tags);
      }
    }
  }

  const terms = [...weights.keys()].sort();
  const postings = terms.map((term) => [...(weights.get(term) ?? new Map())].map(
    ([docId, weight]) => [docId, weight] as [number, number],
  ));

  return { docs, terms, postings };
}
