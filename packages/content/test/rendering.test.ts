import assert from 'node:assert/strict';
import test from 'node:test';

import { renderInline, renderMarkdown } from '../src/markdown/inline.ts';
import { parseBlocks } from '../src/markdown/parse.ts';
import { deriveDocument } from '../src/derive/document.ts';

test('raw HTML in prose never becomes markup', () => {
  const html = renderMarkdown('Before <script>alert(1)</script> after <b>bold</b>.');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('Before'));
  assert.ok(html.includes('after'));
});

test('a javascript: link loses its href', () => {
  const html = renderMarkdown('[click](javascript:alert(1))');
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('click'));
});

test('a data: URI link loses its href', () => {
  const html = renderMarkdown('[click](data:text/html;base64,PHNjcmlwdD4=)');
  assert.ok(!html.includes('data:'));
});

test('external links are marked and given a safe rel', () => {
  const html = renderMarkdown('[docs](https://example.com/a)');
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('data-external="true"'));
});

test('internal links are left alone', () => {
  const html = renderMarkdown('[archive](/archive/)');
  assert.ok(html.includes('href="/archive/"'));
  assert.ok(!html.includes('target='));
});

test('renderInline drops a single wrapping paragraph', () => {
  assert.equal(renderInline('Just **text**.'), 'Just <strong>text</strong>.');
});

test('a raw HTML block is reported and dropped', () => {
  const { blocks, diagnostics } = parseBlocks('<div onclick="steal()">hi</div>\n');
  assert.equal(blocks.length, 0);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.level, 'error');
});

test('an unknown directive is an error rather than a silent drop', () => {
  const { blocks, diagnostics } = parseBlocks(':::mystery\nbody\n:::\n');
  assert.equal(blocks.length, 0);
  assert.equal(diagnostics[0]?.level, 'error');
  assert.match(diagnostics[0]?.message ?? '', /mystery/);
});

test('an image without alt text is an error', () => {
  const { diagnostics } = parseBlocks('![](./media/a.png)\n');
  assert.equal(diagnostics.some((issue) => /alt text/.test(issue.message)), true);
});

test('reading time counts prose and adds a cost for code', () => {
  const words = Array.from({ length: 460 }, () => 'word').join(' ');
  const { blocks } = parseBlocks(`${words}\n`);
  const derived = deriveDocument(blocks);
  assert.equal(derived.wordCount, 460);
  assert.equal(derived.readingMinutes, 2);
});

test('headings get sequential hex offsets and unique anchors', () => {
  const { blocks } = parseBlocks('## One\n\n## Two\n\n### Two\n');
  const { headings } = deriveDocument(blocks);
  assert.deepEqual(
    headings.map((heading) => heading.offset),
    ['0x00', '0x01', '0x02'],
  );
  assert.deepEqual(
    headings.map((heading) => heading.anchor),
    ['one', 'two', 'two-1'],
  );
});
