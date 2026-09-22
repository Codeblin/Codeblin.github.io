import { bundledLanguages, createHighlighter, type Highlighter, type ThemeRegistration } from 'shiki';
import { palette } from '@codeblin/tokens';

/**
 * Syntax highlighting, restrained on purpose.
 *
 * A six-hue theme rather than a rainbow: most code is bone, comments recede,
 * keywords take the accent, and the remaining three hues separate strings,
 * numbers and types. Anything more competes with the page.
 */
const substrate: ThemeRegistration = {
  name: 'substrate',
  type: 'dark',
  colors: {
    'editor.background': palette.slate,
    'editor.foreground': palette.bone,
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { foreground: '#5c5c57', fontStyle: 'italic' },
    },
    {
      scope: [
        'keyword',
        'storage',
        'storage.type',
        'keyword.control',
        'keyword.operator.new',
        'entity.name.tag',
        'variable.language',
      ],
      settings: { foreground: palette.sulfur },
    },
    {
      scope: ['string', 'string.quoted', 'punctuation.definition.string'],
      settings: { foreground: '#d5c7a3' },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character', 'support.constant'],
      settings: { foreground: '#e0a73c' },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
        'entity.other.inherited-class',
      ],
      settings: { foreground: '#9fb4c9' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: palette.bone },
    },
    {
      scope: ['variable', 'variable.other', 'meta.object-literal.key', 'support.variable'],
      settings: { foreground: '#bdbab2' },
    },
    {
      scope: ['punctuation', 'keyword.operator', 'meta.brace'],
      settings: { foreground: '#87877f' },
    },
    {
      scope: ['entity.other.attribute-name', 'meta.attribute'],
      settings: { foreground: '#9fb4c9' },
    },
    {
      scope: ['markup.deleted', 'invalid'],
      settings: { foreground: '#ff4438' },
    },
    {
      scope: ['markup.inserted'],
      settings: { foreground: '#b6c76a' },
    },
  ],
};

let instance: Promise<Highlighter> | null = null;
const loaded = new Set<string>();

function highlighter(): Promise<Highlighter> {
  instance ??= createHighlighter({ themes: [substrate], langs: [] });
  return instance;
}

/** Languages we accept but Shiki does not ship a grammar for. */
const ALIASES: Record<string, string> = {
  smali: 'text',
  frida: 'javascript',
  vbs: 'vb',
  vbscript: 'vb',
  gradle: 'groovy',
  'kotlin-script': 'kotlin',
  sh: 'bash',
  console: 'bash',
};

async function resolveLanguage(lang: string): Promise<string> {
  const requested = ALIASES[lang] ?? lang;
  if (requested === '' || requested === 'text' || requested === 'plaintext') return 'text';
  if (!(requested in bundledLanguages)) return 'text';
  if (!loaded.has(requested)) {
    await (await highlighter()).loadLanguage(requested as keyof typeof bundledLanguages);
    loaded.add(requested);
  }
  return requested;
}

export interface HighlightOptions {
  lang: string;
  /** 1-based line numbers to emphasise. */
  highlight?: readonly number[];
  /** Line number the first line represents, for excerpts from a larger file. */
  startLine?: number;
}

/**
 * Returns the `<pre>` markup for a code block. Shiki escapes the source, so
 * this output is safe to inject; the only additions are our own classes.
 */
export async function highlightCode(
  source: string,
  { lang, highlight, startLine = 1 }: HighlightOptions,
): Promise<string> {
  const language = await resolveLanguage(lang.toLowerCase());
  const marked = new Set(highlight ?? []);
  const instance = await highlighter();

  return instance.codeToHtml(source.replace(/\n$/, ''), {
    lang: language,
    theme: 'substrate',
    transformers: [
      {
        line(node, line) {
          const absolute = startLine + line - 1;
          node.properties['data-line'] = String(absolute);
          if (marked.has(absolute)) node.properties['data-marked'] = 'true';
        },
        pre(node) {
          node.properties['tabindex'] = '0';
          node.properties['data-substrate'] = 'code';
        },
      },
    ],
  });
}

/** Human label for the language chip on a code block. */
export function languageLabel(lang: string): string {
  if (!lang) return 'TEXT';
  const pretty: Record<string, string> = {
    mermaid: 'MERMAID',
    js: 'JAVASCRIPT',
    ts: 'TYPESCRIPT',
    tsx: 'TSX',
    py: 'PYTHON',
    kt: 'KOTLIN',
    sh: 'SHELL',
    yml: 'YAML',
    vb: 'VBSCRIPT',
  };
  return pretty[lang] ?? lang.toUpperCase();
}
