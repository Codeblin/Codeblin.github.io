import GithubSlugger from 'github-slugger';
import { toString as mdastToString } from 'mdast-util-to-string';
import type { List, Node, Paragraph, Parent, Root, RootContent, Table } from 'mdast';
import type { ContainerDirective, LeafDirective } from 'mdast-util-directive';

import { parseMarkdown } from './processor.ts';
import {
  parseLineRanges,
  parseMeta,
  readAttribute,
  readBooleanAttribute,
  readIntAttribute,
} from './attributes.ts';
import {
  CALLOUT_TONES,
  DIVIDER_VARIANTS,
  EMBED_PROVIDERS,
  FINDING_STATUSES,
  IMAGE_WIDTHS,
  SEVERITIES,
  type Block,
  type FileTreeEntry,
  type TableAlignment,
  type TerminalLine,
} from '../schema/blocks.ts';

export interface Diagnostic {
  level: 'error' | 'warning';
  message: string;
  line?: number;
}

export interface ParsedBody {
  blocks: Block[];
  diagnostics: Diagnostic[];
}

interface ParseContext {
  source: string;
  slugger: GithubSlugger;
  diagnostics: Diagnostic[];
  counter: { value: number };
}

/** Fenced languages that mean something other than "highlight this code". */
const SPECIAL_FENCES = new Set([
  'terminal',
  'http-request',
  'http-response',
  'filetree',
  'command',
  'diagram',
]);

/**
 * Line endings are normalised here rather than at every call site. The block
 * model is LF-only, which keeps a document authored on Windows byte-identical
 * to the same document authored on Linux — see ARCHITECTURE.md risk 6.
 */
export function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n/g, '\n');
}

export function parseBlocks(input: string): ParsedBody {
  const markdown = normalizeLineEndings(input);
  const tree: Root = parseMarkdown(markdown);
  const context: ParseContext = {
    source: markdown,
    slugger: new GithubSlugger(),
    diagnostics: [],
    counter: { value: 0 },
  };
  const blocks = nodesToBlocks(tree.children, context);
  return { blocks, diagnostics: context.diagnostics };
}

function nodesToBlocks(nodes: readonly RootContent[], context: ParseContext): Block[] {
  const blocks: Block[] = [];
  for (const node of nodes) {
    const block = nodeToBlock(node, context);
    if (block) blocks.push(block);
  }
  return blocks;
}

function nodeToBlock(node: RootContent, context: ParseContext): Block | null {
  switch (node.type) {
    case 'heading':
      return headingBlock(node.depth, mdastToString(node), context);
    case 'code':
      return codeLikeBlock(node.lang, node.meta, node.value, context);
    case 'thematicBreak':
      return { id: nextId(context), type: 'divider', variant: 'rule' };
    case 'blockquote':
      return {
        id: nextId(context),
        type: 'quote',
        body: stripQuoteMarkers(slice(node, context)),
      };
    case 'list':
      return listBlock(node, context);
    case 'table':
      return tableBlock(node, context);
    case 'paragraph':
      return paragraphBlock(node, context);
    case 'containerDirective':
      return containerBlock(node, context);
    case 'leafDirective':
      return leafBlock(node, context);
    case 'textDirective':
      report(context, 'error', `Inline directive ":${node.name}" is not supported.`, node);
      return null;
    case 'html':
      report(context, 'error', 'Raw HTML is not rendered. Use a block directive.', node);
      return null;
    default:
      return { id: nextId(context), type: 'prose', markdown: slice(node, context) };
  }
}

// ── Block builders ─────────────────────────────────────────────────────────

function headingBlock(depth: number, text: string, context: ParseContext): Block {
  if (depth === 1) {
    report(context, 'warning', 'A level-1 heading belongs in the title, not the body.');
  }
  const level: 2 | 3 | 4 = depth <= 2 ? 2 : depth === 3 ? 3 : 4;
  return {
    id: nextId(context),
    type: 'heading',
    level,
    text,
    anchor: context.slugger.slug(text),
  };
}

