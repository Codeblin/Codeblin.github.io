/**
 * Copy the latin variable fonts from Fontsource into the public/fonts trees
 * under the stable names that fonts.css and Base.astro preload.
 *
 * Subsetting Martian Mono to labels-only is a TODO(phase-7): the full latin
 * file is used until a subsetter is wired into CI.
 */

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  ['node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', 'archivo-display.woff2'],
  ['node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2', 'newsreader-body.woff2'],
  ['node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2', 'newsreader-body-italic.woff2'],
  ['node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2', 'martian-label.woff2'],
  ['node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'plex-mono-400.woff2'],
  ['node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', 'plex-mono-600.woff2'],
];

const destinations = [
  path.join(root, 'apps/web/public/fonts'),
  path.join(root, 'apps/cms/public/fonts'),
];

let copied = 0;
for (const dest of destinations) {
  mkdirSync(dest, { recursive: true });
  for (const [from, to] of files) {
    const source = path.join(root, from);
    if (!existsSync(source)) {
      console.warn(`missing ${from}`);
      continue;
    }
    copyFileSync(source, path.join(dest, to));
    copied += 1;
  }
}

console.log(`Copied ${copied} font files into ${destinations.length} public trees.`);
