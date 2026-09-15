# ARCHITECTURE

**Project codename:** `CODEBLIN` — a personal security research publication.
**System codename:** `SUBSTRATE` — the shared design + content layer beneath both apps.

This document records the engineering decisions, the reasoning behind them, and the
risks they carry. It is the reference for *why* the code looks the way it does.

---

## 1. Shape of the system

Two applications, one repository, one content store.

```
                      ┌──────────────────────────────┐
                      │   content/  (Git = truth)    │
                      │   markdown + frontmatter     │
                      │   + colocated media          │
                      └──────────────┬───────────────┘
                                     │
                 ┌───────────────────┴────────────────────┐
                 │                                        │
      read at build time                        read + write at runtime
                 │                                        │
        ┌────────▼─────────┐                    ┌─────────▼──────────┐
        │  apps/web        │                    │  apps/cms          │
        │  Astro 5 static  │                    │  local-only        │
        │  → dist/         │                    │  React SPA + API   │
        └────────┬─────────┘                    └─────────┬──────────┘
                 │                                        │
          GitHub Actions                              git add/commit/push
                 │                                        │
          GitHub Pages ◄────────────────────────── triggers rebuild
```

The public site is a pure static artifact. The CMS is a local instrument that edits
files on disk. They never talk to each other at runtime in production; the only
coupling is the content format, which lives in one shared package.

---

## 2. Decisions and rationale

### 2.1 Monorepo with npm workspaces

`pnpm` is not installed on the target machine and npm 11 ships workspaces natively.
Adding a package manager is a prerequisite for every future clone, CI job and
contributor. npm workspaces cost nothing and are sufficient at this scale.

> **Decision:** npm workspaces. Revisit only if install time becomes painful.

### 2.2 Astro 5 for the public site

Static output, zero JavaScript by default, islands where interaction is genuinely
needed (search, table of contents, copy buttons, mobile nav). Page-to-page motion is
plain document navigation — native view transitions are off because Chromium
re-snapshots named layers during scroll. Content Layer API lets us plug in
a custom loader so the site reads our block format directly.

### 2.3 The CMS is a separate local process, not an Astro route

A `/cms` route inside the Astro app would be compiled into the production build, and
any mistake in a dev-only guard becomes a public admin panel or a leaked filesystem
API. Physical separation makes that class of bug impossible.

```
apps/web   →  http://localhost:4321      (also the deployed artifact)
apps/cms   →  http://localhost:4322      (React SPA, Vite)
cms api    →  http://127.0.0.1:4323      (Hono on node:http, loopback only)
```

`npm run dev` starts all three via `scripts/dev.mjs` (a ~40 line process supervisor,
no `concurrently` dependency). `npm run build` builds *only* `apps/web`. The CMS has
no production build target at all.

> **Decision:** separate process. Cost: two extra ports and a supervisor script.
> Benefit: the CMS cannot be deployed by accident.

### 2.4 Content format: Markdown + YAML frontmatter + typed directives

The hard question of this project is MDX vs. structured JSON blocks. Both are wrong at
the edges:

| Option | Diffs | Portability | Block editor | Verdict |
| --- | --- | --- | --- | --- |
| MDX | good | good | JSX round-trip is lossy and hostile to a block UI | no |
| `article.json` | terrible (one line, escaped strings) | poor outside this repo | trivial | no |
| **Markdown + directives** | **good** | **good** | **good** | **yes** |

We use CommonMark with [remark-directive] syntax for anything that is not prose:

```markdown
:::finding{id="MASVS-STORAGE-001" severity="high" cwe="CWE-312"}
Sensitive session material is written to the app database in plain text.
:::
```

This gives us:

- Files that stay readable and reviewable in a GitHub diff.
- Files that survive this project — they open in any editor, any static site generator.
- A closed, validated vocabulary. No arbitrary JSX, therefore no arbitrary execution.
- A deterministic mapping to the block list the editor manipulates.

