# CONTENT MODEL

Git is the source of truth. Everything below describes files on disk, not database
rows. The CMS is one editor for these files; a text editor is another.

---

## 1. Layout on disk

```
content/
├── posts/
│   └── deobfuscating-a-malicious-vbs-script/
│       ├── index.md                  # frontmatter + body
│       └── media/
│           ├── cover.png
│           ├── 01-entrypoint.png
│           └── 02-decoded-payload.png
│
├── projects/
│   └── pindroid/
│       ├── index.md
│       └── media/
│
├── pages/
│   ├── about.md
│   └── contact.md
│
└── taxonomy.json                     # canonical categories + tag registry
```

One directory per record, media colocated with the record that uses it. Moving,
archiving or deleting an article is a single directory operation, and a `git log` on
that directory is the article's complete history.

Media is referenced with a root-relative path from the record:
`![Entry point](./media/01-entrypoint.png)`. The build resolves these through Astro's
image pipeline into responsive `avif`/`webp` with intrinsic dimensions.

**Slugs** match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. The directory name *is* the slug; the
frontmatter does not repeat it. Renaming a published article is a deliberate operation
that the CMS refuses unless a redirect entry is written.

---

## 2. Article frontmatter

```yaml
---
record: 42                            # permanent index, assigned once, never reused
title: Deobfuscating a Malicious VBS Script
subtitle: Unwrapping four layers of string obfuscation in a phishing dropper
excerpt: >-
  A staged VBScript dropper hid its payload behind chained character-code
  arithmetic. This walks through peeling each layer with nothing but a text
  editor and a scratch interpreter.

status: published                     # draft | published
publishedAt: 2026-03-14
updatedAt: 2026-03-19

category: malware-analysis            # exactly one, must exist in taxonomy.json
tags: [vbscript, obfuscation, phishing, static-analysis]

cover:
  src: ./media/cover.png
  alt: Hex view of the obfuscated dropper with the decode loop highlighted
  duotone: true                       # default true; false keeps original colour

series:                               # optional
  id: windows-script-malware
  order: 2

featured: false
draftNotes: null                      # author-only, stripped from all output
canonical: null                       # set only when republished from elsewhere
---
```

### Field rules

| Field | Type | Notes |
| --- | --- | --- |
| `record` | `int ≥ 1` | Unique across posts. Allocated by `max(existing) + 1` at creation. Never reused, even after deletion — the archive is append-only in spirit. |
| `title` | `string` 1–120 | Required. |
| `subtitle` | `string` ≤ 200 | Optional but strongly encouraged; it is a first-class design element. |
| `excerpt` | `string` 40–320 | Required for published posts. Used in listings, RSS, and `og:description`. |
| `status` | enum | `draft` posts are excluded from the production build, sitemap, RSS and search index. They render at `/_draft/<slug>` in dev only. |
| `publishedAt` | `YYYY-MM-DD` | Required when `status: published`. |
| `updatedAt` | `YYYY-MM-DD` | Written automatically on save when the body changes. |
| `category` | slug | Exactly one. Must exist in `taxonomy.json`. |
| `tags` | slug[] ≤ 8 | Free-form, but new tags are registered in `taxonomy.json` so they can carry a description. |
| `cover` | object | Optional. `alt` is required whenever `src` is present — enforced by schema, not by discipline. |
| `series` | object | Optional. `id` groups posts; `order` sequences them. |
| `readingTime` | — | **Derived, never stored.** Computed at build from word count plus a per-block cost for code and terminal content. |
| `author` | — | **Not stored.** Single-author publication; the author comes from `site.config.ts`. Adding it per-post would be ceremony. |

`id` from the original brief is dropped: the slug is the stable identifier and `record`
is the human one. A third identifier would be a third thing to keep in sync.

---

## 3. The body: blocks

The body is CommonMark. Anything that is not prose is a **directive** — a closed,
validated vocabulary. The parser turns a document into `Block[]`; the serialiser turns
`Block[]` back into the same document.

