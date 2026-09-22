import { emptyBlock, type Block, type BlockType, type ProjectFrontmatter } from '@codeblin/content/client';
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react';

import { api, type Issue } from '../api.ts';
import { BlockEditor, InsertPalette } from '../editor/BlockEditor.tsx';
import { CommaListInput } from '../editor/CommaListInput.tsx';
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

const STATUSES = ['active', 'maintained', 'research', 'archived'] as const;

export function ProjectEditor({ slug, go, onToast, onSaved }: Props): ReactElement {
  const [frontmatter, setFrontmatter] = useState<ProjectFrontmatter | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [preview, setPreview] = useState(true);
  const [previewTick, setPreviewTick] = useState(0);
  const [steps, setSteps] = useState<Array<{ id: string; ok: boolean; detail: string }>>([]);
  const [files, setFiles] = useState<string[]>([]);
  const history = useRef(new HistoryStack<ProjectFrontmatter>());
  const debounce = useRef<number>(0);
  const insertAfter = useRef(0);
  const draft = useRef({
    frontmatter: null as ProjectFrontmatter | null,
    blocks: [] as Block[],
    dirty: false,
  });
  const saveGen = useRef(0);
  const { busy: publishing, schedulePublish, runUnpublish } = usePublishGate();

  const load = useCallback((): void => {
    void Promise.all([api.project(slug), api.media(slug, 'projects')])
      .then(([project, media]) => {
        setFrontmatter(project.frontmatter as ProjectFrontmatter);
        setBlocks(project.blocks as Block[]);
        setIssues(project.issues);
        setFiles(media.files);
        setDirty(false);
      })
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Load failed', fail: true }));
  }, [slug, onToast]);

  useEffect(load, [load]);

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
      const result = await api.saveProject(slug, { frontmatter: current.frontmatter, blocks: current.blocks });
      setIssues(result.issues);
      setSavedAt(result.savedAt ?? null);
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

  const mutateMeta = (patch: Partial<ProjectFrontmatter>): void => {
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
    if (!frontmatter) return;
    schedulePublish(async () => {
      try {
        await save();
        const result = await api.publish({ slug, kind: 'projects', as });
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
        await api.unpublish(slug, 'projects');
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
        await api.publishLocal(slug, 'projects', 'live');
        onToast({ text: 'Published on this machine' });
        load();
      } catch (error) {
        onToast({ text: error instanceof Error ? error.message : 'Local publish failed', fail: true });
      }
    });
  };

  const onUpload = async (file: File): Promise<string> => {
    const uploaded = await api.upload(slug, file, 'projects');
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

  if (!frontmatter) return <p className="empty">Opening project…</p>;

  return (
    <div>
      <PublishBar
        backLabel="← Projects"
        onBack={() => go('/projects')}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        publishing={publishing}
        isLive={frontmatter.published}
        onSave={() => void save()}
        onPublishLocal={() => void publishLocal()}
        onUnpublish={() => void unpublish()}
        onPushDraft={() => void publish('draft')}
        onPublish={() => void publish('live')}
        onDelete={() => {
          if (window.confirm(`Delete ${slug}?`)) {
            void api.deleteProject(slug).then(() => go('/projects'));
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
            Name
            <input
              value={frontmatter.name}
              onChange={(event) => mutateMeta({ name: event.target.value })}
              style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}
            />
          </label>
          <div className="panel meta-grid" style={{ marginBlock: '1rem' }}>
            <label>
              Tagline
              <input
                value={frontmatter.tagline}
                onChange={(event) => mutateMeta({ tagline: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Status
                <select
                  value={frontmatter.status}
                  onChange={(event) => mutateMeta({ status: event.target.value as ProjectFrontmatter['status'] })}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Started (YYYY-MM)
                <input
                  value={frontmatter.startedAt}
                  onChange={(event) => mutateMeta({ startedAt: event.target.value })}
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
            <CommaListInput
              label="Stack"
              values={frontmatter.technologies}
              onChange={(technologies) => mutateMeta({ technologies })}
              placeholder="frida, kotlin, python"
              max={12}
            />
            <div className="form-row">
              <label>
                Repository
                <input
                  value={frontmatter.repository ?? ''}
                  onChange={(event) => mutateMeta({ repository: event.target.value || undefined })}
                />
              </label>
              <label>
                Homepage
                <input
                  value={frontmatter.homepage ?? ''}
                  onChange={(event) => mutateMeta({ homepage: event.target.value || undefined })}
                />
              </label>
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
              src={previewUrl('projects', slug, previewTick)}
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

      {palette && <InsertPalette onPick={insert} onClose={() => setPalette(false)} />}
    </div>
  );
}
