import {
  contentRoot,
  invalidatePageCache,
  invalidatePostCache,
  invalidateProjectCache,
  invalidateTaxonomyCache,
} from '@codeblin/content';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * The site reads `content/` directly rather than through an Astro content
 * collection, so Vite has no idea those files are part of the module graph.
 * This plugin tells it: watch the content tree, drop the repository caches on
 * any change, and reload the browser.
 *
 * That is the whole coupling between the CMS and the preview — the CMS writes
 * a file, this notices, the page re-renders.
 */
export function contentWatcher(): Plugin {
  return {
    name: 'codeblin:content-watcher',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').includes('/preview/')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
        next();
      });
      server.watcher.add(contentRoot);
      server.watcher.on('all', (_event: string, file: string) => {
        const incoming = file.replaceAll('\\', '/').toLowerCase();
        const root = contentRoot.replaceAll('\\', '/').toLowerCase();
        if (!incoming.startsWith(root)) return;
        invalidatePostCache();
        invalidateProjectCache();
        invalidatePageCache();
        invalidateTaxonomyCache();
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          const id = mod.id ?? '';
          if (id.includes('preview') || id.includes('@codeblin/content') || id.includes('content/src')) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
        server.hot.send({ type: 'full-reload' });
      });
    },
  };
}