function codeLikeBlock(
  lang: string | null | undefined,
  meta: string | null | undefined,
  value: string,
  context: ParseContext,
): Block {
  const language = (lang ?? '').trim();
  const attributes = parseMeta(meta);
  const id = nextId(context);

  if (!SPECIAL_FENCES.has(language)) {
    return {
      id,
      type: 'code',
      lang: /^[\w+#-]*$/.test(language) ? language : '',
      filename: attributes['title'],
      highlight: parseLineRanges(attributes['lines']),
      startLine: positiveInt(attributes['start']),
      source: value,
    };
  }

  switch (language) {
    case 'terminal':
      return {
        id,
        type: 'terminal',
        host: attributes['host'],
        exitCode: integer(attributes['exit']),
        lines: parseTerminalLines(value),
      };
    case 'http-request':
    case 'http-response':
      return {
        id,
        type: 'http',
        direction: language === 'http-request' ? 'request' : 'response',
        source: value,
      };
    case 'filetree':
      return {
        id,
        type: 'filetree',
        root: attributes['root'] ?? '.',
        entries: parseFileTree(value),
      };
    case 'command':
      return { id, type: 'command', value: value.trim(), note: attributes['note'] };
    default:
      return { id, type: 'diagram', source: value, caption: attributes['caption'] };
  }
}

function listBlock(node: List, context: ParseContext): Block {
  const items: string[] = [];
  for (const item of node.children) {
    const [only] = item.children;
    if (item.children.length !== 1 || !only || only.type !== 'paragraph') {
      // Nested or multi-paragraph lists carry more structure than the list
      // block can express, so the source is kept verbatim instead.
      return { id: nextId(context), type: 'prose', markdown: slice(node, context) };
    }
    items.push(slice(only, context));
  }
  if (items.length === 0) {
    return { id: nextId(context), type: 'prose', markdown: slice(node, context) };
  }
  return { id: nextId(context), type: 'list', ordered: node.ordered === true, items };
}

function tableBlock(node: Table, context: ParseContext): Block {
  const [headerRow, ...bodyRows] = node.children;
  const head = headerRow ? headerRow.children.map((cell) => sliceChildren(cell, context)) : [];
  const rows = bodyRows.map((row) => row.children.map((cell) => sliceChildren(cell, context)));
  const align = node.align?.map<TableAlignment | null>((value) => value ?? null);
  return {
    id: nextId(context),
    type: 'table',
    head,
    rows,
    align: align && align.some((value) => value !== null) ? align : undefined,
  };
}

function paragraphBlock(node: Paragraph, context: ParseContext): Block {
  const meaningful = node.children.filter(
    (child) => !(child.type === 'text' && child.value.trim() === ''),
  );
  const [only] = meaningful;
  if (meaningful.length === 1 && only?.type === 'image') {
    const alt = only.alt?.trim() ?? '';
    if (!alt) report(context, 'error', `Image "${only.url}" has no alt text.`, node);
    return {
      id: nextId(context),
      type: 'image',
      src: only.url,
      alt,
      caption: only.title ?? undefined,
      duotone: true,
      width: 'column',
    };
  }
  return { id: nextId(context), type: 'prose', markdown: slice(node, context) };
}

function containerBlock(node: ContainerDirective, context: ParseContext): Block | null {
  const attributes = node.attributes ?? {};
  const id = nextId(context);

  if (node.name === 'finding') {
    const severity = enumValue(readAttribute(attributes, 'severity'), SEVERITIES);
    if (!severity) {
      report(context, 'error', 'A finding needs severity=info|low|medium|high|critical.', node);
    }
    return {
      id,
      type: 'finding',
      findingId: readAttribute(attributes, 'id'),
      severity: severity ?? 'info',
      cwe: readAttribute(attributes, 'cwe'),
      cvss: readAttribute(attributes, 'cvss'),
      status: enumValue(readAttribute(attributes, 'status'), FINDING_STATUSES),
      title: readAttribute(attributes, 'title'),
      body: nodesToBlocks(node.children, context),
    };
  }

  const tone = enumValue(node.name, CALLOUT_TONES);
  if (tone) {
    return {
      id,
      type: 'callout',
      tone,
      title: readAttribute(attributes, 'title'),
      body: nodesToBlocks(node.children, context),
    };
  }

  if (node.name === 'image') {
    const src = readAttribute(attributes, 'src') ?? '';
    const alt = readAttribute(attributes, 'alt') ?? '';
    if (!alt) report(context, 'error', `Image "${src}" has no alt text.`, node);
    return {
      id,
      type: 'image',
      src,
      alt,
      caption: childText(node, context),
      duotone: readBooleanAttribute(attributes, 'duotone', true),
      width: enumValue(readAttribute(attributes, 'width'), IMAGE_WIDTHS) ?? 'column',
    };
  }

  if (node.name === 'gallery') {
    const items = node.children
      .filter((child): child is LeafDirective => child.type === 'leafDirective')
      .filter((child) => child.name === 'item')
      .map((child) => ({
        src: readAttribute(child.attributes ?? {}, 'src') ?? '',
        alt: readAttribute(child.attributes ?? {}, 'alt') ?? '',
        caption: readAttribute(child.attributes ?? {}, 'caption'),
      }));
    if (items.length < 2) {
      report(context, 'error', 'A gallery needs at least two ::item entries.', node);
    }
    return {
      id,
      type: 'gallery',
      columns: readIntAttribute(attributes, 'columns') === 3 ? 3 : 2,
      duotone: readBooleanAttribute(attributes, 'duotone', true),
      items,
    };
  }

  if (node.name === 'quote') {
    return {
      id,
      type: 'quote',
      body: childText(node, context) ?? '',
      cite: readAttribute(attributes, 'cite'),
      href: readAttribute(attributes, 'href'),
    };
  }

  report(context, 'error', `Unknown block ":::${node.name}".`, node);
  return null;
}

function leafBlock(node: LeafDirective, context: ParseContext): Block | null {
  const attributes = node.attributes ?? {};
  const id = nextId(context);

  switch (node.name) {
    case 'divider':
      return {
        id,
        type: 'divider',
        variant: enumValue(readAttribute(attributes, 'variant'), DIVIDER_VARIANTS) ?? 'rule',
      };
    case 'embed': {
      const provider = enumValue(readAttribute(attributes, 'provider'), EMBED_PROVIDERS);
      if (!provider) {
        report(context, 'error', 'An embed needs provider="youtube" or provider="gist".', node);
        return null;
      }
      return {
        id,
        type: 'embed',
        provider,
        ref: readAttribute(attributes, 'ref') ?? '',
        title: readAttribute(attributes, 'title'),
      };
    }
    case 'video':
      return {
        id,
        type: 'video',
        src: readAttribute(attributes, 'src') ?? '',
        poster: readAttribute(attributes, 'poster'),
        caption: readAttribute(attributes, 'caption'),
      };
    case 'item':
      // Only meaningful inside a gallery, where the parent consumes it.
      return null;
    default:
      report(context, 'error', `Unknown block "::${node.name}".`, node);
      return null;
  }
}

// ── Sub-parsers ────────────────────────────────────────────────────────────

function parseTerminalLines(value: string): TerminalLine[] {
  return value.split('\n').map((line) => {
    if (line.startsWith('$ ')) return { kind: 'prompt', text: line.slice(2) };
    if (line === '$') return { kind: 'prompt', text: '' };
    if (line.startsWith('# ')) return { kind: 'comment', text: line.slice(2) };
    return { kind: 'output', text: line };
  });
}

/**
 * Indentation defines nesting, two spaces per level. A trailing slash marks a
 * directory; ` @ ` introduces an annotation.
 */
function parseFileTree(value: string): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];
  for (const raw of value.split('\n')) {
    if (raw.trim() === '') continue;
    const indent = raw.length - raw.trimStart().length;
    const [namePart, ...noteParts] = raw.trim().split(/\s+@\s+/);
    const name = (namePart ?? '').trim();
    if (!name) continue;
    const note = noteParts.join(' @ ').trim();
    entries.push({
      name: name.replace(/\/$/, ''),
      depth: Math.floor(indent / 2),
      directory: name.endsWith('/'),
      note: note.length > 0 ? note : undefined,
    });
  }
  return entries;
}

