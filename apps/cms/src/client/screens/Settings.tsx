import { type ReactElement } from 'react';

import { api, type Meta } from '../api.ts';

interface Props {
  meta: Meta | null;
  onToast: (toast: { text: string; fail?: boolean }) => void;
  publishingAll: boolean;
  canPublishAll: boolean;
  onPublishAll: () => void;
}

function contentPaths(dirty: readonly string[]): string[] {
  return dirty.filter((path) =>
    path
      .replace(/\\/g, '/')
      .split(' -> ')
      .some((part) => part.trim().startsWith('content/')),
  );
}

export function Settings({
  meta,
  onToast,
  publishingAll,
  canPublishAll,
  onPublishAll,
}: Props): ReactElement {
  const pending = contentPaths(meta?.git.dirty ?? []);

  const push = async (): Promise<void> => {
    try {
      await api.push();
      onToast({ text: 'Pushed' });
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Push failed', fail: true });
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem', maxInlineSize: '42rem' }}>
      <section className="panel">
        <p className="stat__k">Instrument</p>
        <p style={{ marginTop: '0.8rem', fontFamily: 'var(--font-body)', color: 'var(--ash)', lineHeight: 1.6 }}>
          SUBSTRATE is local-only. It binds 127.0.0.1, never stores tokens, and runs git through a
          fixed argument list. Preview is the real Astro site at {meta?.preview ?? 'http://127.0.0.1:4321'}.
        </p>
      </section>
      <section className="panel">
        <p className="stat__k">Git</p>
        <p style={{ margin: '0.6rem 0', color: 'var(--dust)' }}>
          {meta?.git.branch ?? '—'} · {meta?.git.dirty.length ?? 0} dirty · {meta?.git.lastCommit ?? 'no commit'}
        </p>
        <p style={{ margin: '0 0 0.8rem', color: 'var(--ash)', lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>
          Publish all commits and pushes every change under content/ — new posts, edits, taxonomy,
          and deletions. Per-post Publish to GitHub cannot send a deleted record.
        </p>
        <div className="form-row">
          <button
            type="button"
            className="primary"
            disabled={!canPublishAll || publishingAll}
            onClick={onPublishAll}
          >
            {publishingAll ? 'Publishing…' : 'Publish all to GitHub'}
          </button>
          <button type="button" onClick={() => void push()}>
            Push current branch
          </button>
        </div>
        {pending.length > 0 && (
          <ul className="empty" style={{ margin: '0.8rem 0 0', paddingInlineStart: '1.1rem' }}>
            {pending.map((path) => (
              <li key={path} style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--fs-code)' }}>
                {path}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <p className="stat__k">Shortcuts</p>
        <table className="rows">
          <tbody>
            <tr>
              <td>Ctrl/⌘ S</td>
              <td>Save locally (disk only)</td>
            </tr>
            <tr>
              <td>Ctrl/⌘ Shift P</td>
              <td>Publish to GitHub</td>
            </tr>
            <tr>
              <td>/</td>
              <td>Insert block (from a selected block)</td>
            </tr>
            <tr>
              <td>Alt ↑ / Alt ↓</td>
              <td>Move block</td>
            </tr>
            <tr>
              <td>Ctrl/⌘ Z</td>
              <td>Undo</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
