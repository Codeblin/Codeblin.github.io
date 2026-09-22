import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { api, type GitState, type Meta } from './api.ts';
import { Dashboard } from './screens/Dashboard.tsx';
import { Editor } from './screens/Editor.tsx';
import { Posts } from './screens/Posts.tsx';
import { ProjectEditor } from './screens/ProjectEditor.tsx';
import { Projects } from './screens/Projects.tsx';
import { Settings } from './screens/Settings.tsx';
import { Taxonomy } from './screens/Taxonomy.tsx';

const NAV = [
  { href: '/', label: 'Dashboard', code: '00' },
  { href: '/posts', label: 'Posts', code: '01' },
  { href: '/drafts', label: 'Drafts', code: '02' },
  { href: '/projects', label: 'Projects', code: '03' },
  { href: '/taxonomy', label: 'Taxonomy', code: '04' },
  { href: '/settings', label: 'Settings', code: '05' },
] as const;

function usePath(): { path: string; go: (to: string) => void } {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = (): void => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = useCallback((to: string): void => {
    history.pushState({}, '', to);
    setPath(to);
  }, []);
  return { path, go };
}

export function App(): ReactElement {
  const { path, go } = usePath();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [git, setGit] = useState<GitState | null>(null);
  const [toast, setToast] = useState<{ text: string; fail?: boolean } | null>(null);

  const refresh = useCallback((): void => {
    void api
      .meta()
      .then((payload) => {
        setMeta(payload);
        setGit(payload.git);
      })
      .catch((error: unknown) => {
        setToast({ text: error instanceof Error ? error.message : 'API unreachable', fail: true });
      });
  }, []);

  const [publishingAll, setPublishingAll] = useState(false);
  const contentDirty = git?.dirty.filter((path) => path.replace(/\\/g, '/').includes('content/')).length ?? 0;
  const canPublishAll = contentDirty > 0 || (git?.ahead ?? 0) > 0;

  const publishAll = async (): Promise<void> => {
    if (publishingAll || !canPublishAll) return;
    const summary =
      contentDirty > 0
        ? `Commit and push ${contentDirty} content change${contentDirty === 1 ? '' : 's'} to GitHub? Includes deletions.`
        : `Push ${git?.ahead ?? 0} unpushed commit${git?.ahead === 1 ? '' : 's'} to GitHub?`;
    if (!window.confirm(summary)) return;
    setPublishingAll(true);
    try {
      const result = await api.publishAll();
      if (!result.ok) setToast({ text: result.error ?? 'Publish all failed', fail: true });
      else if (result.skipped) setToast({ text: 'Nothing to publish' });
      else setToast({ text: 'All content changes published' });
      refresh();
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : 'Publish all failed', fail: true });
    } finally {
      setPublishingAll(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const screen = (() => {
    if (path === '/' || path === '') return <Dashboard meta={meta} go={go} />;
    if (path === '/posts') return <Posts go={go} filter="all" onToast={setToast} />;
    if (path === '/drafts') return <Posts go={go} filter="draft" onToast={setToast} />;
    if (path.startsWith('/posts/')) {
      const slug = decodeURIComponent(path.slice('/posts/'.length).replace(/\/$/, ''));
      return <Editor key={slug} slug={slug} go={go} onToast={setToast} onSaved={refresh} />;
    }
    if (path === '/projects') return <Projects go={go} onToast={setToast} />;
    if (path.startsWith('/projects/')) {
      const slug = decodeURIComponent(path.slice('/projects/'.length).replace(/\/$/, ''));
      return <ProjectEditor key={slug} slug={slug} go={go} onToast={setToast} onSaved={refresh} />;
    }
    if (path === '/taxonomy') return <Taxonomy onToast={setToast} />;
    if (path === '/settings') {
      return (
        <Settings
          meta={meta}
          onToast={setToast}
          publishingAll={publishingAll}
          canPublishAll={canPublishAll}
          onPublishAll={() => void publishAll()}
        />
      );
    }
    return <p className="empty">Unknown route.</p>;
  })();

  const title = NAV.find((item) => item.href !== '/' && path.startsWith(item.href))?.label ?? 'Dashboard';

  return (
    <div className="shell">
      <aside className="rail">
        <div>
          <div className="rail__mark">SUBSTRATE</div>
          <div className="rail__sub">Authoring instrument</div>
        </div>
        <nav aria-label="CMS">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={path === item.href || (item.href !== '/' && path.startsWith(item.href)) ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.href);
              }}
            >
              <span>{item.label}</span>
              <span>{item.code}</span>
            </a>
          ))}
        </nav>
      </aside>

      <header className="topbar">
        <p className="topbar__title">{title}</p>
        <button
          type="button"
          className="primary"
          disabled={!canPublishAll || publishingAll}
          title="Commit and push every content change, including deletions. Per-post publish cannot send a deleted record."
          onClick={() => void publishAll()}
        >
          {publishingAll ? 'Publishing…' : contentDirty > 0 ? `Publish all (${contentDirty})` : 'Publish all'}
        </button>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </header>

      <main className="workspace">{screen}</main>

      <footer className="strip">
        <span>
          git <strong>{git?.branch ?? '—'}</strong>
        </span>
        <span>
          dirty <strong>{git?.dirty.length ?? '—'}</strong>
          {contentDirty ? ` · content ${contentDirty}` : ''}
        </span>
        <span>
          {git?.ahead ? `ahead ${git.ahead}` : git?.behind ? `behind ${git.behind}` : 'in sync'}
        </span>
        <span style={{ marginInlineStart: 'auto' }}>{git?.lastCommit ?? 'no commits yet'}</span>
      </footer>

      {toast && <div className={`toast${toast.fail ? ' fail' : ''}`}>{toast.text}</div>}
    </div>
  );
}
