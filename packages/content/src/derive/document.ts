import type { Block } from '../schema/blocks.ts';
import type { HeadingRef } from '../schema/post.ts';
import { countWords, extractText } from './text.ts';

/** Words per minute for technical prose. Deliberately below the usual 250. */
const WPM = 230;
/** Seconds a reader spends on a code or terminal block beyond its word count. */
const SECONDS_PER_CODE_BLOCK = 4;
const SECONDS_PER_TERMINAL_BLOCK = 3;

export interface DerivedDocument {
  headings: HeadingRef[];
  readingMinutes: number;
  wordCount: number;
  plainText: string;
  literalText: string;
}

export function deriveDocument(blocks: readonly Block[]): DerivedDocument {
  const text = extractText(blocks);
  const wordCount = countWords(text.prose);
  const seconds =
    (wordCount / WPM) * 60 +
    text.codeBlocks * SECONDS_PER_CODE_BLOCK +
    text.terminalBlocks * SECONDS_PER_TERMINAL_BLOCK;

  return {
    headings: collectHeadings(blocks),
    readingMinutes: Math.max(1, Math.round(seconds / 60)),
    wordCount,
    plainText: text.prose,
    literalText: text.literal,
  };
}

/**
 * Only top-level headings enter the table of contents. Headings nested inside
 * a finding or callout belong to that block, not to the document outline.
 *
 * The offset is the heading's index in hexadecimal — the archive's counting
 * motif, and a real number rather than decoration.
 */
export function collectHeadings(blocks: readonly Block[]): HeadingRef[] {
  const headings: HeadingRef[] = [];
  for (const block of blocks) {
    if (block.type !== 'heading') continue;
    headings.push({
      anchor: block.anchor,
      text: block.text,
      level: block.level,
      offset: toHexOffset(headings.length),
    });
  }
  return headings;
}

export function toHexOffset(index: number): string {
  return `0x${index.toString(16).toUpperCase().padStart(2, '0')}`;
}
