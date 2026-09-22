/**
 * Browser Mermaid + pan/zoom for article diagrams.
 *
 * Server-side Mermaid (jsdom) lays out with fake SVG metrics, so the chart
 * arrives already cropped. The editor preview renders in a real browser —
 * the public page does the same, then the viewport pans that full drawing.
 */

import { sanitizeMermaidSvg } from '@codeblin/content/client';

const MIN_SCALE = 0.15;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.18;

interface PanZoom {
  x: number;
  y: number;
  scale: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function naturalSize(svg: SVGSVGElement): { width: number; height: number } {
  const raw = svg.getAttribute('viewBox');
  if (raw) {
    const parts = raw.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2]! > 0 && parts[3]! > 0) {
      return { width: parts[2]!, height: parts[3]! };
    }
  }
  const view = svg.viewBox.baseVal;
  if (view && view.width > 0 && view.height > 0) {
    return { width: view.width, height: view.height };
  }
  const widthAttr = svg.getAttribute('width') ?? '';
  const heightAttr = svg.getAttribute('height') ?? '';
  const width = Number.parseFloat(widthAttr);
  const height = Number.parseFloat(heightAttr);
  if (width > 0 && height > 0 && !widthAttr.includes('%') && !heightAttr.includes('%')) {
    return { width, height };
  }
  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) return { width: box.width, height: box.height };
  } catch {
    /* not in the document yet */
  }
  return { width: svg.clientWidth || 800, height: svg.clientHeight || 320 };
}

function sourceOf(root: HTMLElement): string | null {
  const field = root.querySelector<HTMLTextAreaElement>('[data-mermaid-source]');
  if (!field) return null;
  const value = field.value.trim();
  return value.length > 0 ? value : null;
}

