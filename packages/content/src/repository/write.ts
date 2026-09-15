import { copyFileSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { assertInsideContent } from './paths.ts';

/**
 * Write a file inside `content/` without leaving a half-written original
 * behind. On Windows `rename` cannot replace an existing file, so we fall
 * back to copy + unlink — still never truncated in place.
 */
export function atomicWrite(absolute: string, contents: string): void {
  const resolved = assertInsideContent(absolute);
  mkdirSync(path.dirname(resolved), { recursive: true });
  const tmp = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.tmp`,
  );
  writeFileSync(tmp, contents, 'utf8');
  try {
    renameSync(tmp, resolved);
  } catch {
    copyFileSync(tmp, resolved);
    unlinkSync(tmp);
  }
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'untitled';
}

export function newBlockId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Calendar date in the author's timezone, YYYY-MM-DD. */
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
