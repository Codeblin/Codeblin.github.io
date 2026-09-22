/**
 * Browser-safe surface of @codeblin/content.
 *
 * The CMS editor runs in Vite. Importing the package root also loads the
 * filesystem repository, which calls `node:fs` at module init and crashes
 * the client. Schemas, the empty-block factory, and id helpers live here.
 */

export * from './schema/index.ts';
export { emptyBlock } from './factory.ts';
export { newBlockId, slugify, today } from './ids.ts';
export { looksLikeMermaid, sanitizeMermaidSvg } from './mermaid.ts';
export { isYoutubeSrc, parseYoutubeRef, youtubeSrc, youtubeWatchUrl } from './youtube.ts';
