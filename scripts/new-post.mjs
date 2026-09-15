/**
 * Scaffold a new draft post from the command line.
 *
 *   npm run new:post -- "The title" --category mobile-security
 */

import { createPost, readTaxonomy } from '@codeblin/content';

const args = process.argv.slice(2);
const titleParts = [];
let category = readTaxonomy().categories[0]?.slug;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--category') {
    category = args[index + 1];
    index += 1;
    continue;
  }
  titleParts.push(arg);
}

const title = titleParts.join(' ').trim();
if (!title || !category) {
  console.error('Usage: npm run new:post -- "Title" --category <slug>');
  process.exit(1);
}

const created = createPost({ title, category });
console.log(`Created posts/${created.slug}  record //${String(created.record).padStart(4, '0')}`);