```ts
type Block =
  | { type: 'prose';    id: string; markdown: string }
  | { type: 'heading';  id: string; level: 2 | 3 | 4; text: string; anchor: string }
  | { type: 'code';     id: string; lang: string; filename?: string;
                        highlight?: number[]; startLine?: number; source: string }
  | { type: 'terminal'; id: string; host?: string; lines: TerminalLine[] }
  | { type: 'finding';  id: string; findingId?: string; severity: Severity;
                        cwe?: string; cvss?: string; status?: FindingStatus;
                        body: Block[] }
  | { type: 'http';     id: string; direction: 'request' | 'response'; source: string }
  | { type: 'callout';  id: string; tone: 'note' | 'warning' | 'danger' | 'tip';
                        title?: string; body: Block[] }
  | { type: 'image';    id: string; src: string; alt: string; caption?: string;
                        duotone: boolean; width: 'column' | 'wide' | 'bleed' }
  | { type: 'gallery';  id: string; items: GalleryItem[]; columns: 2 | 3 }
  | { type: 'quote';    id: string; body: string; cite?: string; href?: string }
  | { type: 'table';    id: string; head: string[]; rows: string[][]; align?: Align[] }
  | { type: 'list';     id: string; ordered: boolean; items: string[] }
  | { type: 'filetree'; id: string; root: string; entries: FileTreeEntry[] }
  | { type: 'command';  id: string; value: string; description?: string }
  | { type: 'embed';    id: string; provider: 'youtube' | 'gist'; ref: string }
  | { type: 'video';    id: string; src: string; poster?: string; caption?: string }
  | { type: 'diagram';  id: string; source: string; caption?: string }
  | { type: 'divider';  id: string; variant: 'rule' | 'dots' | 'gap' };
```

`id` is a per-parse key (`b1`, `b2`, …) used by the editor for reordering and undo. It
is never serialised into markdown; the editor mints new ids for blocks it creates.

`finding` and `callout` nest `Block[]`, which is why the renderer is recursive from day
one rather than being retrofitted later. A container is always fenced with more colons
than anything inside it, so a finding wrapping a warning writes `::::finding` around
`:::warning`. The serialiser computes this; it is not something an author tracks.

### Syntax reference

**Prose, headings, lists, tables, quotes** are plain markdown. No directive needed;
the parser recognises them structurally. Only `##`–`####` are permitted — `#` is the
title, which lives in frontmatter.

**Code**

````markdown
```powershell title="stage1.vbs" lines="4-9" start="1"
Set fso = CreateObject("Scripting.FileSystemObject")
```
````

**Terminal**

````markdown
```terminal host="analysis-vm"
$ jadx -d out app.apk
INFO  - loading ...
INFO  - processing ...
$ rg -n "password" out/sources
out/sources/com/example/Store.java:41:  private static final String password = "hunter2";
```
````

Lines beginning `$ ` are prompts, lines beginning `# ` are comments, everything else is
output. Add `exit="1"` to the info string to mark a failed command; the block edge takes
the severity colour.

**Finding**

```markdown
:::finding{id="MASVS-STORAGE-001" severity="high" cwe="CWE-312" cvss="7.5" status="fixed"}
Sensitive session material is written to the application database in plain text.
Any process with access to the app sandbox — or an attacker with a backup extraction
on an unlocked device — recovers valid credentials.
:::
```

`severity` is `info | low | medium | high | critical`.
`status` is `open | fixed | wontfix | disputed`.

**HTTP**

````markdown
```http-request
POST /api/v1/auth HTTP/1.1
Host: api.example.com
Content-Type: application/json

{"username":"analyst","password":"..."}
```
````

Same for `http-response`. Rendered with the start line as a header bar, headers as a
key/value table, and body syntax-highlighted by inferred content type.

**Callout**

```markdown
:::warning{title="Do not run this on a host you care about"}
The sample calls out to a live C2 on execution.
:::
```

`:::note`, `:::tip`, `:::warning`, `:::danger`.

**Image**

```markdown
:::image{src="./media/02-decoded-payload.png" width="wide" duotone="false"}
The fourth decode stage, finally readable.
:::
```

Plain markdown `![alt](./media/x.png)` also works and becomes a column-width image
block. The directive form exists for captions, width, and colour control.

**File tree**

````markdown
```filetree root="app/"
src/
  main/
    AndroidManifest.xml   @ exported activity, no permission
    test/
build.gradle.kts
```
````

Indentation defines nesting; `@ ` annotates a node in sulfur. Box-drawing characters are
produced by the renderer, never typed by hand.

**Gallery** wraps two or more `::item` leaf directives, one per blank-line-separated
line:

