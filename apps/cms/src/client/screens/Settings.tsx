import { api, type Meta } from '../api.ts';

interface Props {
  meta: Meta | null;
  onToast: (toast: { text: string; fail?: boolean }) => void;
}

export function Settings({ meta, onToast }: Props): React.ReactElement {
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
        <button type="button" onClick={() => void push()}>
          Push current branch
        </button>
      </section>
      <section className="panel">
        <p className="stat__k">Shortcuts</p>
        <table className="rows">
          <tbody>
            <tr>
              <td>Ctrl/⌘ S</td>
              <td>Save</td>
            </tr>
            <tr>
              <td>Ctrl/⌘ Shift P</td>
              <td>Publish</td>
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
