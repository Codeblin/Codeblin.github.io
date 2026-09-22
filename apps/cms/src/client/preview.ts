/** Live preview origin — same hostname the CMS tab is on, so IPv4/IPv6 match. */
export function previewUrl(kind: 'posts' | 'projects', slug: string, tick = 0): string {
  const host = window.location.hostname;
  const origin =
    host === '127.0.0.1' || host === '[::1]' ? `http://${host}:4321` : 'http://localhost:4321';
  return `${origin}/preview/${kind}/${slug}/?v=${tick}`;
}
