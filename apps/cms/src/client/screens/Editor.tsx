import { emptyBlock, type Block, type BlockType, type PostFrontmatter } from '@codeblin/content/client';
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react';

import { api, type Issue, type Taxonomy } from '../api.ts';
import { BlockEditor, InsertPalette } from '../editor/BlockEditor.tsx';
import { CommaListInput } from '../editor/CommaListInput.tsx';
import { MediaPicker } from '../editor/MediaPicker.tsx';
import { PublishBar } from '../editor/PublishBar.tsx';
import { HistoryStack } from '../editor/history.ts';
import { issueClass } from '../issues.ts';
import { previewUrl } from '../preview.ts';
import { usePublishGate } from '../publishGate.ts';

interface Props {
  slug: string;
  go: (to: string) => void;
  onToast: (toast: { text: string; fail?: boolean }) => void;
  onSaved: () => void;
}

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
  const [steps, setSteps] = useState<Array<{ id: string; ok: boolean; detail: string }>>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [previewTick, setPreviewTick] = useState(0);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const history = useRef(new HistoryStack<PostFrontmatter>());
  const debounce = useRef<number>(0);
  const insertAfter = useRef(0);
  const draft = useRef({ frontmatter: null as PostFrontmatter | null, blocks: [] as Block[], dirty: false });
  const saveGen = useRef(0);
  const { busy: publishing, schedulePublish, runUnpublish } = usePublishGate();

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

  useEffect(() => {
    void api.taxonomy().then(setTaxonomy).catch(() => setTaxonomy(null));
  }, []);

  draft.current = { frontmatter, blocks, dirty };

  const snapshot = (): void => {
    if (frontmatter) history.current.push({ frontmatter, blocks }, true);
  };

  const save = useCallback(async (): Promise<void> => {
    const current = draft.current;
    if (!current.frontmatter) return;
    const ticket = saveGen.current;
    setSaving(true);
    try {
      const result = await api.savePost(slug, { frontmatter: current.frontmatter, blocks: current.blocks });
      setIssues(result.issues);
      setSavedAt(result.savedAt);
      if (ticket === saveGen.current) setDirty(false);
      setPreviewTick((tick) => tick + 1);
      onSaved();
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Save failed', fail: true });
    } finally {
      setSaving(false);
    }
  }, [slug, onSaved, onToast]);

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
          saveGen.current += 1;
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
    saveGen.current += 1;
    setBlocks(next);
    setDirty(true);
  };

  const mutateMeta = (patch: Partial<PostFrontmatter>): void => {
    if (!frontmatter) return;
    snapshot();
    saveGen.current += 1;
    setFrontmatter({ ...frontmatter, ...patch });
    setDirty(true);
  };

  const insert = (type: BlockType): void => {
    const at = insertAfter.current;
    const next = [...blocks];
    next.splice(at + 1, 0, emptyBlock(type));
    mutateBlocks(next);
    setSelected(at + 1);
    insertAfter.current = at + 1;
  };

  const publish = async (as: 'live' | 'draft' = 'live'): Promise<void> => {
    schedulePublish(async () => {
      try {
        await save();
        const result = await api.publish({ slug, kind: 'posts', as });
        setSteps(result.steps);
        if (result.skipped) {
          onToast({
            text: as === 'draft' ? 'Draft already on origin' : 'Already published — no new commit',
          });
        } else if (result.ok) {
          onToast({ text: as === 'draft' ? 'Draft pushed — it will leave the site' : 'Published' });
        } else onToast({ text: result.error ?? 'Publish failed', fail: true });
        load();
      } catch (error) {
        onToast({ text: error instanceof Error ? error.message : 'Publish failed', fail: true });
      }
    });
  };

  const unpublish = async (): Promise<void> => {
    runUnpublish(async () => {
      try {
        await api.unpublish(slug, 'posts');
        onToast({ text: 'Unpublished on this machine' });
        load();
      } catch (error) {
        onToast({ text: error instanceof Error ? error.message : 'Unpublish failed', fail: true });
      }
    });
  };

  const publishLocal = async (): Promise<void> => {
    runUnpublish(async () => {
      try {
        await save();
        await api.publishLocal(slug, 'posts', 'live');
        onToast({ text: 'Published on this machine' });
        load();
      } catch (error) {
        onToast({ text: error instanceof Error ? error.message : 'Local publish failed', fail: true });
      }
    });
  };

  const onUpload = async (file: File): Promise<string> => {
    const uploaded = await api.upload(slug, file);
    setFiles(uploaded.files);
    return uploaded.src;
  };

  const onDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try {
      const src = await onUpload(file);
      onToast({ text: src });
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Upload rejected', fail: true });
    }
  };

  if (!frontmatter) return <p className="empty">Opening record…</p>;

  const categories = taxonomy?.categories ?? [];
  const categoryOptions =
    categories.some((category) => category.slug === frontmatter.category) || !frontmatter.category
      ? categories
      : [{ slug: frontmatter.category, name: frontmatter.category }, ...categories];

  const setCoverSrc = (src: string): void => {
    if (!src) {
      mutateMeta({ cover: undefined });
      return;
    }
    mutateMeta({
      cover: {
        src,
        alt: frontmatter.cover?.alt || frontmatter.title,
        duotone: frontmatter.cover?.duotone,
      },
    });
  };

  return (
    <div>
      <PublishBar
        backLabel="← Posts"
        onBack={() => go('/posts')}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        publishing={publishing}
        isLive={frontmatter.status === 'published'}
        onSave={() => void save()}
        onPublishLocal={() => void publishLocal()}
        onUnpublish={() => void unpublish()}
        onPushDraft={() => void publish('draft')}
        onPublish={() => void publish('live')}
        onDelete={() => {
          if (window.confirm(`Delete ${slug}?`)) {
            void api.deletePost(slug).then(() => go('/posts'));
          }
        }}
        extra={
          <button type="button" onClick={() => setPreview((value) => !value)}>
            {preview ? 'Hide preview' : 'Show preview'}
          </button>
        }
      />

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
                <select
                  value={frontmatter.category}
                  onChange={(event) => mutateMeta({ category: event.target.value })}
                >
                  {categoryOptions.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <CommaListInput
                label="Tags"
                values={frontmatter.tags ?? []}
                onChange={(tags) => mutateMeta({ tags })}
                placeholder="android, frida, keystore"
              />
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
            <div className="panel" style={{ padding: '0.7rem' }}>
              <p className="stat__k">Cover</p>
              <p className="empty" style={{ margin: 0 }}>
                Ideal size: 2400 × 1350 px (16:9). Larger images are scaled
                down to the frame; extra edges may be cropped.
              </p>
              <MediaPicker
                files={files}
                accept="image"
                value={frontmatter.cover?.src ?? ''}
                allowEmpty
                onUpload={onUpload}
                label="Image"
                onChange={setCoverSrc}
              />
              {frontmatter.cover && (
                <div className="form-row" style={{ marginBlockStart: '0.6rem' }}>
                  <label style={{ flex: 1 }}>
                    Alt text
                    <input
                      value={frontmatter.cover.alt}
                      onChange={(event) =>
                        mutateMeta({
                          cover: { ...frontmatter.cover!, alt: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Duotone
                    <select
                      value={frontmatter.cover.duotone === false ? 'no' : 'yes'}
                      onChange={(event) =>
                        mutateMeta({
                          cover: { ...frontmatter.cover!, duotone: event.target.value === 'yes' },
                        })
                      }
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>

          <BlockEditor
            blocks={blocks}
            selected={selected}
            onSelect={setSelected}
            onChange={mutateBlocks}
            onSlash={() => {
              insertAfter.current = selected;
              setPalette(true);
            }}
            onInsertBelow={(index) => {
              insertAfter.current = index;
              setSelected(index);
              setPalette(true);
            }}
            media={{ files, onUpload }}
          />
        </div>

        {preview && (
          <aside className="meta-grid">
            <iframe
              key={previewTick}
              className="preview-frame"
              title="Live preview"
              src={previewUrl('posts', slug, previewTick)}
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
                  <p key={index} className={issueClass(issue.level)}>
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
