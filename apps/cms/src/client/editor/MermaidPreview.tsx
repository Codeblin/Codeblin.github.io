import { looksLikeMermaid, sanitizeMermaidSvg } from '@codeblin/content/client';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { bindDiagramViewport } from './diagramViewport.ts';

interface Props {
  source: string;
}

export function MermaidPreview({ source }: Props): ReactElement | null {
  const root = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!looksLikeMermaid(source)) {
      setSvg(null);
      setError(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import('mermaid').then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          htmlLabels: false,
          theme: 'dark',
        });
        const id = `cms-mmd-${Math.random().toString(36).slice(2, 10)}`;
        try {
          const rendered = await mermaid.render(id, source);
          if (cancelled) return;
          const clean = sanitizeMermaidSvg(rendered.svg);
          setSvg(clean.length > 0 ? clean : null);
          setError(clean.length === 0);
        } catch {
          if (!cancelled) {
            setSvg(null);
            setError(true);
          }
        }
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source]);

  useEffect(() => {
    if (!svg || !root.current) return;
    return bindDiagramViewport(root.current);
  }, [svg]);

  if (!looksLikeMermaid(source)) return null;

  if (error) {
    return <p className="empty">Mermaid could not parse this diagram.</p>;
  }

  if (!svg) return <p className="empty">Rendering chart…</p>;

  return (
    <div className="diagram-preview" data-diagram-viewport ref={root}>
      <div className="diagram-preview__toolbar">
        <p className="diagram-preview__hint">Drag to pan · scroll to zoom</p>
        <button type="button" data-diagram-act="out" aria-label="Zoom out">
          −
        </button>
        <button type="button" data-diagram-act="in" aria-label="Zoom in">
          +
        </button>
        <button type="button" data-diagram-act="fit">
          Fit
        </button>
        <button type="button" data-diagram-act="expand" aria-expanded="false">
          Expand
        </button>
      </div>
      <div className="diagram-preview__stage" data-diagram-stage tabIndex={0} role="img" aria-label="Mermaid diagram">
        <div className="diagram-preview__canvas" data-diagram-canvas dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}