**Round-tripping.** `@codeblin/content` parses a document into `Block[]` and serialises
`Block[]` back with pinned `remark-stringify` options. Serialisation normalises
formatting (bullet markers, emphasis characters, wrapping). This is accepted and made
safe by two rules: normalisation is idempotent (`fmt(fmt(x)) === fmt(x)`), and it is
covered by golden-file tests. A `npm run content:fmt` script normalises the whole
corpus so hand-edits and CMS edits never fight in the diff.

### 2.5 Rendering: one block registry, two consumers

Custom blocks are not rehype-generated HTML strings; they are entries in a registry
that maps `block.type` to a component.

```ts
// apps/web/src/blocks/registry.ts
export const blockRegistry = {
  prose: Prose, heading: Heading, code: CodeBlock, terminal: TerminalBlock,
  finding: FindingBlock, http: HttpBlock, filetree: FileTree, /* ... */
} satisfies Record<BlockType, AstroComponent>;
```

Adding a block type is: add a zod schema in `packages/content`, add a component, add a
registry line. Nothing else changes. Unknown block types render as a visible
`UnknownBlock` in dev and are a build error in CI — never a silent drop.

Inline formatting inside prose blocks is converted to HTML at build time via
`mdast-util-to-hast` with `allowDangerousHtml: false`, so raw HTML in content is inert
by construction rather than by sanitisation.

### 2.6 Preview: the CMS embeds the real site

The CMS does **not** reimplement the renderer in React. Duplicating it guarantees
drift, and the brief's core requirement is one coherent visual language.

Instead: autosave (400 ms debounce) writes the draft to disk, the Astro dev server
picks up the file change, and the CMS preview pane is an `<iframe>` pointing at
`/_draft/<slug>` — a route that exists only when `import.meta.env.DEV` is true and is
excluded from `getStaticPaths` in production.

Trade-off: preview updates lag typing by roughly one debounce plus an HMR cycle
(~0.5 s), and it requires the web dev server to be running. The CMS shows a live
connection indicator and degrades to a clear message rather than a broken frame. In
exchange, preview fidelity is exact, forever, for free.

### 2.7 Search: build-time index, hand-written scorer

`apps/web` emits `/search-index.json` during build (title, subtitle, excerpt, category,
tags, and stripped body text truncated per document). The client uses a ~150-line
inverted index with prefix matching and field-weighted term-frequency scoring, fetched
lazily on first interaction with the search UI.

A dependency (`minisearch`, `fuse.js`, `pagefind`) would be defensible, but this is a
solved problem at our corpus size and the hand-rolled version keeps the payload and the
behaviour under our control. Budget: index ≤ 120 KB gzip; if exceeded, shard by year.

### 2.8 Styling: custom CSS with design tokens, not Tailwind

The design leans on hairline rules, chamfered panels, dot leaders, grain, and precise
typographic tracking. Expressing that in utility classes produces unreadable markup and
constant `[arbitrary-value]` escapes. We use plain CSS with:

- `packages/tokens` — the single source of truth, shipped as CSS custom properties plus
  a TypeScript mirror for the few places JS needs a value.
- `@layer reset, tokens, base, components, utilities` — predictable cascade, no
  specificity war, no `!important`.
- Component styles colocated with components (scoped by Astro, CSS Modules in the CMS).
- A small utility layer for the genuinely repeated primitives (`.stack`, `.hairline`,
  `.mono-label`).

### 2.9 Git integration: `execFile`, never a shell

Publishing runs a fixed sequence of `execFile('git', [...argv])` calls with array
arguments. There is no shell, no string interpolation into a command line, and no
endpoint that accepts a command. Authentication uses whatever the machine already
has — credential manager or SSH agent. The application never reads, stores, or
transmits a token.

---

## 3. Repository structure

