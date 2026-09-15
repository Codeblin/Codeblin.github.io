import { emptyBlock, type Block, type BlockType, type PostFrontmatter } from '@codeblin/content';
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react';

import { api, type Issue } from '../api.ts';
import { BlockEditor, InsertPalette } from '../editor/BlockEditor.tsx';
import { HistoryStack } from '../editor/history.ts';

interface Props {
  slug: string;
  go: (to: string) => void;
  onToast: (toast: { text: string; fail?: boolean }) => void;
  onSaved: () => void;
}

const PREVIEW = 'http://127.0.0.1:4321';

export function Editor({ slug, go, onToast, onSaved }: Props): ReactElement {
  const [frontmatter, setFrontmatter] = useState<PostFrontmatter | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [preview, setPreview] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [steps, setSteps] = useState<Array<{ id: string; ok: boolean; detail: string }>>([]);
  const [files, setFiles] = useState<string[]>([]);
  const history = useRef(new HistoryStack<PostFrontmatter>());
  const debounce = useRef<number>(0);

  const load = useCallback((): void => {
    void Promise.all([api.post(slug), api.media(slug)])
      .then(([post, media]) => {
        setFrontmatter(post.frontmatter as PostFrontmatter);
        setBlocks(post.blocks as Block[]);
        setIssues(post.issues);
        setFiles(media.files);
        setDirty(false);
      })
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Load failed', fail: true }));
  }, [slug, onToast]);

  useEffect(load, [load]);

  const snapshot = (): void => {
    if (frontmatter) history.current.push({ frontmatter, blocks }, true);
  };

  const save = useCallback(async (): Promise<void> => {
    if (!frontmatter) return;
    setSaving(true);
    try {
      const result = await api.savePost(slug, { frontmatter, blocks });
      setFrontmatter(result.frontmatter as PostFrontmatter);
      setBlocks(result.blocks as Block[]);
      setIssues(result.issues);
      setSavedAt(result.savedAt);
      setDirty(false);
      onSaved();
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Save failed', fail: true });
    } finally {
      setSaving(false);
    }
  }, [frontmatter, blocks, slug, onSaved, onToast]);

  useEffect(() => {
    if (!dirty || !frontmatter) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void save(), 400);
    return () => window.clearTimeout(debounce.current);
  }, [dirty, frontmatter, blocks, save]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        void publish();
      }
      if (meta && event.key.toLowerCase() === 'z' && !event.shiftKey && frontmatter) {
        event.preventDefault();
        const previous = history.current.undo({ frontmatter, blocks });
        if (previous) {
          setFrontmatter(previous.frontmatter);
          setBlocks(previous.blocks);
          setDirty(true);
        }
      }
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        setPalette(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mutateBlocks = (next: Block[]): void => {
    snapshot();
    setBlocks(next);
    setDirty(true);
  };

  const mutateMeta = (patch: Partial<PostFrontmatter>): void => {
    if (!frontmatter) return;
    snapshot();
    setFrontmatter({ ...frontmatter, ...patch });
    setDirty(true);
  };

  const insert = (type: BlockType): void => {
    const next = [...blocks];
    next.splice(selected + 1, 0, emptyBlock(type));
    mutateBlocks(next);
    setSelected(selected + 1);
  };

  const publish = async (): Promise<void> => {
    await save();
    setPublishing(true);
    try {
      const result = await api.publish({ slug, kind: 'posts' });
      setSteps(result.steps);
      if (result.ok) onToast({ text: 'Published' });
      else onToast({ text: result.error ?? 'Publish failed', fail: true });
      load();
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Publish failed', fail: true });
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async (): Promise<void> => {
    try {
      await api.unpublish(slug);
      onToast({ text: 'Reverted to draft' });
      load();
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Unpublish failed', fail: true });
    }
  };

  const onDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try {
      const uploaded = await api.upload(slug, file);
      setFiles(uploaded.files);
      onToast({ text: uploaded.src });
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Upload rejected', fail: true });
    }
  };

  if (!frontmatter) return <p className="empty">Opening record…</p>;

  return (
    <div>
      <div className="form-row" style={{ marginBlockEnd: '1rem' }}>
        <button type="button" onClick={() => go('/posts')}>
          ← Posts
        </button>
        <span className="stat__k">{dirty ? 'UNSAVED' : saving ? 'SAVING' : savedAt ? 'SAVED' : 'CLEAN'}</span>
        <button type="button" onClick={() => setPreview((value) => !value)}>
          {preview ? 'Hide preview' : 'Show preview'}
        </button>
        <button type="button" onClick={() => void save()} disabled={saving}>
          Save
        </button>
        {frontmatter.status === 'published' ? (
          <button type="button" onClick={() => void unpublish()}>
            Unpublish
          </button>
        ) : (
          <button className="primary" type="button" onClick={() => void publish()} disabled={publishing}>
            Publish
          </button>
        )}
        <button
          className="danger"
          type="button"
          onClick={() => {
            if (window.confirm(`Delete ${slug}?`)) {
              void api.deletePost(slug).then(() => go('/posts'));
            }
          }}
        >
          Delete
        </button>
      </div>

      <div className={`editor${preview ? '' : ' preview-off'}`}>
        <div>
          <label>
            Title
            <input
              value={frontmatter.title}
              onChange={(event) => mutateMeta({ title: event.target.value })}
              style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}
            />
          </label>
          <div className="panel meta-grid" style={{ marginBlock: '1rem' }}>
            <div className="form-row">
              <label>
                Subtitle
                <input
                  value={frontmatter.subtitle ?? ''}
                  onChange={(event) => mutateMeta({ subtitle: event.target.value || undefined })}
                />
              </label>
            </div>
            <label>
              Excerpt
              <textarea
                rows={3}
                value={frontmatter.excerpt ?? ''}
                onChange={(event) => mutateMeta({ excerpt: event.target.value || undefined })}
              />
            </label>
            <div className="form-row">
              <label>
                Category
                <input value={frontmatter.category} onChange={(event) => mutateMeta({ category: event.target.value })} />
              </label>
              <label>
                Tags (comma)
                <input
                  value={frontmatter.tags.join(', ')}
                  onChange={(event) =>
                    mutateMeta({
                      tags: event.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                Featured
                <select
                  value={frontmatter.featured ? 'yes' : 'no'}
                  onChange={(event) => mutateMeta({ featured: event.target.value === 'yes' })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </div>
          </div>

          <BlockEditor
            blocks={blocks}
            selected={selected}
            onSelect={setSelected}
            onChange={mutateBlocks}
            onSlash={() => setPalette(true)}
          />
        </div>

        {preview && (
          <aside className="meta-grid">
            <iframe
              className="preview-frame"
              title="Live preview"
              src={`${PREVIEW}/_draft/posts/${slug}/`}
            />
            <div
              className="panel"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void onDrop(event)}
            >
              <p className="stat__k">Media — drop files here</p>
              <ul>
                {files.map((file) => (
                  <li key={file}>./media/{file}</li>
                ))}
              </ul>
            </div>
            <div className="panel issues">
              {issues.length === 0 ? (
                <p>No issues.</p>
              ) : (
                issues.map((issue, index) => (
                  <p key={index} className={issue.level === 'error' ? 'err' : 'warn'}>
                    {issue.message}
                  </p>
                ))
              )}
            </div>
            {steps.length > 0 && (
              <div className="panel issues">
                {steps.map((step) => (
                  <p key={step.id} className={step.ok ? '' : 'err'}>
                    {step.ok ? '✓' : '✗'} {step.id} — {step.detail}
                  </p>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {palette && (
        <InsertPalette
          onPick={insert}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
  );
}
