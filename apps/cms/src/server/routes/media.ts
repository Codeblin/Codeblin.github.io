import { Hono } from 'hono';

import { deleteMedia, listMedia, readMedia, saveMedia, SLUG_PATTERN, type MediaKind } from '@codeblin/content';

const MAX_BYTES = 32 * 1024 * 1024;

export function mediaRoutes(kind: MediaKind): Hono {
  const media = new Hono();

  media.get('/:slug/media', (context) => {
    const slug = context.req.param('slug');
    if (!SLUG_PATTERN.test(slug)) return context.json({ error: 'Invalid slug' }, 400);
    return context.json({ files: listMedia(slug, kind) });
  });

  media.get('/:slug/media/:file', (context) => {
    const slug = context.req.param('slug');
    const file = context.req.param('file');
    try {
      const bytes = readMedia(slug, file, kind);
      const ext = file.split('.').pop()?.toLowerCase();
      const types: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        avif: 'image/avif',
        mp4: 'video/mp4',
      };
      return new Response(Uint8Array.from(bytes), {
        headers: {
          'content-type': types[ext ?? ''] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Not found';
      return context.json({ error: message }, 404);
    }
  });

  media.post('/:slug/media', async (context) => {
    const slug = context.req.param('slug');
    const form = await context.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return context.json({ error: 'Expected a file field.' }, 400);
    if (file.size > MAX_BYTES) return context.json({ error: 'File exceeds 32 MB.' }, 413);

    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const src = saveMedia(slug, file.name, bytes, kind);
      return context.json({ src, files: listMedia(slug, kind) }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rejected';
      return context.json({ error: message }, 400);
    }
  });

  media.delete('/:slug/media/:file', (context) => {
    const slug = context.req.param('slug');
    const file = context.req.param('file');
    try {
      deleteMedia(slug, file, kind);
      return context.json({ ok: true, files: listMedia(slug, kind) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Not found';
      return context.json({ error: message }, 404);
    }
  });

  return media;
}
