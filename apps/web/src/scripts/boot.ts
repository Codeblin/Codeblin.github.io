import {
  initCopy,
  initMetaSheet,
  initMobileBar,
  initTableOfContents,
} from './interactions.ts';
import { initFeed } from './feed.ts';
import { initDecode } from './motion.ts';
import { initSearchShortcut } from './search.ts';
import { initViewTransitions } from './view-transitions.ts';

/**
 * Single entry point for the site's client behaviour.
 *
 * Reveal-on-scroll stays unwired: mutating cards as they enter the viewport
 * was a source of scroll hitching. Decode is capped to short label-mono
 * strings (homepage index line, 404 readout, search status).
 */
initCopy();
initTableOfContents();
initMobileBar();
initSearchShortcut();
initMetaSheet();
initDecode();
initViewTransitions();
initFeed();
