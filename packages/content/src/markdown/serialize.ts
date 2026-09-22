import { formatLineRanges, writeAttributes } from './attributes.ts';
import { looksLikeMermaid } from '../mermaid.ts';
import type { Block, TableAlignment } from '../schema/blocks.ts';

/**
 * Blocks back to markdown.
 *
 * Prose is written out verbatim, so hand-written paragraphs survive a round
 * trip byte for byte. Everything else is generated in one canonical form,
 * which is what makes `serialise(parse(x))` idempotent — see the round-trip
 * tests, which assert exactly that.
 */
export function serializeBlocks(blocks: readonly Block[]): string {
  const body = blocks.map((block) => serializeBlock(block)).filter((chunk) => chunk.length > 0);
  return body.length > 0 ? `${body.join('\n\n')}\n` : '';
}

function serializeBlock(block: Block): string {
  switch (block.type) {
    case 'prose':
      return block.markdown.trim().length > 0 ? block.markdown.trim() : '<!-- empty -->';

    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text.trim()}`;

    case 'code':
      return fence(
        block.lang,
        writeAttributes([
          ['title', block.filename],
          ['lines', formatLineRanges(block.highlight)],
          ['start', block.startLine],
        ]),
        block.source,
      );

    case 'terminal':
      return fence(
        'terminal',
        writeAttributes([
          ['host', block.host],
          ['exit', block.exitCode],
        ]),
        block.lines
          .map((line) =>
            line.kind === 'prompt'
              ? `$ ${line.text}`.trimEnd()
              : line.kind === 'comment'
                ? `# ${line.text}`.trimEnd()
                : line.text,
          )
          .join('\n'),
      );

    case 'http':
      return fence(`http-${block.direction}`, '', block.source);

    case 'filetree':
      return fence(
        'filetree',
        writeAttributes([['root', block.root]]),
        block.entries
          .map((entry) => {
            const indent = '  '.repeat(entry.depth);
            const name = entry.directory ? `${entry.name}/` : entry.name;
            return entry.note ? `${indent}${name} @ ${entry.note}` : `${indent}${name}`;
          })
          .join('\n'),
      );

    case 'command':
      return fence('command', writeAttributes([['note', block.note]]), block.value);

    case 'diagram':
      return fence(
        looksLikeMermaid(block.source) ? 'mermaid' : 'diagram',
        writeAttributes([['caption', block.caption]]),
        block.source,
      );

    case 'finding':
      return container(
        'finding',
        writeAttributes([
          ['id', block.findingId],
          ['severity', block.severity],
          ['cwe', block.cwe],
          ['cvss', block.cvss],
          ['status', block.status],
          ['title', block.title],
        ]),
        serializeBlocks(block.body).trimEnd(),
      );

    case 'callout':
      return container(
        block.tone,
        writeAttributes([['title', block.title]]),
        serializeBlocks(block.body).trimEnd(),
      );

    case 'image':
      return container(
        'image',
        writeAttributes([
          ['src', block.src],
          ['alt', block.alt],
          ['width', block.width === 'column' ? undefined : block.width],
          ['duotone', block.duotone ? undefined : 'false'],
        ]),
        block.caption?.trim() ?? '',
      );

    case 'gallery':
      return container(
        'gallery',
        writeAttributes([
          ['columns', block.columns === 2 ? undefined : block.columns],
          ['duotone', block.duotone ? undefined : 'false'],
        ]),
        block.items
          .map((item) =>
            `::item{${writeAttributes([
              ['src', item.src],
              ['alt', item.alt],
              ['caption', item.caption],
            ])}}`,
          )
          .join('\n\n'),
      );

    case 'quote':
      return block.cite || block.href
        ? container(
            'quote',
            writeAttributes([
              ['cite', block.cite],
              ['href', block.href],
            ]),
            block.body.trim(),
          )
        : block.body
            .trim()
            .split('\n')
            .map((line) => (line.length > 0 ? `> ${line}` : '>'))
            .join('\n');

    case 'table':
      return serializeTable(block.head, block.rows, block.align);

    case 'list':
      return block.items
        .map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${item.trim()}`)
        .join('\n');

    case 'video':
      return `::video{${writeAttributes([
        ['src', block.src],
        ['poster', block.poster],
        ['caption', block.caption],
      ])}}`;

    case 'embed':
      return `::embed{${writeAttributes([
        ['provider', block.provider],
        ['ref', block.ref],
        ['title', block.title],
      ])}}`;

    case 'divider':
      return block.variant === 'rule'
        ? '---'
        : `::divider{${writeAttributes([['variant', block.variant]])}}`;
  }
}

function fence(lang: string, attributes: string, source: string): string {
  // A fence must be longer than the longest run of backticks it contains,
  // otherwise embedded markdown examples terminate the block early.
  const longest = Math.max(2, ...[...source.matchAll(/`+/g)].map((match) => match[0].length));
  const ticks = '`'.repeat(longest + 1);
  const info = attributes ? `${lang} ${attributes}` : lang;
  return `${ticks}${info}\n${source.replace(/\n+$/, '')}\n${ticks}`;
}

function container(name: string, attributes: string, body: string): string {
  // A container must be fenced with more colons than anything it contains,
  // otherwise a nested callout closes its parent early.
  const nested = Math.max(
    2,
    ...[...body.matchAll(/^:{2,}/gm)].map((match) => (match[0] as string).length),
  );
  const colons = ':'.repeat(Math.max(3, nested + 1));
  const head = attributes ? `${colons}${name}{${attributes}}` : `${colons}${name}`;
  return body.length > 0 ? `${head}\n${body}\n${colons}` : `${head}\n${colons}`;
}

function serializeTable(
  head: readonly string[],
  rows: ReadonlyArray<readonly string[]>,
  align: ReadonlyArray<TableAlignment | null> | undefined,
): string {
  const columns = Math.max(head.length, ...rows.map((row) => row.length), 1);
  const pad = (cells: readonly string[]): string =>
    `| ${Array.from({ length: columns }, (_, index) => cells[index] ?? '').join(' | ')} |`;

  const divider = Array.from({ length: columns }, (_, index) => {
    switch (align?.[index]) {
      case 'left':
        return ':---';
      case 'center':
        return ':---:';
      case 'right':
        return '---:';
      default:
        return '---';
    }
  });

  return [pad(head), `| ${divider.join(' | ')} |`, ...rows.map(pad)].join('\n');
}
