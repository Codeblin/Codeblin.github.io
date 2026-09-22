import assert from 'node:assert/strict';
import test from 'node:test';

import { looksLikeMermaid, sanitizeMermaidSvg } from '../src/mermaid.ts';
import { parseBlocks } from '../src/markdown/parse.ts';
import { serializeBlocks } from '../src/markdown/serialize.ts';
import { parseYoutubeRef, youtubeSrc } from '../src/youtube.ts';

test('watch URLs, short links, and youtube: src all reduce to an id', () => {
  assert.equal(parseYoutubeRef('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYoutubeRef('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYoutubeRef('https://youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYoutubeRef('youtube:dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYoutubeRef('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(parseYoutubeRef('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('a YouTube watch URL in a video directive stores youtube:id', () => {
  const { blocks, diagnostics } = parseBlocks(
    '::video{src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" caption="Demo"}\n',
  );
  assert.equal(diagnostics.length, 0);
  assert.equal(blocks[0]?.type, 'video');
  assert.equal(blocks[0]?.type === 'video' ? blocks[0].src : '', youtubeSrc('dQw4w9WgXcQ'));
  assert.match(serializeBlocks(blocks), /src="youtube:dQw4w9WgXcQ"/);
});

test('Mermaid fences parse as diagram blocks and serialise as mermaid', () => {
  const source = ['```mermaid caption="Flow"', 'flowchart LR', '  a --> b', '```', ''].join('\n');
  const { blocks } = parseBlocks(source);
  assert.equal(blocks[0]?.type, 'diagram');
  assert.equal(blocks[0]?.type === 'diagram' ? looksLikeMermaid(blocks[0].source) : false, true);
  assert.match(serializeBlocks(blocks), /^```mermaid /);
});

test('ASCII diagrams stay on the diagram fence', () => {
  const source = ['```diagram caption="Path"', 'client ──▶ socket', '```', ''].join('\n');
  const { blocks } = parseBlocks(source);
  assert.equal(blocks[0]?.type, 'diagram');
  assert.equal(serializeBlocks(blocks), source);
});

test('mermaid SVG sanitiser drops scripts and handlers', () => {
  const dirty = '<svg><script>alert(1)</script><g onclick="x()"></g></svg>';
  const clean = sanitizeMermaidSvg(dirty);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('onclick'), false);
  assert.equal(sanitizeMermaidSvg('<div></div>'), '');
});
