import type { Block } from '@codeblin/content';

interface Props {
  block: Block;
  onChange: (block: Block) => void;
  onSlash?: () => void;
}

export function BlockForm({ block, onChange, onSlash }: Props): React.ReactElement {
  switch (block.type) {
    case 'prose':
      return (
        <textarea
          rows={6}
          value={block.markdown}
          onChange={(event) => onChange({ ...block, markdown: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === '/' && block.markdown.length === 0) {
              event.preventDefault();
              onSlash?.();
            }
          }}
          placeholder="Write. / inserts a block."
        />
      );
    case 'heading':
      return (
        <div className="form-row">
          <label>
            Level
            <select
              value={block.level}
              onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 | 4 })}
            >
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Text
            <input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
          </label>
        </div>
      );
    case 'code':
      return (
        <div className="meta-grid">
          <div className="form-row">
            <label>
              Language
              <input value={block.lang} onChange={(event) => onChange({ ...block, lang: event.target.value })} />
            </label>
            <label>
              Filename
              <input
                value={block.filename ?? ''}
                onChange={(event) => onChange({ ...block, filename: event.target.value || undefined })}
              />
            </label>
          </div>
          <textarea
            rows={10}
            value={block.source}
            onChange={(event) => onChange({ ...block, source: event.target.value })}
            spellCheck={false}
          />
        </div>
      );
    case 'terminal':
      return (
        <div className="meta-grid">
          <label>
            Host
            <input
              value={block.host ?? ''}
              onChange={(event) => onChange({ ...block, host: event.target.value || undefined })}
            />
          </label>
          <textarea
            rows={8}
            spellCheck={false}
            value={block.lines
              .map((line) => (line.kind === 'prompt' ? `$ ${line.text}` : line.kind === 'comment' ? `# ${line.text}` : line.text))
              .join('\n')}
            onChange={(event) =>
              onChange({
                ...block,
                lines: event.target.value.split('\n').map((text) => {
                  if (text.startsWith('$ ')) return { kind: 'prompt' as const, text: text.slice(2) };
                  if (text.startsWith('# ')) return { kind: 'comment' as const, text: text.slice(2) };
                  return { kind: 'output' as const, text };
                }),
              })
            }
          />
        </div>
      );
    case 'http':
      return (
        <div className="meta-grid">
          <label>
            Direction
            <select
              value={block.direction}
              onChange={(event) =>
                onChange({ ...block, direction: event.target.value as 'request' | 'response' })
              }
            >
              <option value="request">request</option>
              <option value="response">response</option>
            </select>
          </label>
          <textarea
            rows={10}
            spellCheck={false}
            value={block.source}
            onChange={(event) => onChange({ ...block, source: event.target.value })}
          />
        </div>
      );
    case 'quote':
      return (
        <div className="meta-grid">
          <textarea rows={4} value={block.body} onChange={(event) => onChange({ ...block, body: event.target.value })} />
          <label>
            Cite
            <input
              value={block.cite ?? ''}
              onChange={(event) => onChange({ ...block, cite: event.target.value || undefined })}
            />
          </label>
        </div>
      );
    case 'list':
      return (
        <div className="meta-grid">
          <label>
            Ordered
            <select
              value={block.ordered ? 'yes' : 'no'}
              onChange={(event) => onChange({ ...block, ordered: event.target.value === 'yes' })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <textarea
            rows={6}
            value={block.items.join('\n')}
            onChange={(event) => onChange({ ...block, items: event.target.value.split('\n') })}
          />
        </div>
      );
    case 'table':
      return (
        <textarea
          rows={6}
          value={[block.head.join('\t'), ...block.rows.map((row) => row.join('\t'))].join('\n')}
          onChange={(event) => {
            const lines = event.target.value.split('\n');
            const head = (lines[0] ?? '').split('\t');
            const rows = lines.slice(1).map((line) => line.split('\t'));
            onChange({ ...block, head, rows });
          }}
        />
      );
    case 'command':
      return (
        <div className="meta-grid">
          <input value={block.value} onChange={(event) => onChange({ ...block, value: event.target.value })} />
          <label>
            Note
            <input
              value={block.note ?? ''}
              onChange={(event) => onChange({ ...block, note: event.target.value || undefined })}
            />
          </label>
        </div>
      );
    case 'filetree':
      return (
        <div className="meta-grid">
          <label>
            Root
            <input value={block.root} onChange={(event) => onChange({ ...block, root: event.target.value })} />
          </label>
          <textarea
            rows={8}
            spellCheck={false}
            value={block.entries
              .map((entry) => `${'  '.repeat(entry.depth)}${entry.directory ? `${entry.name}/` : entry.name}${entry.note ? ` @ ${entry.note}` : ''}`)
              .join('\n')}
            onChange={(event) =>
              onChange({
                ...block,
                entries: event.target.value.split('\n').filter(Boolean).map((line) => {
                  const trimmed = line.trimStart();
                  const depth = Math.floor((line.length - trimmed.length) / 2);
                  const [namePart, note] = trimmed.split(' @ ');
                  const directory = (namePart ?? '').endsWith('/');
                  return {
                    name: directory ? (namePart ?? '').slice(0, -1) : (namePart ?? ''),
                    depth,
                    directory,
                    note,
                  };
                }),
              })
            }
          />
        </div>
      );
    case 'diagram':
      return (
        <textarea
          rows={6}
          spellCheck={false}
          value={block.source}
          onChange={(event) => onChange({ ...block, source: event.target.value })}
        />
      );
    case 'divider':
      return (
        <select
          value={block.variant}
          onChange={(event) => onChange({ ...block, variant: event.target.value as typeof block.variant })}
        >
          <option value="rule">rule</option>
          <option value="dots">dots</option>
          <option value="gap">gap</option>
        </select>
      );
    case 'image':
      return (
        <div className="meta-grid">
          <label>
            Src
            <input value={block.src} onChange={(event) => onChange({ ...block, src: event.target.value })} />
          </label>
          <label>
            Alt
            <input value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} />
          </label>
          <label>
            Caption
            <input
              value={block.caption ?? ''}
              onChange={(event) => onChange({ ...block, caption: event.target.value || undefined })}
            />
          </label>
        </div>
      );
    case 'finding':
      return (
        <div className="meta-grid">
          <div className="form-row">
            <label>
              ID
              <input
                value={block.findingId ?? ''}
                onChange={(event) => onChange({ ...block, findingId: event.target.value || undefined })}
              />
            </label>
            <label>
              Severity
              <select
                value={block.severity}
                onChange={(event) => onChange({ ...block, severity: event.target.value as typeof block.severity })}
              >
                {['info', 'low', 'medium', 'high', 'critical'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              CWE
              <input
                value={block.cwe ?? ''}
                onChange={(event) => onChange({ ...block, cwe: event.target.value || undefined })}
              />
            </label>
          </div>
          <label>
            Title
            <input
              value={block.title ?? ''}
              onChange={(event) => onChange({ ...block, title: event.target.value || undefined })}
            />
          </label>
          <textarea
            rows={6}
            value={block.body
              .filter((child) => child.type === 'prose')
              .map((child) => (child.type === 'prose' ? child.markdown : ''))
              .join('\n\n')}
            onChange={(event) =>
              onChange({
                ...block,
                body: [{ id: block.body[0]?.id ?? block.id, type: 'prose', markdown: event.target.value }],
              })
            }
          />
        </div>
      );
    case 'callout':
      return (
        <div className="meta-grid">
          <div className="form-row">
            <label>
              Tone
              <select
                value={block.tone}
                onChange={(event) => onChange({ ...block, tone: event.target.value as typeof block.tone })}
              >
                {['note', 'tip', 'warning', 'danger'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                value={block.title ?? ''}
                onChange={(event) => onChange({ ...block, title: event.target.value || undefined })}
              />
            </label>
          </div>
          <textarea
            rows={4}
            value={block.body
              .filter((child) => child.type === 'prose')
              .map((child) => (child.type === 'prose' ? child.markdown : ''))
              .join('\n\n')}
            onChange={(event) =>
              onChange({
                ...block,
                body: [{ id: block.body[0]?.id ?? block.id, type: 'prose', markdown: event.target.value }],
              })
            }
          />
        </div>
      );
    case 'gallery':
    case 'embed':
    case 'video':
      return (
        <p className="empty">
          {block.type} — edit the markdown source if you need fields beyond the defaults. Drop images onto the
          metadata panel to upload.
        </p>
      );
    default: {
      const exhaustive: never = block;
      return <p>{String(exhaustive)}</p>;
    }
  }
}
