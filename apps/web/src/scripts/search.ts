import type { SearchDocument, SearchIndex } from '~/lib/search-index.ts';
import { decode } from './motion.ts';

/**
 * Client half of the search system. Loads the prebuilt index on first
 * interaction (not on page load), then scores queries locally.
 */

interface Hit {
  doc: SearchDocument;
  score: number;
}

const MAX_RESULTS = 40;
const INDEX_URL = '/search-index.json';

let index: SearchIndex | null = null;
let loading: Promise<SearchIndex> | null = null;

function loadIndex(): Promise<SearchIndex> {
  if (index) return Promise.resolve(index);
  loading ??= fetch(INDEX_URL, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`search index ${response.status}`);
      return response.json() as Promise<SearchIndex>;
    })
    .then((payload) => {
      index = payload;
      return payload;
    });
  return loading;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** First position in the sorted term array at or after `token`. */
function lowerBound(terms: string[], token: string): number {
  let low = 0;
  let high = terms.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((terms[mid] as string) < token) low = mid + 1;
    else high = mid;
  }
  return low;
}

function search(data: SearchIndex, query: string): Hit[] {
  const tokens = tokenize(query).filter((token) => token.length >= 2);
  if (tokens.length === 0) return [];

  const totals = new Map<number, number>();
  const matchedTokens = new Map<number, number>();

  for (const token of tokens) {
    const best = new Map<number, number>();

    for (let i = lowerBound(data.terms, token); i < data.terms.length; i += 1) {
      const term = data.terms[i] as string;
      if (!term.startsWith(token)) break;

      // Exact matches outrank prefix matches, and short completions outrank
      // long ones: "frida" should not be buried under "fridaserver".
      const proximity = token.length / term.length;
      for (const [docId, weight] of data.postings[i] ?? []) {
        const score = weight * proximity;
        if (score > (best.get(docId) ?? 0)) best.set(docId, score);
      }
    }

    for (const [docId, score] of best) {
      totals.set(docId, (totals.get(docId) ?? 0) + score);
      matchedTokens.set(docId, (matchedTokens.get(docId) ?? 0) + 1);
    }
  }

  const hits: Hit[] = [];
  for (const [docId, score] of totals) {
    const doc = data.docs[docId];
    if (!doc) continue;
    // Documents containing every token are what the reader meant.
    const complete = matchedTokens.get(docId) === tokens.length;
    hits.push({ doc, score: complete ? score * 2.5 : score });
  }

  hits.sort((a, b) => b.score - a.score || b.doc.d.localeCompare(a.doc.d));
  return hits.slice(0, MAX_RESULTS);
}

function slugFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHit(hit: Hit, position: number): string {
  const { doc } = hit;
  const kind = doc.k === 0 ? 'RESEARCH' : 'PROJECT';
  const stamp = doc.d ? doc.d.replaceAll('-', '.') : '——';
  const tags = doc.g
    .slice(0, 4)
    .map((tag) => `<span class="hit__tag micro">${escapeHtml(tag)}</span>`)
    .join('');

  const vtKind = doc.k === 0 ? 'post' : 'project';
  const vtSlug = slugFromPath(doc.u);

  return `
    <li class="hit" style="--i:${position}" data-vt-kind="${vtKind}" data-vt-slug="${escapeHtml(vtSlug)}">
      <a class="hit__link" href="${escapeHtml(doc.u)}">
        <span class="hit__index micro">${String(position + 1).padStart(2, '0')}</span>
        <span class="hit__main">
          <span class="hit__kicker micro">${kind} <span class="hit__dot">·</span> ${escapeHtml(doc.c)} <span class="hit__dot">·</span> ${stamp}</span>
          <span class="hit__title" data-vt-title>${escapeHtml(doc.t)}</span>
          ${doc.s ? `<span class="hit__sub">${escapeHtml(doc.s)}</span>` : ''}
          ${tags ? `<span class="hit__tags">${tags}</span>` : ''}
        </span>
      </a>
    </li>
  `;
}

export function initSearch(): void {
  const form = document.querySelector<HTMLFormElement>('[data-search]');
  if (!form) return;

  const input = form.querySelector<HTMLInputElement>('[data-search-input]');
  const results = document.querySelector<HTMLElement>('[data-search-results]');
  const status = document.querySelector<HTMLElement>('[data-search-status]');
  const empty = document.querySelector<HTMLElement>('[data-search-empty]');
  if (!input || !results || !status) return;

  let pending = 0;

  const paint = (query: string): void => {
    if (!index) return;

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      results.innerHTML = '';
      status.textContent = 'Awaiting query.';
      empty?.toggleAttribute('hidden', true);
      return;
    }

    const hits = search(index, trimmed);
    results.innerHTML = hits.map(renderHit).join('');
    status.textContent =
      hits.length === 0
        ? `No records match "${trimmed}".`
        : `${hits.length} ${hits.length === 1 ? 'record' : 'records'} matched.`;
    decode(status, 220);
    empty?.toggleAttribute('hidden', hits.length > 0);
  };

  const run = (query: string): void => {
    const ticket = (pending += 1);
    if (!index) {
      status.textContent = 'Indexing…';
      decode(status, 180);
    }
    void loadIndex()
      .then(() => {
        if (ticket !== pending) return;
        paint(query);
      })
      .catch(() => {
        status.textContent = 'Search index unavailable. Try reloading.';
      });
  };

  const sync = (query: string): void => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  };

  let timer: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    const value = input.value;
    timer = window.setTimeout(() => {
      run(value);
      sync(value);
    }, 90);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(input.value);
    sync(input.value);
  });

  // Warm the index as soon as the field is touched, before a key is pressed.
  input.addEventListener('focus', () => void loadIndex().catch(() => undefined), { once: true });

  const initial = new URL(window.location.href).searchParams.get('q');
  if (initial) {
    input.value = initial;
    run(initial);
  }

  input.focus({ preventScroll: true });
}

/** `/` focuses search from anywhere; Escape releases it. */
export function initSearchShortcut(): void {
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable === true;

    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
      const input = document.querySelector<HTMLInputElement>('[data-search-input]');
      if (input) {
        event.preventDefault();
        input.focus();
        return;
      }
      event.preventDefault();
      window.location.assign('/search/');
    }

    if (event.key === 'Escape' && target instanceof HTMLInputElement && target.dataset.searchInput !== undefined) {
      target.blur();
    }
  });
}
