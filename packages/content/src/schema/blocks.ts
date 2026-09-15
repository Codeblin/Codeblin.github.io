import { z } from 'zod';

/**
 * The block vocabulary.
 *
 * This file is the authoritative definition of what an article body may
 * contain. Adding a block type starts here; see CONTENT_MODEL.md §4 for the
 * remaining three steps.
 *
 * Schemas carry no `.default()`. Defaults belong to the parser, which is the
 * one place that turns loose markdown into blocks — that keeps the schema's
 * input and output types identical, which in turn keeps the recursive
 * container types expressible without a cast.
 */

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
export const FINDING_STATUSES = ['open', 'fixed', 'wontfix', 'disputed'] as const;
export const CALLOUT_TONES = ['note', 'tip', 'warning', 'danger'] as const;
export const IMAGE_WIDTHS = ['column', 'wide', 'bleed'] as const;
export const DIVIDER_VARIANTS = ['rule', 'dots', 'gap'] as const;
export const EMBED_PROVIDERS = ['youtube', 'gist'] as const;
export const TABLE_ALIGNMENTS = ['left', 'center', 'right'] as const;

export const severitySchema = z.enum(SEVERITIES);
export const findingStatusSchema = z.enum(FINDING_STATUSES);
export const calloutToneSchema = z.enum(CALLOUT_TONES);

export type Severity = (typeof SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type CalloutTone = (typeof CALLOUT_TONES)[number];
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];
export type DividerVariant = (typeof DIVIDER_VARIANTS)[number];
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];
export type TableAlignment = (typeof TABLE_ALIGNMENTS)[number];

/**
 * Media may only be referenced from the record's own `media/` directory or
 * from the site's shared `/images/` tree. This is the single gate that stops
 * content from reaching arbitrary paths or hotlinking a third party.
 */
export const mediaPathSchema = z
  .string()
  .refine(
    (value) => /^\.\/media\/[\w.-]+$/.test(value) || /^\/images\/[\w./-]+$/.test(value),
    { message: 'Media must be ./media/<file> within the record, or /images/<file>.' },
  );

/**
 * Links may leave the site, but only over schemes that cannot execute
 * anything. `javascript:` and `data:` are rejected by construction rather than
 * stripped by a sanitiser afterwards.
 */
export const safeHrefSchema = z.string().refine(
  (value) =>
    /^https:\/\/[^\s]+$/.test(value) ||
    /^mailto:[^\s@]+@[^\s@]+$/.test(value) ||
    /^\/[^/\s]*$/.test(value) ||
    /^\/[^\s]*$/.test(value) ||
    /^#[\w-]+$/.test(value),
  { message: 'Links must be https, mailto, site-relative, or a fragment.' },
);

const idField = z.string().min(1);

// ── Leaf blocks ────────────────────────────────────────────────────────────

export const proseBlockSchema = z.object({
  id: idField,
  type: z.literal('prose'),
  /** Verbatim markdown source, preserved byte for byte through a round trip. */
  markdown: z.string(),
});

export const headingBlockSchema = z.object({
  id: idField,
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  text: z.string().min(1),
  anchor: z.string().min(1),
});

