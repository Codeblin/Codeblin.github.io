/**
 * Footer status strip: a live UTC clock and a moving tape of compact,
 * clickable GitHub security advisories (severity + CVE).
 *
 * The GitHub request is unauthenticated, sends no cookies, and omits the
 * referrer. Results live in sessionStorage for 30 minutes so a session does
 * not burn the unauthenticated rate limit.
 */

const ADVISORIES_URL =
  'https://api.github.com/advisories?per_page=40&type=reviewed';
const CACHE_KEY = 'cb-ghsa-v2';
const CACHE_MS = 30 * 60 * 1000;

interface Advisory {
  cve: string;
  ghsa: string;
  severity: string;
  summary: string;
  href: string;
}

interface CacheEnvelope {
  t: number;
  items: Advisory[];
}

interface GithubAdvisory {
  ghsa_id?: string;
  cve_id?: string | null;
  html_url?: string;
  summary?: string;
  severity?: string | null;
  withdrawn_at?: string | null;
}

const reduced = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function utcParts(now = new Date()): { date: string; time: string } {
  const iso = now.toISOString();
  return {
    date: iso.slice(0, 10).replaceAll('-', '.'),
    time: iso.slice(11, 19),
  };
}

function readCache(): Advisory[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed.t || !Array.isArray(parsed.items)) return null;
    if (Date.now() - parsed.t > CACHE_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(items: Advisory[]): void {
  try {
    const envelope: CacheEnvelope = { t: Date.now(), items };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    /* private mode / quota — the fetch still succeeded */
  }
}

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'github.com') return null;
    if (!parsed.pathname.startsWith('/advisories')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function normalise(payload: GithubAdvisory[]): Advisory[] {
  const items: Advisory[] = [];
  for (const entry of payload) {
    if (entry.withdrawn_at || !entry.summary) continue;
    const href = entry.html_url ? safeHref(entry.html_url) : null;
    if (!href) continue;
    items.push({
      cve: entry.cve_id ?? '',
      ghsa: entry.ghsa_id ?? '',
      severity: (entry.severity ?? 'unknown').toLowerCase(),
      summary: entry.summary,
      href,
    });
  }
  return items;
}

async function loadAdvisories(): Promise<Advisory[]> {
  const cached = readCache();
  if (cached && cached.length > 0) return cached;

  const response = await fetch(ADVISORIES_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`ghsa ${response.status}`);
  const payload = (await response.json()) as GithubAdvisory[];
  const items = normalise(payload);
  if (items.length > 0) writeCache(items);
  return items;
}

function chip(item: Advisory): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'footer__feed-chip';
  link.href = item.href;
  link.rel = 'noopener noreferrer';
  link.title = item.summary;
  const label = item.cve || item.ghsa;
  link.setAttribute('aria-label', `${item.severity} ${label}: ${item.summary}`);

  const sev = document.createElement('span');
  sev.className = 'footer__feed-sev micro';
  sev.dataset['tone'] = item.severity;
  sev.textContent = item.severity;

  const id = document.createElement('span');
  id.className = 'footer__feed-id micro';
  id.textContent = label;

  link.append(sev, id);
  return link;
}

function fill(track: HTMLElement, items: Advisory[], duplicate: boolean): void {
  const fragment = document.createDocumentFragment();
  const copies = duplicate ? 2 : 1;
  for (let copy = 0; copy < copies; copy += 1) {
    for (const item of items) fragment.append(chip(item));
  }
  track.replaceChildren(fragment);
}

function restartTrack(track: HTMLElement): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && track.contains(active)) active.blur();

  const duration = track.style.animationDuration;
  track.style.animation = 'none';
  void track.offsetWidth;
  track.style.animation = '';
  if (duration) track.style.animationDuration = duration;
}

export function initFeed(): void {
  const root = document.querySelector<HTMLElement>('[data-feed]');
  if (!root) return;

  const date = root.querySelector<HTMLElement>('[data-feed-date]');
  const clock = root.querySelector<HTMLElement>('[data-feed-clock]');
  const track = root.querySelector<HTMLElement>('[data-feed-track]');
  const tick = (): void => {
    const parts = utcParts();
    if (date) date.textContent = parts.date;
    if (clock) clock.textContent = parts.time;
  };
  tick();
  window.setInterval(tick, 1000);
  if (!track) return;

  const resume = (): void => {
    if (root.dataset['static'] !== undefined) return;
    restartTrack(track);
  };
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume();
  });

  void loadAdvisories()
    .then((items) => {
      if (items.length === 0) {
        track.replaceChildren();
        return;
      }

      const motion = !reduced();
      fill(track, items, motion);
      if (motion) {
        track.style.animationDuration = `${Math.max(80, items.length * 4)}s`;
        resume();
      } else {
        track.classList.remove('cb-loop');
        root.dataset['static'] = '';
      }
    })
    .catch(() => {
      track.replaceChildren();
    });
}
