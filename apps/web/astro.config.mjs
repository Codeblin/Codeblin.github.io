import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { contentWatcher } from './src/integrations/content-watcher.ts';
import { site } from './src/site.config.ts';

/**
 * The publication is a static artifact. No adapter, no server runtime, no
 * client framework — islands are plain scripts, and the only JavaScript that
 * ships is listed in ARCHITECTURE.md §6.
 */
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: false,
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/_draft/'),
    }),
  ],
  image: {
    // Content images live outside the app, so the pipeline needs to be told
    // that the repository root is a legitimate source.
    responsiveStyles: true,
    layout: 'constrained',
  },
  server: {
    port: 4321,
    host: 'localhost',
  },
  vite: {
    plugins: [contentWatcher()],
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      fs: {
        allow: [fileURLToPath(new URL('../../', import.meta.url))],
      },
    },
  },
  devToolbar: {
    enabled: false,
  },
  telemetry: false,
});
