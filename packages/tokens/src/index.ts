/**
 * TypeScript mirror of the tokens that JavaScript genuinely needs.
 *
 * This is not a copy of `tokens.css` — duplicating the whole palette here
 * would guarantee drift. Only values consumed by scripted behaviour live in
 * this file: motion timings used by the decode and stagger utilities, the
 * breakpoints used by matchMedia, and the palette entries needed to generate
 * the Shiki theme and OpenGraph images at build time.
 */

export const duration = {
  d1: 90,
  d2: 140,
  d3: 220,
  d4: 340,
  d5: 560,
  d6: 900,
  stagger: 30,
} as const;

export const easing = {
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  std: 'cubic-bezier(0.4, 0, 0.2, 1)',
  snap: 'cubic-bezier(0.2, 0.9, 0.25, 1)',
} as const;

/** Matches the `min-width` breakpoints used across the stylesheets. */
export const breakpoint = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1440,
} as const;

/**
 * Palette entries required outside CSS: the Shiki theme generator and the
 * OpenGraph image renderer cannot read custom properties.
 */
export const palette = {
  void: '#08080a',
  tar: '#0c0c10',
  slate: '#131318',
  carbon: '#1a1a20',
  hair: '#23232b',
  hairLit: '#373742',
  bone: '#e9e5dc',
  ash: '#9b9b93',
  dust: '#6b6b66',
  ghost: '#43433f',
  sulfur: '#cfd84e',
  sulfurInk: '#0a0a08',
} as const;

export const severity = {
  info: '#8e8e88',
  low: '#6fa8ff',
  medium: '#e0a73c',
  high: '#ff8a3d',
  critical: '#ff4438',
} as const;

export type SeverityKey = keyof typeof severity;