function stripQuoteMarkers(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/^\s{0,3}>\s?/, ''))
    .join('\n')
    .trim();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function slice(node: Node, context: ParseContext): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return '';
  return context.source.slice(start, end);
}

/**
 * Table cell positions include the surrounding pipes and padding, so a cell's
 * text is taken from its first child to its last instead.
 */
function sliceChildren(node: Parent, context: ParseContext): string {
  const first = node.children.at(0)?.position?.start.offset;
  const last = node.children.at(-1)?.position?.end.offset;
  if (first === undefined || last === undefined) return '';
  return context.source.slice(first, last).trim();
}

function childText(node: ContainerDirective, context: ParseContext): string | undefined {
  const text = node.children
    .filter((child) => child.type === 'paragraph')
    .map((child) => slice(child, context))
    .join('\n\n')
    .trim();
  return text.length > 0 ? text : undefined;
}

function nextId(context: ParseContext): string {
  context.counter.value += 1;
  return `b${context.counter.value}`;
}

function report(
  context: ParseContext,
  level: Diagnostic['level'],
  message: string,
  node?: Node,
): void {
  context.diagnostics.push({ level, message, line: node?.position?.start.line });
}

function enumValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function integer(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveInt(value: string | undefined): number | undefined {
  const parsed = integer(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}
