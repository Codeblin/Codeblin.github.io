/**
 * YouTube identifiers for the video block.
 *
 * A `youtube:<id>` src is stored so the renderer can iframe
 * youtube-nocookie.com. Full watch URLs are accepted at parse time and
 * reduced to this form.
 */

const VIDEO_ID = /^[\w-]{11}$/;

export function youtubeSrc(id: string): string {
  return `youtube:${id}`;
}

export function isYoutubeSrc(src: string): boolean {
  return src.startsWith('youtube:');
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Extract an 11-character video id from an id, `youtube:` src, or watch URL. */
export function parseYoutubeRef(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith('youtube:')) {
    const id = raw.slice('youtube:'.length);
    return VIDEO_ID.test(id) ? id : null;
  }

  if (VIDEO_ID.test(raw) && !raw.includes('/') && !raw.includes('.')) return raw;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return VIDEO_ID.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const queryId = url.searchParams.get('v');
      if (queryId && VIDEO_ID.test(queryId)) return queryId;
      const parts = url.pathname.split('/').filter(Boolean);
      const nested = parts[0];
      const candidate = parts[1];
      if (
        candidate &&
        VIDEO_ID.test(candidate) &&
        (nested === 'embed' || nested === 'shorts' || nested === 'live' || nested === 'v')
      ) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}
