import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

import { repositoryRoot, toRepositoryPath } from '@codeblin/content';

const execFile = promisify(execFileCallback);

const GIT_TIMEOUT_MS = 30_000;

export class GitError extends Error {
  constructor(
    message: string,
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = 'GitError';
  }
}

/**
 * Run a fixed git command. Arguments are an array — never interpolated into
 * a shell. The working directory is the repository root and nowhere else.
 */
export async function git(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFile('git', [...args], {
      cwd: repositoryRoot,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      encoding: 'utf8',
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string; code?: number | string; status?: number };
    const code = typeof err.code === 'number' ? err.code : typeof err.status === 'number' ? err.status : null;
    throw new GitError(explainGitFailure((err.stderr || err.stdout || err.message).trim()), code);
  }
}

export function explainGitFailure(detail: string): string {
  if (!detail) return 'git failed';
  if (/index\.lock/i.test(detail)) return 'Git is busy. Wait a moment and try again.';
  if (
    /nothing to commit/i.test(detail) ||
    /no changes added to commit/i.test(detail) ||
    /changes not staged for commit/i.test(detail)
  ) {
    return 'Nothing in this record changed since the last commit.';
  }
  const first = detail.split(/\r?\n/).find((line) => line.trim().length > 0) ?? 'git failed';
  return first.slice(0, 200);
}

export interface GitState {
  branch: string;
  dirty: string[];
  ahead: number;
  behind: number;
  lastCommit: string | null;
}

export async function readGitState(): Promise<GitState> {
  const [{ stdout: branch }, { stdout: porcelain }, log] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['status', '--porcelain=v1', '-b']),
    git(['log', '-1', '--format=%h %s']).catch(() => ({ stdout: '', stderr: '' })),
  ]);

  const lines = porcelain.split(/\r?\n/).filter(Boolean);
  const header = lines.find((line) => line.startsWith('## ')) ?? '';
  const aheadMatch = /ahead (\d+)/.exec(header);
  const behindMatch = /behind (\d+)/.exec(header);

  return {
    branch: branch.trim(),
    dirty: lines.filter((line) => !line.startsWith('## ')).map((line) => line.slice(3)),
    ahead: aheadMatch ? Number.parseInt(aheadMatch[1] ?? '0', 10) : 0,
    behind: behindMatch ? Number.parseInt(behindMatch[1] ?? '0', 10) : 0,
    lastCommit: log.stdout.trim() || null,
  };
}

export async function readRecentCommits(limit = 12): Promise<Array<{ hash: string; subject: string; at: string }>> {
  const { stdout } = await git(['log', `-n`, String(limit), '--format=%h%x09%s%x09%cI']).catch(() => ({
    stdout: '',
    stderr: '',
  }));
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, at] = line.split('\t');
      return { hash: hash ?? '', subject: subject ?? '', at: at ?? '' };
    });
}

function toGitPath(entry: string): string {
  const posix = entry.split('\\').join('/');
  if (posix.startsWith('content/')) return posix;
  return toRepositoryPath(entry);
}

/** Stage only the given repository-relative (or absolute) paths. */
export async function stage(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  await git(['add', '--', ...paths.map(toGitPath)]);
}

/** Stage one content record and nothing else — never apps/, packages/, or .cms/. */
export async function stageRecord(kind: 'posts' | 'projects', slug: string): Promise<string> {
  const relative = `content/${kind}/${slug}`;
  await git(['add', '-A', '--', relative]);
  return relative;
}

/** Stage the whole content tree, including deletions. Never apps/ or packages/. */
export async function stageContent(): Promise<string> {
  await git(['add', '-A', '--', 'content']);
  return 'content';
}

export function contentDirtyPaths(dirty: readonly string[]): string[] {
  return dirty.filter((entry) => {
    const path = entry.split('\\').join('/');
    if (path.includes(' -> ')) {
      return path.split(' -> ').some((part) => part.trim().startsWith('content/'));
    }
    return path.startsWith('content/');
  });
}

export async function hasStagedChanges(path?: string): Promise<boolean> {
  const args = ['diff', '--cached', '--quiet'];
  if (path) args.push('--', path);
  try {
    await git(args);
    return false;
  } catch (error) {
    if (error instanceof GitError && error.code === 1) return true;
    throw error;
  }
}

export async function commit(message: string, paths?: readonly string[]): Promise<string> {
  const trimmed = message.trim();
  if (trimmed.length < 3 || trimmed.length > 72) {
    throw new Error('Commit message must be 3–72 characters.');
  }
  if (trimmed.startsWith('-')) throw new Error('Commit message cannot look like a flag.');
  const args = ['commit', '-m', trimmed];
  if (paths && paths.length > 0) args.push('--', ...paths);
  await git(args);
  const { stdout } = await git(['rev-parse', '--short', 'HEAD']);
  return stdout.trim();
}

export async function push(): Promise<void> {
  await git(['push']);
}

let gitChain: Promise<void> = Promise.resolve();

/** One git mutation at a time so publish/unpublish cannot race the index. */
export function withGitLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = gitChain.then(fn, fn);
  gitChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function publishCommitMessage(
  kind: 'posts' | 'projects',
  title: string,
  as: 'live' | 'draft' = 'live',
): string {
  const prefix =
    as === 'draft' ? (kind === 'posts' ? 'Draft' : 'Unpublish project') : kind === 'posts' ? 'Publish' : 'Publish project';
  const raw = `${prefix} ${title}`.replace(/\s+/g, ' ').trim();
  return raw.length <= 72 ? raw : `${raw.slice(0, 69)}...`;
}

export function sitePublishMessage(paths: readonly string[]): string {
  if (paths.length === 0) return 'Publish all content changes';
  const unique = [...new Set(paths.map((path) => path.replace(/\\/g, '/')))];
  const raw = unique.length === 1 ? `Publish ${unique[0]}` : `Publish ${unique.length} content changes`;
  return raw.length <= 72 ? raw : 'Publish all content changes';
}
