# ROADMAP

Seven phases. Each has a definition of done that can be checked, not just claimed.
Nothing is marked complete while it contains a placeholder that pretends to work.

Status legend: `☐ pending` · `◐ in progress` · `☑ done`

---

## Phase 0 — Groundwork ☑

Repository, toolchain and the shared content package.

**Done when:** a fixture document containing every block type parses to blocks,
serialises back byte-identically, and `fmt(fmt(x)) === fmt(x)` holds in CI.

---

## Phase 1 — Foundation ☑

The public site exists and renders real content.

Routes: `/`, `/research/`, `/research/[slug]/`, `/categories/`, `/categories/[slug]/`,
`/tags/`, `/tags/[slug]/`, `/projects/`, `/projects/[slug]/`, `/archive/`, `/about/`,
`/search/`, `/404`, RSS.

Seven published articles, one draft, four projects, taxonomy, about page.

**Done when:** every route builds, no route is hard-coded per article, and adding a
directory under `content/posts/` produces a live page with zero code changes.

---

## Phase 2 — Visual identity ☑

`SUBSTRATE` tokens, grain, hairline grid, chamfers, four-family type, article
layout with hex-offset TOC, listings, archive, about, all eighteen block types,
mobile bar and collapsible metadata.

**Done when:** the review checklist in `DESIGN.md` §12 is the standard for new
screens. Remaining visual QA (320 / 768 / 1440) is a human pass after `npm run dev`.

---

## Phase 3 — CMS shell ☑

Hono API on loopback with origin/host/path guards. React SPA: rail, top bar,
status strip with real git state. Dashboard with real counts, git log, validation
warnings, draft list. Posts list with filter and create. Taxonomy and settings.

---

## Phase 4 — The editor ☑

Block editor: insert (`/`), reorder, duplicate, delete, undo/redo, autosave,
metadata, live validation, iframe preview of the real Astro site, drag-drop
media with magic-byte sniffing, keyboard map on the settings screen.

Nested finding/callout bodies are edited as prose in this version.
`// TODO(phase-4):` recursive nested block editor for finding/callout children.

---

## Phase 5 — Publishing ☑

Validate → save → stage scoped paths → commit → push, with per-step reporting.
Unpublish. GitHub Actions `verify.yml` and `deploy.yml` for Pages.

Scheduled publishing via a server remains out of scope (see below). Dates are
set on the record and take effect at the next build.

---

## Phase 6 — Motion ☑

Native view transitions, decode, sweep, bracket, stagger, CMS toast/panel
states. Reduced-motion overrides at the token layer and in the two JS effects.

---

## Phase 7 — Hardening ☑

`SECURITY.md`, CSP meta, sitemap, RSS, JSON-LD, robots, search index, 404,
README, content validation in CI. Lighthouse budgets are documented in
`ARCHITECTURE.md` §6 and should be re-checked against a production build after
the first deploy — they are not yet enforced as a CI numeric gate.

`// TODO(phase-7):` per-article generated OG images; Martian Mono label subset;
CI Lighthouse gate.

---

## Explicitly out of scope

comments · newsletter · analytics · multi-author support · i18n · light mode ·
a CMS database · cloud deployment beyond GitHub Pages · authentication ·
scheduled publishing via a server · webmentions.

---

## Working agreement

- Unfinished work is a `// TODO(phase-N):` comment plus a line in this file.
- Design decisions that deviate from `DESIGN.md` get written back into `DESIGN.md`.
