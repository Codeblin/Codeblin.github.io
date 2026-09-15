import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Path resolution for the content store.
 *
 * Every filesystem access in this package goes through here, and every path
 * that comes from outside the process is checked with `assertInsideContent`
 * before it is opened. That single choke point is what keeps the CMS from
 * being able to read or write anywhere else on the machine.
 */

const ROOT_MARKER = 'codeblin';

function findRepositoryRoot(): string {
  const override = process.env['CODEBLIN_ROOT'];
  if (override) return path.resolve(override);

  let current = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12; depth += 1) {
    const manifest = path.join(current, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string };
        if (parsed.name === ROOT_MARKER) return current;
      } catch {
        // A malformed package.json higher up the tree is not our problem.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    'Could not locate the repository root. Set CODEBLIN_ROOT to the directory containing content/.',
  );
}

export const repositoryRoot = findRepositoryRoot();
export const contentRoot = path.join(repositoryRoot, 'content');
export const postsRoot = path.join(contentRoot, 'posts');
export const projectsRoot = path.join(contentRoot, 'projects');
export const pagesRoot = path.join(contentRoot, 'pages');
export const taxonomyFile = path.join(contentRoot, 'taxonomy.json');

export const DOCUMENT_FILENAME = 'index.md';
export const MEDIA_DIRNAME = 'media';

export function postDirectory(slug: string): string {
  return path.join(postsRoot, slug);
}

export function projectDirectory(slug: string): string {
  return path.join(projectsRoot, slug);
}

export function documentFile(directory: string): string {
  return path.join(directory, DOCUMENT_FILENAME);
}

export function mediaDirectory(directory: string): string {
  return path.join(directory, MEDIA_DIRNAME);
}

/**
 * Throws unless `candidate` resolves to something inside `content/`. Symlinks
 * are not followed, so a link planted inside the content tree cannot be used
 * to escape it.
 */
export function assertInsideContent(candidate: string): string {
  const resolved = path.resolve(candidate);
  const relative = path.relative(contentRoot, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch a path outside content/: ${candidate}`);
  }
  return resolved;
}

/** Repository-relative POSIX path, for git commands and log output. */
export function toRepositoryPath(absolute: string): string {
  return path.relative(repositoryRoot, absolute).split(path.sep).join('/');
}
