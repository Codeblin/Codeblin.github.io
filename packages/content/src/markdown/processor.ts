import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import type { Root } from 'mdast';

/**
 * One processor configuration, shared by the block parser and the inline HTML
 * renderer, so the two can never disagree about what the source means.
 *
 * `remark-directive` supplies the syntax for every non-prose block;
 * `remark-gfm` supplies tables, strikethrough and autolinks. Raw HTML is
 * parsed into `html` nodes and then discarded downstream — it is never
 * rendered.
 */
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).freeze();

export function parseMarkdown(source: string): Root {
  return processor.parse(source);
}

export function getProcessor(): Processor<Root> {
  return processor as unknown as Processor<Root>;
}