```
/
├── apps/
│   ├── web/                        # Astro 5 — the publication (deployed)
│   │   ├── src/
│   │   │   ├── blocks/             # one component per block type + registry
│   │   │   ├── components/         # ArticleCard, Masthead, TableOfContents, ...
│   │   │   ├── layouts/
│   │   │   ├── lib/                # search index build, seo, formatting
│   │   │   ├── pages/
│   │   │   ├── styles/
│   │   │   └── content.config.ts   # custom loader → @codeblin/content
│   │   └── astro.config.mjs
│   │
│   └── cms/                        # local only — never built for production
│       ├── src/
│       │   ├── server/             # Hono API on 127.0.0.1
│       │   │   ├── routes/         # posts, projects, media, git, meta
│       │   │   ├── guards/         # origin check, path containment, mime sniff
│       │   │   └── index.ts
│       │   └── client/             # React 19 + Vite SPA
│       │       ├── editor/         # block editor core
│       │       ├── screens/        # dashboard, posts, media, settings
│       │       └── system/         # CMS-specific primitives
│       └── vite.config.ts
│
├── packages/
│   ├── content/                    # @codeblin/content — schemas, parse, serialise, fs
│   │   ├── src/
│   │   │   ├── schema/             # zod: frontmatter, blocks, projects
│   │   │   ├── markdown/           # mdast ⇄ Block[] , directives, stringify
│   │   │   ├── repository/         # read/write/list, slug, media paths
│   │   │   └── index.ts
│   │   └── test/                   # golden files for round-trip fidelity
│   │
│   └── tokens/                     # @codeblin/tokens — tokens.css, reset.css, tokens.ts
│
├── content/
│   ├── posts/<slug>/index.md
│   ├── posts/<slug>/media/*
│   ├── projects/<slug>/index.md
│   └── pages/about.md
│
├── public/                         # served verbatim by apps/web
│
├── scripts/
│   ├── dev.mjs                     # process supervisor
│   ├── content-fmt.mjs
│   └── new-post.mjs
│
├── .github/workflows/
│   ├── deploy.yml                  # build + publish to Pages
│   └── verify.yml                  # typecheck, lint, content validation, link check
│
├── ARCHITECTURE.md  DESIGN.md  CONTENT_MODEL.md  ROADMAP.md  SECURITY.md  README.md
```

`content/` sits at the repository root rather than inside `apps/web` because it is data
shared by two applications and is the thing the author actually cares about. Both apps
resolve it through `@codeblin/content`, which computes the root once.

---

## 4. Data flow

**Build (CI or local):**

```
content/posts/**/index.md
  → repository.listPosts()          fs walk, frontmatter parse
  → schema.parse()                  zod validation, fails the build on error
  → markdown.toBlocks()             mdast + directives → Block[]
  → Astro content collection
  → getStaticPaths / render         block registry → HTML
  → dist/ + search-index.json + rss.xml + sitemap
```

**Authoring:**

```
CMS editor state (Block[])
  → debounce 400 ms
  → PUT /api/posts/:slug           (loopback)
  → schema.parse() + markdown.serialise()
  → atomic write (tmp + rename) to content/posts/<slug>/index.md
  → Astro dev server HMR
  → preview iframe refresh
```

**Publishing:**

```
validate → flush pending saves → git add <scoped paths> → git commit -m
  → git push → report per-step status to the UI
```

Every step is reported individually, and a failure at any step leaves the content
safely on disk. The article is never held only in browser memory: an append-only
journal at `.cms/journal/<slug>.ndjson` (gitignored) records every autosave payload so
a crash mid-edit is recoverable.

---

## 5. Security posture

Detailed in `SECURITY.md`; summary of the decisions that shape the architecture:

**Public site**

- No raw HTML from content. `allowDangerousHtml: false` at the mdast→hast boundary, and
  directive attributes are zod-validated with per-field allowlists (e.g. `severity` is
  an enum, `href` must be `https:` / `mailto:` / relative).
- Content Security Policy delivered as a build-generated `<meta http-equiv>` with
  sha256 hashes for Astro's inline scripts. GitHub Pages cannot set real response
  headers — this limitation is documented, and the config is written so moving behind
  Cloudflare later is a one-file change.
