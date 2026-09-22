import { palette } from '@codeblin/tokens';
import { sanitizeMermaidSvg } from '@codeblin/content';

type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let seq = 0;
const cache = new Map<string, string>();

function stubCanvasContext(canvas: { width?: number; height?: number }): object {
  return {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    font: '16px monospace',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    measureText: (text: string) => ({
      width: String(text).length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: String(text).length * 8,
      fontBoundingBoxAscent: 16,
      fontBoundingBoxDescent: 4,
    }),
    fillText: () => undefined,
    strokeText: () => undefined,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    clearRect: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    bezierCurveTo: () => undefined,
    quadraticCurveTo: () => undefined,
    arc: () => undefined,
    rect: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    clip: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    transform: () => undefined,
    setTransform: () => undefined,
    resetTransform: () => undefined,
    drawImage: () => undefined,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: () => undefined,
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  };
}

function polyfillCanvas(target: {
  HTMLCanvasElement?: { prototype: { getContext?: (...args: never[]) => unknown } };
}): void {
  const proto = target.HTMLCanvasElement?.prototype;
  if (!proto) return;
  const getContext = function getContext(this: { width?: number; height?: number }, id: string) {
    return id === '2d' ? stubCanvasContext(this) : null;
  };
  try {
    proto.getContext = getContext as typeof proto.getContext;
  } catch {
    Object.defineProperty(proto, 'getContext', { configurable: true, writable: true, value: getContext });
  }
}

function polyfillSvg(window: { SVGElement?: { prototype: object }; SVGGraphicsElement?: { prototype: object }; SVGTextContentElement?: { prototype: object }; SVGTextElement?: { prototype: object } }): void {
  const length = function (this: { textContent: string | null }): number {
    return (this.textContent ?? '').length * 8;
  };
  const bbox = (): { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number } => ({
    x: 0,
    y: 0,
    width: 160,
    height: 24,
    top: 0,
    right: 160,
    bottom: 24,
    left: 0,
  });
  const ctm = (): { a: number; b: number; c: number; d: number; e: number; f: number } => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  });

  for (const Ctor of [
    window.SVGElement,
    window.SVGGraphicsElement,
    window.SVGTextContentElement,
    window.SVGTextElement,
  ]) {
    if (!Ctor) continue;
    const proto = Ctor.prototype as {
      getComputedTextLength?: () => number;
      getBBox?: () => object;
      getScreenCTM?: () => object;
    };
    proto.getComputedTextLength = length;
    proto.getBBox = bbox;
    proto.getScreenCTM = ctm;
  }
}

async function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      if (typeof globalThis.document === 'undefined') {
        const { JSDOM } = await import('jsdom');
        const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
          pretendToBeVisual: true,
          url: 'https://codeblin.local/',
        });
        polyfillSvg(window);
        polyfillCanvas(window);
        for (const name of Object.getOwnPropertyNames(window)) {
          if (name === 'navigator' || name in globalThis) continue;
          try {
            Object.defineProperty(globalThis, name, {
              configurable: true,
              writable: true,
              value: window[name as keyof typeof window],
            });
          } catch {
            /* not writable */
          }
        }
        globalThis.window = window as unknown as Window & typeof globalThis;
        globalThis.document = window.document;
      }
      polyfillSvg(globalThis);
      polyfillCanvas(globalThis);
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: 'dark',
        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
        themeVariables: {
          darkMode: true,
          background: palette.tar,
          primaryColor: palette.carbon,
          primaryTextColor: palette.bone,
          primaryBorderColor: palette.hairLit,
          lineColor: palette.ash,
          secondaryColor: palette.slate,
          tertiaryColor: palette.void,
          mainBkg: palette.carbon,
          nodeBorder: palette.hairLit,
          clusterBkg: palette.slate,
          titleColor: palette.bone,
          edgeLabelBackground: palette.tar,
          textColor: palette.bone,
          tertiaryTextColor: palette.ash,
          actorBkg: palette.carbon,
          actorBorder: palette.hairLit,
          actorTextColor: palette.bone,
          signalColor: palette.sulfur,
          labelBoxBkgColor: palette.carbon,
          labelTextColor: palette.bone,
        },
      });
      return mermaid;
    })();
  }
  return mermaidPromise;
}

/** Render Mermaid source to a sanitized inline SVG, or null if it cannot parse. */
export async function renderMermaidSvg(source: string): Promise<string | null> {
  const key = source.trim();
  if (key.length === 0) return null;
  const cached = cache.get(key);
  if (cached) return cached;

  const mermaid = await loadMermaid();
  seq += 1;
  try {
    const { svg } = await mermaid.render(`mermaid-${seq}`, key);
    const clean = sanitizeMermaidSvg(svg);
    if (clean.length === 0) return null;
    cache.set(key, clean);
    return clean;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[mermaid] render failed', error);
    }
    return null;
  }
}
