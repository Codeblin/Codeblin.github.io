import type { Meta } from '../api.ts';
import { issueClass } from '../issues.ts';

interface Props {
  meta: Meta | null;
  go: (to: string) => void;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function Dashboard({ meta, go }: Props): React.ReactElement {
  if (!meta) return <p className="empty">Loading instrument state…</p>;

  const { counts, recent, draftAges, validation, commits } = meta;

  return (
    <div className="stack" style={{ display: 'grid', gap: '1.5rem' }}>
      <section className="grid-cards">
        {[
          ['Posts', counts.posts],
          ['Published', counts.published],
          ['Drafts', counts.drafts],
          ['Projects', counts.projects],
          ['Categories', counts.categories],
          ['Tags', counts.tags],
        ].map(([label, value]) => (
          <article className="panel" key={label}>
            <div className="stat__n">{pad(Number(value))}</div>
            <div className="stat__k">{label}</div>
          </article>
        ))}
      </section>

      <section className="panel">
        <p className="stat__k">Recent published</p>
        {recent.length === 0 ? (
          <p className="empty">Nothing published yet.</p>
        ) : (
          <table className="rows">
            <tbody>
              {recent.map((item) => (
                <tr key={item.slug} onClick={() => go(`/posts/${item.slug}`)} style={{ cursor: 'pointer' }}>
                  <td>//{item.record.toString().padStart(4, '0')}</td>
                  <td>{item.title}</td>
                  <td>{item.publishedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <p className="stat__k">Drafts</p>
        {draftAges.length === 0 ? (
          <p className="empty">No open drafts.</p>
        ) : (
          <table className="rows">
            <tbody>
              {draftAges.map((item) => (
                <tr key={item.slug} onClick={() => go(`/posts/${item.slug}`)} style={{ cursor: 'pointer' }}>
                  <td>{item.title}</td>
                  <td>{item.updatedAt ?? 'undated'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <p className="stat__k">
          Validation — {validation.errorCount} errors, {validation.warningCount} warnings
          {validation.infoCount ? `, ${validation.infoCount} notes` : ''}
        </p>
        {validation.issues.length === 0 ? (
          <p className="empty">Corpus is clean.</p>
        ) : (
          <div className="issues">
            {validation.issues.slice(0, 20).map((issue, index) => (
              <p key={`${issue.record}-${index}`} className={issueClass(issue.level)}>
                {issue.level.toUpperCase()} {issue.record} — {issue.message}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="stat__k">Git log</p>
        {commits.length === 0 ? (
          <p className="empty">No commits in this repository yet.</p>
        ) : (
          <table className="rows">
            <tbody>
              {commits.map((commit) => (
                <tr key={commit.hash}>
                  <td>{commit.hash}</td>
                  <td>{commit.subject}</td>
                  <td>{commit.at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
