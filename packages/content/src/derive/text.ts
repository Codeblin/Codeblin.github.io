import { isContainerBlock, type Block } from '../schema/blocks.ts';

/**
 * Rough markdown stripping for word counts and the search index. It does not
 * need to be a parser — it needs to be fast, allocation-light, and never to
 * leave syntax characters behind that would pollute a search token.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ExtractedText {
  /** Human prose: everything a reader reads at reading speed. */
  prose: string;
  /** Machine text: code, commands, transcripts. Searchable, not readable. */
  literal: string;
  codeBlocks: number;
  terminalBlocks: number;
}

export function extractText(blocks: readonly Block[]): ExtractedText {
  const prose: string[] = [];
  const literal: string[] = [];
  let codeBlocks = 0;
  let terminalBlocks = 0;

  const walk = (list: readonly Block[]): void => {
    for (const block of list) {
      switch (block.type) {
        case 'prose':
          prose.push(stripMarkdown(block.markdown));
          break;
        case 'heading':
          prose.push(block.text);
          break;
        case 'list':
          prose.push(block.items.map(stripMarkdown).join(' '));
          break;
        case 'table':
          prose.push([...block.head, ...block.rows.flat()].map(stripMarkdown).join(' '));
          break;
        case 'quote':
          prose.push(stripMarkdown(block.body));
          if (block.cite) prose.push(block.cite);
          break;
        case 'image':
          if (block.caption) prose.push(stripMarkdown(block.caption));
          break;
        case 'gallery':
          for (const item of block.items) if (item.caption) prose.push(item.caption);
          break;
        case 'video':
          if (block.caption) prose.push(block.caption);
          break;
        case 'code':
          codeBlocks += 1;
          literal.push(block.source);
          if (block.filename) literal.push(block.filename);
          break;
        case 'terminal':
          terminalBlocks += 1;
          literal.push(block.lines.map((line) => line.text).join('\n'));
          break;
        case 'http':
        case 'diagram':
          literal.push(block.source);
          break;
        case 'command':
          literal.push(block.value);
          if (block.note) prose.push(block.note);
          break;
        case 'filetree':
          literal.push(block.entries.map((entry) => entry.name).join(' '));
          for (const entry of block.entries) if (entry.note) prose.push(entry.note);
          break;
        default:
          break;
      }

      if (isContainerBlock(block)) {
        if (block.title) prose.push(block.title);
        if (block.type === 'finding' && block.findingId) literal.push(block.findingId);
        walk(block.body);
      }
    }
  };

  walk(blocks);

  return {
    prose: prose.filter(Boolean).join(' '),
    literal: literal.filter(Boolean).join('\n'),
    codeBlocks,
    terminalBlocks,
  };
}

export function countWords(text: string): number {
  if (text.trim() === '') return 0;
  return text.trim().split(/\s+/).length;
}
