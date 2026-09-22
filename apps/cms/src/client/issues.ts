import type { Issue } from './api.ts';

export function issueClass(level: Issue['level']): string {
  if (level === 'error') return 'err';
  if (level === 'warning') return 'warn';
  return 'info';
}
