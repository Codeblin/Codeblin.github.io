import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const DELIMITER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface SplitDocument {
  data: unknown;
  body: string;
}

/**
 * Splits `---` YAML frontmatter from the markdown body.
 *
 * A document without frontmatter is not an error here — validation decides
 * that. This function only takes the file apart.
 */
export function splitDocument(raw: string): SplitDocument {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = DELIMITER.exec(normalized);
  if (!match) return { data: {}, body: normalized.trimStart() };
  const yaml = match[1] ?? '';
  return {
    data: yaml.trim() === '' ? {} : (parseYaml(yaml) as unknown),
    body: normalized.slice(match[0].length).replace(/^\r?\n/, ''),
  };
}

/**
 * Reassembles a document. Keys are written in the order given, so callers
 * control the diff shape; null and undefined values are dropped rather than
 * written out as noise.
 */
export function composeDocument(data: Record<string, unknown>, body: string): string {
  const cleaned = pruneEmpty(data);
  const yaml = stringifyYaml(cleaned, {
    lineWidth: 88,
    minContentWidth: 40,
    singleQuote: false,
  }).trimEnd();
  const trimmedBody = body.trim();
  return trimmedBody.length > 0
    ? `---\n${yaml}\n---\n\n${trimmedBody}\n`
    : `---\n${yaml}\n---\n`;
}

function pruneEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneEmpty);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || entry === null) continue;
      out[key] = pruneEmpty(entry);
    }
    return out;
  }
  return value;
}
