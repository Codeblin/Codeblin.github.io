import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { normalizeLineEndings, parseBlocks } from '../src/markdown/parse.ts';
import { serializeBlocks } from '../src/markdown/serialize.ts';
import { BLOCK_TYPES, walkBlocks, type Block, type BlockType } from '../src/schema/blocks.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = normalizeLineEndings(
  readFileSync(path.join(here, 'fixtures', 'kitchen-sink.md'), 'utf8'),
);

test('the fixture exercises every block type', () => {
  const { blocks } = parseBlocks(fixture);
  const seen = new Set<BlockType>();
  for (const block of walkBlocks(blocks)) seen.add(block.type);

  const missing = BLOCK_TYPES.filter((type) => !seen.has(type));
  assert.deepEqual(missing, [], `Fixture is missing block types: ${missing.join(', ')}`);
});

test('the fixture parses without diagnostics', () => {
  const { diagnostics } = parseBlocks(fixture);
  assert.deepEqual(diagnostics, []);
});

test('parse then serialise reproduces the canonical source byte for byte', () => {
  const { blocks } = parseBlocks(fixture);
  assert.equal(serializeBlocks(blocks), fixture);
});

test('serialisation is idempotent', () => {
  const once = serializeBlocks(parseBlocks(fixture).blocks);
  const twice = serializeBlocks(parseBlocks(once).blocks);
  assert.equal(twice, once);
});

test('non-canonical input converges after one pass', () => {
  const messy = [
    'Setext heading',
    '==============',
    '',
    '*   loose list item',
    '*   another one',
    '',
    '|a|b|',
    '|-|-|',
    '|1|2|',
    '',
  ].join('\n');

  const once = serializeBlocks(parseBlocks(messy).blocks);
  const twice = serializeBlocks(parseBlocks(once).blocks);
  assert.equal(twice, once);
});

test('an empty prose block round-trips instead of vanishing', () => {
  const blocks: Block[] = [{ id: 'p1', type: 'prose', markdown: '' }];
  const markdown = serializeBlocks(blocks);
  const parsed = parseBlocks(markdown);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0]?.type, 'prose');
  assert.equal(parsed.blocks[0]?.type === 'prose' ? parsed.blocks[0].markdown : 'x', '');
  assert.equal(serializeBlocks(parsed.blocks), markdown);
});

test('prose survives verbatim, including its exact inline syntax', () => {
  const source = 'A line with **bold**, _italics_, `code`, and a [link](https://example.com/a).\n';
  const { blocks } = parseBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.type, 'prose');
  assert.equal(serializeBlocks(blocks), source);
});

test('attribute values containing quotes survive a round trip', () => {
  const block: Block = {
    id: 'b1',
    type: 'callout',
    tone: 'note',
    title: 'He said "no" & left',
    body: [{ id: 'b2', type: 'prose', markdown: 'Body.' }],
  };

  const markdown = serializeBlocks([block]);
  const [parsed] = parseBlocks(markdown).blocks;
  assert.equal(parsed?.type, 'callout');
  assert.equal(parsed?.type === 'callout' ? parsed.title : null, 'He said "no" & left');
});

test('a container is fenced with more colons than anything it contains', () => {
  const markdown = serializeBlocks([
    {
      id: 'b1',
      type: 'finding',
      severity: 'high',
      body: [
        {
          id: 'b2',
          type: 'callout',
          tone: 'danger',
          body: [{ id: 'b3', type: 'prose', markdown: 'Inner.' }],
        },
      ],
    },
  ]);

  assert.match(markdown, /^::::finding/m);
  assert.match(markdown, /^:::danger/m);

  const [parsed] = parseBlocks(markdown).blocks;
  assert.equal(parsed?.type, 'finding');
  assert.equal(parsed?.type === 'finding' ? parsed.body[0]?.type : null, 'callout');
});

test('a fence longer than three backticks is used when the source contains one', () => {
  const markdown = serializeBlocks([
    { id: 'b1', type: 'code', lang: 'markdown', source: '```js\nconst a = 1;\n```' },
  ]);
  assert.match(markdown, /^````markdown/);

  const [parsed] = parseBlocks(markdown).blocks;
  assert.equal(parsed?.type, 'code');
  assert.equal(parsed?.type === 'code' ? parsed.source : null, '```js\nconst a = 1;\n```');
});
