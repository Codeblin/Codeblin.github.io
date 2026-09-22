import type { AstroIntegration } from 'astro';

/**
 * Registers `/preview/[kind]/[slug]/` only while `astro dev` is running.
 *
 * The publication is static — this route must not exist at build time, and
 * it must not use `getStaticPaths` in dev or the iframe freezes on the first
 * snapshot (and newly created drafts 404 until restart).
 */
export function cmsPreview(): AstroIntegration {
  return {
    name: 'codeblin:cms-preview',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({
          pattern: '/preview/[kind]/[slug]',
          entrypoint: './src/preview/document.astro',
          prerender: false,
        });
      },
    },
  };
}
