import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Element, Root as HastRoot } from 'hast';

import { safeHrefSchema } from '../schema/blocks.ts';

/**
 * Prose markdown to HTML.
 *
 * `allowDangerousHtml` is false, so raw HTML in content is dropped at the
 * mdast→hast boundary rather than being sanitised afterwards. There is no
 * pass where unsafe markup exists and then gets cleaned up; it never becomes
 * markup in the first place.
 */
function hardenElements() {
  return (tree: HastRoot): void => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a') {
        const href = node.properties?.['href'];
        if (typeof href !== 'string' || !safeHrefSchema.safeParse(href).success) {
          delete node.properties?.['href'];
          return;
        }
        if (href.startsWith('https://')) {
          node.properties = {
            ...node.properties,
            rel: ['noopener', 'noreferrer'],
            target: '_blank',
            'data-external': 'true',
          };
        }
      }

      if (node.tagName === 'img') {
        node.properties = { ...node.properties, loading: 'lazy', decoding: 'async' };
      }
    });
  };
}

const renderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(hardenElements)
  .use(rehypeStringify)
  .freeze();

/** Block-level render: paragraphs, lists and emphasis, wrapped as usual. */
export function renderMarkdown(markdown: string): string {
  if (markdown.trim() === '') return '';
  return String(renderer.processSync(markdown)).trim();
}

/** Same pipeline, with a single wrapping paragraph removed. */
export function renderInline(markdown: string): string {
  const html = renderMarkdown(markdown);
  const match = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return match?.[1] !== undefined && !match[1].includes('<p>') ? match[1] : html;
}
