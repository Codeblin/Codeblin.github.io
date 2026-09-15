import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

import { repositoryRoot, toRepositoryPath } from '@codeblin/content';

const execFile = promisify(execFileCallback);

const GIT_TIMEOUT_MS = 30_000;

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
    const err = error as { stdout?: string; stderr?: string; message: string };
    const detail = (err.stderr || err.stdout || err.message).trim();
    throw new Error(detail || 'git failed');
  }
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

/** Stage only the given repository-relative paths. */
export async function stage(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const relative = paths.map((entry) => toRepositoryPath(entry));
  await git(['add', '--', ...relative]);
}

export async function commit(message: string): Promise<string> {
  const trimmed = message.trim();
  if (trimmed.length < 3 || trimmed.length > 72) {
    throw new Error('Commit message must be 3–72 characters.');
  }
  if (trimmed.startsWith('-')) throw new Error('Commit message cannot look like a flag.');
  await git(['commit', '-m', trimmed]);
  const { stdout } = await git(['rev-parse', '--short', 'HEAD']);
  return stdout.trim();
}

export async function push(): Promise<void> {
  await git(['push']);
}
