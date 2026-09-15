/**
 * Publication-level configuration.
 *
 * Everything here is identity or deployment detail, not content. Content lives
 * in `content/`; this file describes the publication that carries it.
 */

// TODO(setup): replace with the real domain before the first deploy. The value
// must match the Pages custom domain, or canonical URLs and RSS will be wrong.
const SITE_URL = 'https://codeblin.dev';

export const site = {
  url: SITE_URL,
  /** Wordmark. Always rendered uppercase; stored uppercase to avoid surprises. */
  title: 'CODEBLIN',
  /** The standing line beneath the wordmark. */
  standing: 'SECURITY RESEARCH // ARCHIVE',
  description:
    'Independent research on mobile and application security: Android internals, reverse engineering, malware analysis, and the tooling around them.',
  language: 'en',
  locale: 'en_GB',
} as const;

export const author = {
  name: 'Codeblin',
  role: 'Senior software engineer · application & mobile security',
  email: 'codeblin.coffee@gmail.com',
  github: 'https://github.com/codeblin',
} as const;

export interface NavItem {
  label: string;
  href: string;
  /** Two-letter code shown in the mobile bar and the masthead index. */
  code: string;
}

export const navigation: readonly NavItem[] = [
  { label: 'Research', href: '/research/', code: 'RS' },
  { label: 'Projects', href: '/projects/', code: 'PJ' },
  { label: 'Archive', href: '/archive/', code: 'AR' },
  { label: 'About', href: '/about/', code: 'AB' },
] as const;

export const social: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'GitHub', href: author.github },
  { label: 'RSS', href: '/rss.xml' },
] as const;

/** How many records each listing shows before paging or truncation. */
export const listing = {
  homepageRecent: 6,
  homepageProjects: 3,
  relatedPosts: 3,
  /** Stagger reveals stop after this many rows; see DESIGN.md §8. */
  staggerCap: 12,
} as const;
