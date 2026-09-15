import type { ImageMetadata } from 'astro';

/**
 * Content images live outside the app, in the record directory beside the
 * markdown that references them. Astro's image pipeline needs real module
 * imports to optimise them, so the whole content media tree is globbed once at
 * build and indexed by its content-relative path.
 *
 * Eager loading is intentional: these modules resolve to metadata objects, not
 * pixels, and the index has to exist synchronously while a page renders.
 */
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../../../../content/**/media/*.{png,jpg,jpeg,webp,avif,gif}',
  { eager: true },
);

const index = new Map<string, ImageMetadata>();
for (const [path, module] of Object.entries(modules)) {
  const key = path.slice(path.indexOf('/content/') + '/content/'.length);
  index.set(key, module.default);
}

export type RecordKind = 'posts' | 'projects';

export interface ResolvedImage {
  /** An optimisable asset, or a URL for something already in `public/`. */
  source: ImageMetadata | string;
  optimisable: boolean;
}

/**
 * Resolves a content media reference. Returns null rather than throwing —
 * a missing file is a validation error reported by `validateCorpus`, and one
 * broken image should not take the whole build down with a stack trace.
 */
export function resolveImage(
  kind: RecordKind,
  slug: string,
  src: string,
): ResolvedImage | null {
  if (src.startsWith('/images/')) {
    return { source: src, optimisable: false };
  }

  if (!src.startsWith('./media/')) return null;

  const asset = index.get(`${kind}/${slug}/${src.slice('./'.length)}`);
  return asset ? { source: asset, optimisable: true } : null;
}

/** True when the reference points at something the build knows about. */
export function hasImage(kind: RecordKind, slug: string, src: string): boolean {
  return resolveImage(kind, slug, src) !== null;
}
