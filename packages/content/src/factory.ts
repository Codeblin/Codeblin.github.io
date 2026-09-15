import {
  BLOCK_TYPES,
  type Block,
  type BlockType,
} from './schema/blocks.ts';
import { newBlockId } from './repository/write.ts';

/** A well-formed empty block of the given type, for the editor's insert command. */
export function emptyBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case 'prose':
      return { id, type, markdown: '' };
    case 'heading':
      return { id, type, level: 2, text: 'Heading', anchor: id };
    case 'code':
      return { id, type, lang: 'text', source: '' };
    case 'terminal':
      return { id, type, lines: [{ kind: 'prompt', text: '' }] };
    case 'http':
      return { id, type, direction: 'request', source: 'GET / HTTP/1.1\nHost: example.com\n' };
    case 'image':
      return { id, type, src: './media/placeholder.png', alt: 'Replace this image', duotone: true, width: 'column' };
    case 'gallery':
      return {
        id,
        type,
        columns: 2,
        duotone: true,
        items: [
          { src: './media/one.png', alt: 'Replace this image' },
          { src: './media/two.png', alt: 'Replace this image' },
        ],
      };
    case 'quote':
      return { id, type, body: 'Quote' };
    case 'table':
      return { id, type, head: ['Field', 'Value'], rows: [['', '']] };
    case 'list':
      return { id, type, ordered: false, items: ['Item'] };
    case 'filetree':
      return { id, type, root: 'app/', entries: [{ name: 'src', depth: 0, directory: true }] };
    case 'command':
      return { id, type, value: 'command' };
    case 'embed':
      return { id, type, provider: 'youtube', ref: 'dQw4w9WgXcQ', title: 'Embedded' };
    case 'video':
      return { id, type, src: './media/capture.mp4' };
    case 'diagram':
      return { id, type, source: 'a ──▶ b' };
    case 'divider':
      return { id, type, variant: 'rule' };
    case 'finding':
      return { id, type, severity: 'info', body: [{ id: newBlockId(), type: 'prose', markdown: '' }] };
    case 'callout':
      return { id, type, tone: 'note', body: [{ id: newBlockId(), type: 'prose', markdown: '' }] };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown block type: ${String(exhaustive)}`);
    }
  }
}

export { BLOCK_TYPES };
