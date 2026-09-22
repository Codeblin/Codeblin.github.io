import { SLUG_PATTERN, slugify } from '@codeblin/content/client';
import { useEffect, useRef, useState, type ReactElement } from 'react';

interface Props {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  max?: number;
}

export function parseCommaSlugs(raw: string, max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const token = slugify(part.trim());
    if (token === 'untitled' || !SLUG_PATTERN.test(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

function keyOf(values: readonly string[]): string {
  return values.join('\0');
}

/** Keeps a trailing comma while typing so a new slug can be started. */
export function CommaListInput({ label, values, onChange, placeholder, max = 8 }: Props): ReactElement {
  const [text, setText] = useState(() => values.join(', '));
  const pushed = useRef(keyOf(values));

  useEffect(() => {
    const incoming = keyOf(values);
    if (incoming === pushed.current) return;
    pushed.current = incoming;
    setText(values.join(', '));
  }, [values]);

  return (
    <label>
      {label}
      <input
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const parsed = parseCommaSlugs(next, max);
          pushed.current = keyOf(parsed);
          onChange(parsed);
        }}
      />
    </label>
  );
}