function bindOne(root: HTMLElement): () => void {
  if (root.dataset['diagramBound'] === 'true') return () => undefined;
  const stage = root.querySelector<HTMLElement>('[data-diagram-stage]');
  const canvas = root.querySelector<HTMLElement>('[data-diagram-canvas]');
  const svg = canvas?.querySelector('svg');
  const expand = root.querySelector<HTMLButtonElement>('[data-diagram-act="expand"]');
  if (!stage || !canvas || !svg || svg.localName !== 'svg') return () => undefined;
  root.dataset['diagramBound'] = 'true';

  const size = naturalSize(svg as SVGSVGElement);
  svg.setAttribute('width', String(size.width));
  svg.setAttribute('height', String(size.height));
  svg.style.maxWidth = 'none';
  svg.style.width = `${size.width}px`;
  svg.style.height = `${size.height}px`;

  let view: PanZoom = { x: 0, y: 0, scale: 1 };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; scale: number } | null = null;
  let dragging = false;

  const paint = (): void => {
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  };

  const fit = (): void => {
    const pad = 16;
    const availableW = Math.max(1, stage.clientWidth - pad * 2);
    const availableH = Math.max(1, stage.clientHeight - pad * 2);
    const scale = clamp(Math.min(availableW / size.width, availableH / size.height), MIN_SCALE, MAX_SCALE);
    view = {
      scale,
      x: (stage.clientWidth - size.width * scale) / 2,
      y: (stage.clientHeight - size.height * scale) / 2,
    };
    paint();
    root.dataset['ready'] = '';
  };

  const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    const next = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = next / view.scale;
    const box = stage.getBoundingClientRect();
    const px = clientX - box.left;
    const py = clientY - box.top;
    view = {
      scale: next,
      x: px - (px - view.x) * ratio,
      y: py - (py - view.y) * ratio,
    };
    paint();
  };

  const setExpanded = (open: boolean): void => {
    root.toggleAttribute('data-expanded', open);
    if (expand) {
      expand.textContent = open ? 'Close' : 'Expand';
      expand.setAttribute('aria-expanded', String(open));
    }
    document.body.style.overflow = open ? 'hidden' : '';
    requestAnimationFrame(fit);
  };

  const onAct = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-diagram-act]');
    if (!button || !root.contains(button)) return;
    const act = button.dataset['diagramAct'];
    const box = stage.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    if (act === 'in') zoomAt(cx, cy, ZOOM_STEP);
    if (act === 'out') zoomAt(cx, cy, 1 / ZOOM_STEP);
    if (act === 'fit') fit();
    if (act === 'expand') setExpanded(!root.hasAttribute('data-expanded'));
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(event.clientX, event.clientY, factor);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dx = a!.x - b!.x;
      const dy = a!.y - b!.y;
      pinch = { distance: Math.hypot(dx, dy), scale: view.scale };
      dragging = false;
    } else {
      dragging = true;
      stage.dataset['dragging'] = '';
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch.distance > 0 && distance > 0) {
        const next = clamp(pinch.scale * (distance / pinch.distance), MIN_SCALE, MAX_SCALE);
        zoomAt((a!.x + b!.x) / 2, (a!.y + b!.y) / 2, next / view.scale);
      }
      return;
    }

    if (!dragging) return;
    view = {
      ...view,
      x: view.x + event.clientX - previous.x,
      y: view.y + event.clientY - previous.y,
    };
    paint();
  };

  const onPointerUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      dragging = false;
      delete stage.dataset['dragging'];
    }
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && root.hasAttribute('data-expanded')) {
      event.preventDefault();
      setExpanded(false);
      return;
    }
    if (event.target !== stage) return;
    const box = stage.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomAt(cx, cy, ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomAt(cx, cy, 1 / ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      fit();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      view = { ...view, x: view.x + 40 };
      paint();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      view = { ...view, x: view.x - 40 };
      paint();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      view = { ...view, y: view.y + 40 };
      paint();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      view = { ...view, y: view.y - 40 };
      paint();
    }
  };

  const onBackdrop = (event: Event): void => {
    if (event.target === root && root.hasAttribute('data-expanded')) setExpanded(false);
  };

  const observer = new ResizeObserver(() => fit());
  observer.observe(stage);

  root.addEventListener('click', onAct);
  root.addEventListener('click', onBackdrop);
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKey);

  requestAnimationFrame(fit);

  return () => {
    observer.disconnect();
    root.removeEventListener('click', onAct);
    root.removeEventListener('click', onBackdrop);
    stage.removeEventListener('wheel', onWheel);
    stage.removeEventListener('pointerdown', onPointerDown);
    stage.removeEventListener('pointermove', onPointerMove);
    stage.removeEventListener('pointerup', onPointerUp);
    stage.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  };
}

let mermaidReady: Promise<typeof import('mermaid')['default']> | null = null;
let hydrating: Promise<void> | null = null;

async function mermaidApi(): Promise<typeof import('mermaid')['default']> {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: 'dark',
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

async function hydrateDiagrams(): Promise<void> {
  const roots = [...document.querySelectorAll<HTMLElement>('[data-diagram-viewport]')];
  const pending = roots.filter((root) => root.dataset['diagramHydrate'] !== 'true');
  if (pending.length === 0) return;

  for (const root of pending) root.dataset['diagramHydrate'] = 'true';

  const mermaid = pending.some(sourceOf) ? await mermaidApi() : null;
  let seq = 0;

  for (const root of pending) {
    const canvas = root.querySelector<HTMLElement>('[data-diagram-canvas]');
    const source = sourceOf(root);
    if (mermaid && canvas && source && !canvas.querySelector('svg')) {
      seq += 1;
      try {
        const rendered = await mermaid.render(`site-mmd-${seq}`, source);
        const clean = sanitizeMermaidSvg(rendered.svg);
        if (clean.length > 0) canvas.innerHTML = clean;
      } catch {
        canvas.textContent = 'Mermaid could not parse this diagram.';
      }
    }
    bindOne(root);
  }
}

export function initDiagrams(): void {
  hydrating ??= hydrateDiagrams();
}

export function bindDiagramViewport(root: HTMLElement): () => void {
  return bindOne(root);
}
