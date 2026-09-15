/**
 * Attribute plumbing shared by the parser and the serialiser.
 *
 * Directive attributes (`:::finding{severity="high"}`) and fenced-code meta
 * (` ```ts title="a.ts" `) use the same `key="value"` shape, so they use the
 * same reader and the same writer. Keeping both directions in one file is what
 * makes the round trip auditable.
 */

export type AttributeBag = Readonly<Record<string, string | null | undefined>>;

const META_PAIR = /([\w-]+)="((?:[^"\\]|\\.)*)"/g;

/** Reads `key="value"` pairs out of a fenced-code info string. */
export function parseMeta(meta: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!meta) return out;
  for (const match of meta.matchAll(META_PAIR)) {
    const [, key, value] = match;
    if (key && value !== undefined) out[key] = decodeAttributeValue(value);
  }
  return out;
}

export function readAttribute(bag: AttributeBag | undefined, name: string): string | undefined {
  const raw = bag?.[name];
  if (raw === null || raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readBooleanAttribute(
  bag: AttributeBag | undefined,
  name: string,
  fallback: boolean,
): boolean {
  const raw = readAttribute(bag, name);
  if (raw === undefined) return fallback;
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

export function readIntAttribute(
  bag: AttributeBag | undefined,
  name: string,
): number | undefined {
  const raw = readAttribute(bag, name);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Expands a `4-9,12` range spec into explicit 1-based line numbers. Capped so
 * a typo like `1-999999` cannot allocate an enormous array.
 */
export function parseLineRanges(spec: string | undefined, limit = 2000): number[] | undefined {
  if (!spec) return undefined;
  const lines = new Set<number>();
  for (const part of spec.split(',')) {
    const range = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!range) continue;
    const start = Number.parseInt(range[1] ?? '', 10);
    const end = range[2] ? Number.parseInt(range[2], 10) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    for (let n = start; n <= Math.min(end, start + limit); n += 1) lines.add(n);
  }
  return lines.size > 0 ? [...lines].sort((a, b) => a - b) : undefined;
}

export function formatLineRanges(lines: readonly number[] | undefined): string | undefined {
  if (!lines || lines.length === 0) return undefined;
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0] as number;
  let previous = start;
  for (const value of sorted.slice(1)) {
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = value;
    previous = value;
  }
  parts.push(start === previous ? `${start}` : `${start}-${previous}`);
  return parts.join(',');
}

/**
 * Only `"` and `&` need escaping inside a quoted attribute value. Newlines are
 * impossible there, so anything containing one is a programming error and is
 * collapsed rather than silently producing invalid syntax.
 */
export function encodeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/[\r\n]+/g, ' ');
}

export function decodeAttributeValue(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** Serialises an attribute bag, dropping empty values and preserving key order. */
export function writeAttributes(
  entries: ReadonlyArray<readonly [string, string | number | boolean | undefined]>,
): string {
  const parts = entries
    .filter((entry): entry is readonly [string, string | number | boolean] => {
      const value = entry[1];
      return value !== undefined && value !== '' && value !== null;
    })
    .map(([key, value]) => `${key}="${encodeAttributeValue(String(value))}"`);
  return parts.join(' ');
}