export const codeBlockSchema = z.object({
  id: idField,
  type: z.literal('code'),
  lang: z.string().regex(/^[\w+#-]*$/),
  filename: z.string().max(120).optional(),
  /** 1-based line numbers to emphasise, expanded from a `4-9,12` range spec. */
  highlight: z.array(z.number().int().positive()).optional(),
  startLine: z.number().int().positive().optional(),
  source: z.string(),
});

export const terminalLineSchema = z.object({
  kind: z.enum(['prompt', 'output', 'comment']),
  text: z.string(),
});

export type TerminalLine = z.infer<typeof terminalLineSchema>;

export const terminalBlockSchema = z.object({
  id: idField,
  type: z.literal('terminal'),
  host: z.string().max(60).optional(),
  exitCode: z.number().int().optional(),
  lines: z.array(terminalLineSchema),
});

export const httpBlockSchema = z.object({
  id: idField,
  type: z.literal('http'),
  direction: z.enum(['request', 'response']),
  /** Raw message: start line, headers, blank line, body. */
  source: z.string().min(1),
});

export const imageBlockSchema = z.object({
  id: idField,
  type: z.literal('image'),
  src: mediaPathSchema,
  alt: z.string().min(1, 'Every image needs alt text.'),
  caption: z.string().optional(),
  duotone: z.boolean(),
  width: z.enum(IMAGE_WIDTHS),
});

export const galleryItemSchema = z.object({
  src: mediaPathSchema,
  alt: z.string().min(1, 'Every image needs alt text.'),
  caption: z.string().optional(),
});

export type GalleryItem = z.infer<typeof galleryItemSchema>;

export const galleryBlockSchema = z.object({
  id: idField,
  type: z.literal('gallery'),
  columns: z.union([z.literal(2), z.literal(3)]),
  duotone: z.boolean(),
  items: z.array(galleryItemSchema).min(2),
});

export const quoteBlockSchema = z.object({
  id: idField,
  type: z.literal('quote'),
  body: z.string().min(1),
  cite: z.string().max(160).optional(),
  href: safeHrefSchema.optional(),
});

export const tableBlockSchema = z.object({
  id: idField,
  type: z.literal('table'),
  head: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  align: z.array(z.enum(TABLE_ALIGNMENTS).nullable()).optional(),
});

export const listBlockSchema = z.object({
  id: idField,
  type: z.literal('list'),
  ordered: z.boolean(),
  items: z.array(z.string()).min(1),
});

export const fileTreeEntrySchema = z.object({
  name: z.string().min(1),
  depth: z.number().int().min(0),
  directory: z.boolean(),
  /** Optional annotation rendered in the accent colour beside the node. */
  note: z.string().optional(),
});

export type FileTreeEntry = z.infer<typeof fileTreeEntrySchema>;

export const fileTreeBlockSchema = z.object({
  id: idField,
  type: z.literal('filetree'),
  root: z.string().min(1),
  entries: z.array(fileTreeEntrySchema).min(1),
});

export const commandBlockSchema = z.object({
  id: idField,
  type: z.literal('command'),
  value: z.string().min(1),
  note: z.string().max(200).optional(),
});

export const embedBlockSchema = z.object({
  id: idField,
  type: z.literal('embed'),
  provider: z.enum(EMBED_PROVIDERS),
  /** An opaque provider id, never a full URL, so no arbitrary origin is framed. */
  ref: z.string().regex(/^[\w-]{1,64}$/),
  title: z.string().max(160).optional(),
});

export const videoBlockSchema = z.object({
  id: idField,
  type: z.literal('video'),
  src: mediaPathSchema,
  poster: mediaPathSchema.optional(),
  caption: z.string().optional(),
});

export const diagramBlockSchema = z.object({
  id: idField,
  type: z.literal('diagram'),
  /** Monospaced ASCII art, rendered as text. No diagram-renderer dependency. */
  source: z.string().min(1),
  caption: z.string().optional(),
});

export const dividerBlockSchema = z.object({
  id: idField,
  type: z.literal('divider'),
  variant: z.enum(DIVIDER_VARIANTS),
});

// ── Container blocks ───────────────────────────────────────────────────────

export interface FindingBlock {
  id: string;
  type: 'finding';
  findingId?: string;
  severity: Severity;
  cwe?: string;
  cvss?: string;
  status?: FindingStatus;
  title?: string;
  body: Block[];
}

export interface CalloutBlock {
  id: string;
  type: 'callout';
  tone: CalloutTone;
  title?: string;
  body: Block[];
}

export type Block =
  | z.infer<typeof proseBlockSchema>
  | z.infer<typeof headingBlockSchema>
  | z.infer<typeof codeBlockSchema>
  | z.infer<typeof terminalBlockSchema>
  | z.infer<typeof httpBlockSchema>
  | z.infer<typeof imageBlockSchema>
  | z.infer<typeof galleryBlockSchema>
  | z.infer<typeof quoteBlockSchema>
  | z.infer<typeof tableBlockSchema>
  | z.infer<typeof listBlockSchema>
  | z.infer<typeof fileTreeBlockSchema>
  | z.infer<typeof commandBlockSchema>
  | z.infer<typeof embedBlockSchema>
  | z.infer<typeof videoBlockSchema>
  | z.infer<typeof diagramBlockSchema>
  | z.infer<typeof dividerBlockSchema>
  | FindingBlock
  | CalloutBlock;

export const findingBlockSchema: z.ZodType<FindingBlock> = z.lazy(() =>
  z.object({
    id: idField,
    type: z.literal('finding'),
    findingId: z.string().max(64).optional(),
    severity: severitySchema,
    cwe: z.string().regex(/^CWE-\d{1,4}$/).optional(),
    cvss: z.string().regex(/^\d{1,2}(\.\d)?$/).optional(),
    status: findingStatusSchema.optional(),
    title: z.string().max(160).optional(),
    body: z.array(blockSchema),
  }),
);

export const calloutBlockSchema: z.ZodType<CalloutBlock> = z.lazy(() =>
  z.object({
    id: idField,
    type: z.literal('callout'),
    tone: calloutToneSchema,
    title: z.string().max(160).optional(),
    body: z.array(blockSchema),
  }),
);

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.union([
    proseBlockSchema,
    headingBlockSchema,
    codeBlockSchema,
    terminalBlockSchema,
    httpBlockSchema,
    imageBlockSchema,
    galleryBlockSchema,
    quoteBlockSchema,
    tableBlockSchema,
    listBlockSchema,
    fileTreeBlockSchema,
    commandBlockSchema,
    embedBlockSchema,
    videoBlockSchema,
    diagramBlockSchema,
    dividerBlockSchema,
    findingBlockSchema,
    calloutBlockSchema,
  ]),
);

export const BLOCK_TYPES = [
  'prose',
  'heading',
  'code',
  'terminal',
  'http',
  'image',
  'gallery',
  'quote',
  'table',
  'list',
  'filetree',
  'command',
  'embed',
  'video',
  'diagram',
  'divider',
  'finding',
  'callout',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** True for blocks that nest other blocks, so walkers do not need a type map. */
export function isContainerBlock(block: Block): block is FindingBlock | CalloutBlock {
  return block.type === 'finding' || block.type === 'callout';
}

/** Depth-first walk over a block tree, containers included. */
export function* walkBlocks(blocks: readonly Block[]): Generator<Block> {
  for (const block of blocks) {
    yield block;
    if (isContainerBlock(block)) yield* walkBlocks(block.body);
  }
}
