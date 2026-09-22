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

export { newBlockId, slugify, today } from '../ids.ts';
