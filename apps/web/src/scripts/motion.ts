/**
 * The two motions that genuinely need JavaScript.
 *
 * Everything else in the system is CSS. `reveal` needs to know when an element
 * enters the viewport; `decode` needs per-character timing. Both are inert
 * when the visitor has asked for reduced motion.
 *
 * Decode is restricted to short label-mono strings. Rewriting a display
 * headline every frame (the old homepage statement) is what made first paint
 * feel like the page was hitching.
 */

const reduced = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAGGER_MS = 18;
const STAGGER_CAP = 8;
const DECODE_MAX_CHARS = 48;

/**
 * Reveals `[data-reveal]` elements as they scroll in. Elements sharing a
 * `data-reveal-group` enter in sequence, capped so a long archive does not
 * cascade. The CSS no longer hides unrevealed nodes — the stagger is a
 * brightness lift, not an opacity-0 pop that flickered on scroll.
 */
export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  if (reduced() || !('IntersectionObserver' in window)) {
    for (const element of targets) element.dataset['revealed'] = '';
    return;
  }

  const counters = new Map<string, number>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        const group = element.dataset['revealGroup'] ?? 'default';
        const position = counters.get(group) ?? 0;
        counters.set(group, position + 1);
        element.style.setProperty(
          '--reveal-delay',
          `${Math.min(position, STAGGER_CAP) * STAGGER_MS}ms`,
        );
        element.dataset['revealed'] = '';
        observer.unobserve(element);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );

  for (const element of targets) observer.observe(element);
}

const GLYPHS = '0123456789ABCDEF/\\<>[]{}#$%&*+=-_~^';

/**
 * Resolves text through a brief glyph scramble, left to right.
 *
 * Used on short index lines and the 404 status — never on display headlines.
 */
export function decode(element: HTMLElement, duration = 280): void {
  const original = element.textContent ?? '';
  if (original.length === 0 || original.length > DECODE_MAX_CHARS || reduced()) {
    return;
  }

  const characters = [...original];
  const start = performance.now();
  element.setAttribute('aria-label', original);

  const frame = (now: number): void => {
    const progress = Math.min(1, (now - start) / duration);
    const front = progress * 1.35 * characters.length;

    element.textContent = characters
      .map((character, index) => {
        if (character === ' ' || index < front - 1) return character;
        if (index > front + 3) return character;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? character;
      })
      .join('');

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      element.textContent = original;
      element.removeAttribute('aria-label');
    }
  };

  requestAnimationFrame(frame);
}

/** Runs `decode` once per element marked `[data-decode]`, when it is visible. */
export function initDecode(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-decode]');
  if (targets.length === 0 || reduced()) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      decode(entry.target as HTMLElement);
      observer.unobserve(entry.target);
    }
  });

  for (const element of targets) observer.observe(element);
}
