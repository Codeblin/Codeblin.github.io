/**
 * Page interactions: copy buttons, table-of-contents tracking, and the mobile
 * navigation bar. All delegated or observer-based, so nothing scales with the
 * number of blocks on the page.
 */

const COPY_RESET_MS = 1600;

/**
 * One listener for every copy control on the page. The text comes from the
 * element the button points at, read out of the DOM at click time.
 */
export function initCopy(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-copy-for]');
    if (!button) return;

    const source = document.getElementById(button.dataset['copyFor'] ?? '');
    if (!source) return;

    void navigator.clipboard
      .writeText(source.textContent ?? '')
      .then(() => setState(button, 'copied'))
      .catch(() => setState(button, 'failed'));
  });
}

function setState(button: HTMLButtonElement, state: 'copied' | 'failed'): void {
  button.dataset['state'] = state;
  window.setTimeout(() => delete button.dataset['state'], COPY_RESET_MS);
}

/**
 * Marks the table-of-contents entry for the section the reader is in.
 * A heading stays current from the moment it crosses the reading line
 * until the next heading does. Clicks pin the target so the previous
 * entry cannot linger while smooth-scroll is still catching up.
 */
export function initTableOfContents(): void {
  const nav = document.querySelector<HTMLElement>('[data-toc]');
  if (!nav) return;

  const links = new Map<string, HTMLAnchorElement>();
  for (const link of nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    links.set(decodeURIComponent(link.hash.slice(1)), link);
  }
  if (links.size === 0) return;

  const headings = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);

  if (headings.length === 0) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pinnedId: string | null = null;
  let pinTimer = 0;
  let ticking = false;

  const readingLine = (): number => {
    const margin = Number.parseFloat(
      getComputedStyle(headings[0]!).scrollMarginBlockStart,
    );
    return Number.isFinite(margin) ? margin + 1 : 72;
  };

  const setCurrent = (currentId: string): void => {
    for (const [id, link] of links) {
      link.toggleAttribute('data-current', id === currentId);
    }
  };

  const spy = (): void => {
    if (pinnedId) {
      ticking = false;
      return;
    }
    const line = readingLine();
    let current = headings[0]!;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= line) current = heading;
      else break;
    }
    setCurrent(current.id);
    ticking = false;
  };

  const unpin = (): void => {
    pinnedId = null;
    spy();
  };

  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;

    const id = decodeURIComponent(link.hash.slice(1));
    const heading = document.getElementById(id);
    if (!heading) return;

    event.preventDefault();
    pinnedId = id;
    setCurrent(id);
    window.clearTimeout(pinTimer);
    heading.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
    history.pushState(null, '', `#${id}`);
    pinTimer = window.setTimeout(unpin, reduced ? 0 : 900);
  });

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(spy);
    },
    { passive: true },
  );

  spy();
}

/**
 * The mobile bar retreats while reading down and returns on any upward
 * movement, so it is never in the way but is always one gesture away.
 * The viewport bezel's bottom edge is rewritten from the bar's live
 * bounding box so the frame tracks the slide, not a guessed inset.
 */
export function initMobileBar(): void {
  const bar = document.querySelector<HTMLElement>('[data-mobile-bar]');
  const bezel = document.querySelector<HTMLElement>('[data-bezel]');
  if (!bar) return;

  const compact = window.matchMedia('(width < 48rem)');
  let last = window.scrollY;
  let ticking = false;
  let follow = 0;
  let followTimer = 0;

  const syncBezel = (): void => {
    if (!bezel) return;
    if (!compact.matches) {
      bezel.style.insetBlockEnd = '';
      return;
    }
    const fromBottom = window.innerHeight - bar.getBoundingClientRect().top;
    bezel.style.insetBlockEnd = `${Math.max(4, fromBottom)}px`;
  };

  const stopFollow = (): void => {
    cancelAnimationFrame(follow);
    window.clearTimeout(followTimer);
    follow = 0;
    syncBezel();
  };

  const followNav = (): void => {
    syncBezel();
    follow = requestAnimationFrame(followNav);
  };

  const startFollow = (): void => {
    if (!compact.matches) {
      stopFollow();
      return;
    }
    window.clearTimeout(followTimer);
    if (follow === 0) followNav();
    followTimer = window.setTimeout(stopFollow, 500);
  };

  const setRetracted = (retracted: boolean): void => {
    const next = retracted && compact.matches;
    if (bar.hasAttribute('data-retracted') === next) return;
    bar.toggleAttribute('data-retracted', next);
    startFollow();
  };

  const update = (): void => {
    const current = window.scrollY;
    const delta = current - last;
    if (Math.abs(delta) > 6) {
      setRetracted(delta > 0 && current > 160);
      last = current;
    }
    ticking = false;
  };

  bar.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform') stopFollow();
  });

  compact.addEventListener('change', () => {
    if (!compact.matches) setRetracted(false);
    syncBezel();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );

  syncBezel();
}

/** Expands and collapses the article metadata sheet on small screens. */
export function initMetaSheet(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-meta-toggle]');
  const sheet = document.getElementById('article-meta-sheet');
  if (!toggle || !sheet) return;

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    sheet.toggleAttribute('hidden', open);
  });
}