- No third-party scripts, no fonts from a CDN, no analytics. Self-hosted everything.

**CMS**

- Server binds `127.0.0.1` explicitly, never `0.0.0.0`.
- Origin and `Host` allowlist on every mutating request; `Sec-Fetch-Site` check; JSON
  content-type required, which blocks form-based CSRF.
- Every filesystem path is resolved and asserted to be inside `content/` before any
  read or write. Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Uploads: extension allowlist plus magic-byte sniffing; SVG rejected by default
  (script vector); filenames regenerated, never trusted.
- No endpoint executes an arbitrary command. Git operations are a fixed, enumerated set.
- No secrets in the repo, in the client bundle, or in `localStorage`.

---

## 6. Performance budget

Enforced in `verify.yml`; a regression fails the build.

| Metric | Budget |
| --- | --- |
| JS shipped on an article page | ≤ 12 KB gzip |
| JS on the homepage | ≤ 8 KB gzip |
| Fonts, critical path | ≤ 95 KB (2 files, `font-display: swap`, preloaded) |
| CSS, critical path | ≤ 20 KB gzip |
| Search index, lazy | ≤ 120 KB gzip |
| Lighthouse performance / a11y / SEO | ≥ 98 |
| LCP on simulated 4G | ≤ 1.2 s |

Techniques: static generation, no client framework on content pages, Astro's image
pipeline for responsive `avif`/`webp` with intrinsic dimensions, `content-visibility`
on long article sections, and CSS-only animation everywhere except the two effects that
genuinely need JS (text decode, scroll progress).

---

## 7. Technical risks

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| 1 | Markdown ⇄ block round-trip loses or mangles content | high | Golden-file tests on a corpus covering every block type; idempotency assertion in CI; `content:fmt` to make normalisation explicit; journal so nothing is lost even on a bug |
| 2 | Preview depends on the Astro dev server | medium | Health-check indicator in the CMS; explicit "start the web dev server" state; `npm run dev` starts both by default |
| 3 | Four font families blow the budget | medium | Two are loaded on the critical path (display, body); the label mono is subset to uppercase + digits + punctuation; code mono loads only on pages containing code, via a per-page conditional preload |
| 4 | GitHub Pages cannot set security headers | medium | Meta CSP with build-time hashes; documented gap; header file kept ready for a future proxy |
| 5 | The design accumulates decoration and becomes noisy | high | DESIGN.md defines a hard motif budget and a review checklist; motifs must carry information |
| 6 | Windows/POSIX path divergence (primary machine is Windows) | medium | All path work via `node:path`; content identifiers are always POSIX; `.gitattributes` enforces LF; CI runs on Linux to catch case-sensitivity bugs |
| 7 | Autosave churns the git working tree | low | Drafts are legitimate committed content, but `content:status` surfaces them; journal is gitignored; publish stages only the article's own paths |
| 8 | Search index growth | low | Budget check in CI; shard by year when exceeded |

---

## 8. Conventions

- TypeScript `strict` plus `noUncheckedIndexedAccess`, `noUnusedLocals` and
  `verbatimModuleSyntax`. No `any` in committed code; `unknown` plus a zod parse at
  every boundary. `exactOptionalPropertyTypes` is deliberately off: every optional field
  in the block union comes from a zod `.optional()`, and the flag would force a
  conditional spread at every one of ~40 construction sites for no real safety gain.
- All external input (files, HTTP bodies, uploads) is parsed by a schema before use.
- No magic constants in components — spacing, duration, colour and easing come from
  tokens; content-shape constants live in `packages/content/src/constants.ts`.
- Components stay under ~150 lines. A component that grows past that is a layout plus
  parts, and gets split.
- Unimplemented work is a `// TODO(phase-N):` comment plus a ROADMAP entry, never a
  stub that silently returns a plausible value.

---

[remark-directive]: https://github.com/remarkjs/remark-directive
