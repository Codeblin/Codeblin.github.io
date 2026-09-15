/**
 * Cross-document view transitions for post/project titles.
 *
 * Names are assigned at navigation time, never parked on a scrolling grid.
 * The article/project headline keeps a CSS name because there is only one.
 * Listing titles pick up the same name on click / pageswap / pagereveal so
 * Chromium can morph the type to (and back from) the destination headline.
 */

const POST_NAME = 'vt-post-title';
const PROJECT_NAME = 'vt-project-name';

type Kind = 'post' | 'project';

interface NamedDest {
  kind: Kind;
  slug: string;
  name: string;
}

interface NavigationActivationLike {
  from?: { url: string } | null;
  entry?: { url: string } | null;
}

interface ViewTransitionLike {
  finished: Promise<unknown>;
}

interface MpaTransitionEvent extends Event {
  viewTransition?: ViewTransitionLike | null;
  activation?: NavigationActivationLike | null;
}

const reduced = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pathOf(url: string | undefined | null): string {
  if (!url) return '';
  try {
    return new URL(url, window.location.href).pathname;
  } catch {
    return '';
  }
}

export function destFromPath(pathname: string): NamedDest | null {
  const post = pathname.match(/^\/research\/([^/]+)\/?$/);
  if (post?.[1]) return { kind: 'post', slug: post[1], name: POST_NAME };
  const project = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (project?.[1]) return { kind: 'project', slug: project[1], name: PROJECT_NAME };
  return null;
}

function listingTitle(kind: Kind, slug: string): HTMLElement | null {
  const safe = typeof CSS !== 'undefined' && 'escape' in CSS ? CSS.escape(slug) : slug;
  return document.querySelector(`[data-vt-kind="${kind}"][data-vt-slug="${safe}"] [data-vt-title]`);
}

function clearListingNames(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-vt-kind] [data-vt-title]')) {
    element.style.viewTransitionName = '';
  }
}

function disarmPageTitles(): void {
  for (const element of document.querySelectorAll<HTMLElement>('.article__title, .project-page__name')) {
    element.style.viewTransitionName = 'none';
  }
}

function assignListing(kind: Kind, slug: string, name: string): HTMLElement | null {
  const element = listingTitle(kind, slug);
  if (!element) return null;
  element.style.viewTransitionName = name;
  return element;
}

function sameDocument(url: URL): boolean {
  return url.origin === window.location.origin && url.pathname === window.location.pathname;
}

export function initViewTransitions(): void {
  if (reduced()) return;

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor || !anchor.href || anchor.target === '_blank' || anchor.hasAttribute('download')) {
      return;
    }

    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || sameDocument(url)) return;

    const dest = destFromPath(url.pathname);
    if (!dest) return;

    clearListingNames();
    if (destFromPath(window.location.pathname)) disarmPageTitles();

    const local = anchor.closest('[data-vt-kind]')?.querySelector<HTMLElement>('[data-vt-title]');
    if (local) local.style.viewTransitionName = dest.name;
    else assignListing(dest.kind, dest.slug, dest.name);
  });

  window.addEventListener('pageswap', (event) => {
    const transitionEvent = event as MpaTransitionEvent;
    if (!transitionEvent.viewTransition) return;

    const dest = destFromPath(pathOf(transitionEvent.activation?.entry?.url));
    if (!dest) return;

    if (destFromPath(window.location.pathname)) disarmPageTitles();
    const existing = listingTitle(dest.kind, dest.slug);
    if (existing?.style.viewTransitionName === dest.name) return;
    clearListingNames();
    assignListing(dest.kind, dest.slug, dest.name);
  });

  window.addEventListener('pagereveal', (event) => {
    const transitionEvent = event as MpaTransitionEvent;
    if (!transitionEvent.viewTransition) return;

    const from = destFromPath(pathOf(transitionEvent.activation?.from?.url));
    if (!from || destFromPath(window.location.pathname)) return;

    const named = assignListing(from.kind, from.slug, from.name);
    void transitionEvent.viewTransition.finished.finally(() => {
      if (named) named.style.viewTransitionName = '';
    });
  });
}
