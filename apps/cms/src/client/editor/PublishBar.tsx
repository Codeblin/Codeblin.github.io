import type { ReactElement, ReactNode } from 'react';

interface Props {
  backLabel: string;
  onBack: () => void;
  dirty: boolean;
  saving: boolean;
  savedAt: string | null;
  publishing: boolean;
  isLive: boolean;
  onSave: () => void;
  onPublishLocal: () => void;
  onUnpublish: () => void;
  onPushDraft: () => void;
  onPublish: () => void;
  onDelete: () => void;
  extra?: ReactNode;
}

export function PublishBar({
  backLabel,
  onBack,
  dirty,
  saving,
  savedAt,
  publishing,
  isLive,
  onSave,
  onPublishLocal,
  onUnpublish,
  onPushDraft,
  onPublish,
  onDelete,
  extra,
}: Props): ReactElement {
  const disk = dirty ? 'Unsaved edits' : saving ? 'Saving…' : savedAt ? 'Edits saved' : 'Clean';

  return (
    <div className="publish-bar">
      <div className="publish-bar__groups">
        <button type="button" onClick={onBack}>
          {backLabel}
        </button>
        {extra}
        <div className="publish-bar__group">
          <span className="publish-bar__k">This machine</span>
          <span className="stat__k">
            {isLive ? 'Published locally' : 'Draft locally'} · {disk}
          </span>
          <button type="button" onClick={onSave} disabled={saving} title="Writes this record to disk. Does not change publish status, commit, or push.">
            Save locally
          </button>
          {isLive ? (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={publishing}
              title="Marks this copy as a draft on disk. The local site will hide it. Push draft to GitHub afterward to take it off the live site."
            >
              Unpublish locally
            </button>
          ) : (
            <button
              type="button"
              onClick={onPublishLocal}
              disabled={publishing}
              title="Marks this copy published on disk so the local site shows it. Does not commit or push."
            >
              Publish locally
            </button>
          )}
        </div>
        <div className="publish-bar__group">
          <span className="publish-bar__k">GitHub</span>
          <button
            type="button"
            onClick={onPushDraft}
            disabled={publishing}
            title="Commits and pushes this record as a draft so the live site drops it."
          >
            {publishing ? 'Pushing…' : 'Push draft to GitHub'}
          </button>
          <button
            className="primary"
            type="button"
            onClick={onPublish}
            disabled={publishing}
            title="Commits and pushes this record as published so it appears on the live site."
          >
            {publishing ? 'Publishing…' : 'Publish to GitHub'}
          </button>
        </div>
        <button className="danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
      <p className="publish-bar__hint">
        Save locally writes edits to this machine without changing status. Publish locally puts the
        record on the local site only. Unpublish locally takes it off the local site. GitHub buttons
        commit and push: Publish to GitHub goes live, Push draft to GitHub takes it down.
      </p>
    </div>
  );
}
