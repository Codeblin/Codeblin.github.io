/**
 * GitHub Security Advisories, fetched on the server.
 *
 * The browser must not call api.github.com — unauthenticated requests share a
 * 60/hour cap per public IP, which a lab or office exhausts immediately.
 * Build (and `astro dev`) pull the list here, optionally with GITHUB_TOKEN,
 * and the footer reads the same-origin JSON.
 */

export interface Advisory {
  cve: string;
  ghsa: string;
  severity: string;
  summary: string;
  href: string;
}

interface GithubAdvisory {
  ghsa_id?: string;
  cve_id?: string | null;
  html_url?: string;
  summary?: string;
  severity?: string | null;
  withdrawn_at?: string | null;
}

const UPSTREAM = 'https://api.github.com/advisories?per_page=40&type=reviewed';
const CACHE_MS = 30 * 60 * 1000;

let memo: { at: number; items: Advisory[] } | null = null;

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

export async function loadAdvisories(): Promise<Advisory[]> {
  if (memo && Date.now() - memo.at < CACHE_MS) return memo.items;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'codeblin-publication',
  };
  const token = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(UPSTREAM, { headers });
    if (!response.ok) {
      console.warn(`[advisories] GitHub ${response.status} ${response.statusText}`);
      return memo?.items ?? [];
    }
    const payload = (await response.json()) as GithubAdvisory[];
    const items = normalise(payload);
    memo = { at: Date.now(), items };
    return items;
  } catch (error) {
    console.warn('[advisories] fetch failed', error);
    return memo?.items ?? [];
  }
}