```markdown
:::gallery{columns="3"}
::item{src="./media/one.png" alt="Entry point"}

::item{src="./media/two.png" alt="Decode loop"}
:::
```

**Command** and **diagram** are fences carrying a single payload:

````markdown
```command note="Attach to the running process"
frida -U -n com.example.app -l hook.js
```
````

**Divider** is `---` for a plain rule, or `::divider{variant="dots"}` / `{variant="gap"}`.
**Video** and **embed** are leaf directives: `::video{src="./media/x.mp4" caption="…"}`
and `::embed{provider="youtube" ref="<id>"}`. Embeds take an opaque provider id rather
than a URL, so content can never frame an arbitrary origin.

`packages/content/src/schema/blocks.ts` is the authoritative source for every field.
This document describes intent; the schema defines truth.

---

## 4. Adding a block type

Four steps, no renderer rewrite:

1. Add the zod schema and the `Block` union member in
   `packages/content/src/schema/blocks.ts`.
2. Add the parse and serialise handlers in `packages/content/src/markdown/blocks/`.
   Both are pure functions; a round-trip test is required.
3. Add the Astro component and register it in `apps/web/src/blocks/registry.ts`.
4. Add the editor surface and register it in `apps/cms/src/client/editor/registry.ts`.

The registries are `satisfies Record<BlockType, …>`, so forgetting step 3 or 4 is a
compile error rather than a runtime hole.

---

## 5. Projects

Same mechanics, different fields.

```yaml
---
record: 7
name: PinDroid
tagline: Certificate-pinning analysis and bypass toolkit for Android
status: active                        # active | maintained | archived | research
startedAt: 2025-06
technologies: [kotlin, frida, smali, gradle]
repository: https://github.com/…/pindroid
homepage: null
featured: true
cover:
  src: ./media/cover.png
  alt: PinDroid attaching to a target process
metrics:                              # optional, only real numbers
  stars: null                         # fetched at build if the repo is public
---
```

Body uses the same block vocabulary, so a project page can carry findings, file trees
and terminal transcripts exactly like an article. Conventional sections: overview,
architecture, usage, screenshots, status.

---

## 6. Taxonomy

`content/taxonomy.json` is the registry that makes category and tag pages meaningful
rather than auto-generated stubs:

```json
{
  "categories": [
    {
      "slug": "malware-analysis",
      "name": "Malware Analysis",
      "abbr": "MAL",
      "description": "Static and dynamic analysis of malicious samples.",
      "order": 3
    }
  ],
  "tags": [
    { "slug": "frida", "name": "Frida", "description": "Dynamic instrumentation toolkit." }
  ]
}
```

- Categories are a small, curated set. A post has exactly one. Unknown category = build
  failure.
- Tags are open. The CMS creates a registry entry on first use with an empty
  description; a tag with no description still gets a page, just without the standfirst.
- `abbr` is a three-letter code used in dense listings and record rows.

---

## 7. Validation

`packages/content` exports one `validate()` used identically by the CMS (before publish)
and CI (before deploy), so nothing can be published locally that fails in the pipeline.

**Errors** (block publish and fail the build):
missing title, excerpt or `publishedAt` on a published post; unknown category; invalid
severity; image without alt text; media file referenced but absent; slug collision;
duplicate `record`; link to a missing internal route; malformed frontmatter.

**Warnings** (surfaced in the CMS, do not block):
excerpt outside 40–320 characters; more than 8 tags; no cover image; heading levels
skipping a rank; code block over 80 lines; estimated reading time under 2 minutes;
no `subtitle`.

---

## 8. Derived data

Computed at build, never stored in content, so it can never go stale:

- `readingTime` — words ÷ 230 wpm, plus 4s per code block and 3s per terminal block.
- `headings` / table of contents with hex offsets.
- `related` — scored by shared tags (3 points), same category (2), same series (5),
  recency tiebreak. Top three.
- `prev` / `next` — chronological within the same category, falling back to global.
- `search-index.json`.
- `rss.xml`, `sitemap-index.xml`, per-post OpenGraph metadata.
- Series navigation.

---

## 9. Why not a database

Files give version history, diffs, blame, rollback, offline editing, grep, portability,
and zero operational surface. A database would add a process to run, a backup problem, a
migration story, and a lock-in risk — in exchange for query features this project will
never need at a few hundred documents. If listing performance ever becomes an issue, the
answer is a build-time index, not a server.
