# DESIGN — `SUBSTRATE`

The visual system for `CODEBLIN`, a personal security research publication.

---

## 1. What the references actually say

Three references were provided. What matters is not their surface but the principles
underneath them.

**Reference A — dark cybersecurity site, acid yellow.**
Near-black field carrying a visible film grain. Exactly one saturated hue, spent
sparingly and always on something meaningful. Hairline rules dividing the page into a
strict rectangular grid, cards sharing borders rather than floating. Enormous
letterspaced uppercase display type sitting directly against 10px monospace metadata —
a scale ratio of roughly 8:1 with almost nothing in between. Section markers prefixed
with a slash (`/ ABOUT`). A ticker of square-separated terms. No rounded corners, no
shadows, no gradients.

**Reference B — Escapism poster, olive on black.**
Editorial poster logic. One enormous condensed word owning the top third. Asymmetric
two-column composition where a dense image column plays against a sparse text column.
Images are duotoned into the palette and framed in hairline boxes so they read as part
of the system rather than as photographs dropped in. Wide-letterspaced small-caps
captions. Dashed rules used as connective tissue. Right-aligned lists creating a hard
vertical edge. Index numbers and a barcode in the margins — information as ornament,
but real information.

**Reference C — HUD scan interface, pale phosphor.**
Panels with chamfered corners, not rounded ones. Dot-leader readouts
(`> INDEXING FRAGMENT........ PARTIAL`) that align ragged labels into a clean right
edge. Key/value tables with alternating row tint. Rotated labels running up the side of
a panel. Corner brackets and small close affordances. Dithered imagery. Everything is
labelled, everything looks measured.

**The synthesis.** A publication that composes like a poster, is annotated like an
instrument, and is textured like printed matter. Editorial scale from B, systematic
restraint from A, technical annotation from C.

What we explicitly do *not* take: literal green phosphor, fake scan progress bars,
decorative terminal prompts, glitch as a default state.

---

## 2. Principles

1. **Every mark carries information.** A rule separates real sections. A number is a
   real index. A status readout shows real status. If a motif has no referent, it is
   deleted.
2. **Scale contrast instead of colour contrast.** Hierarchy comes from 11px versus
   80px, not from adding another hue.
3. **Hairlines, not shadows.** Depth is expressed with 1px borders and small
   background steps. Nothing floats.
4. **The accent is a scalpel.** Under 2% of the pixels on any screen.
5. **Density is a feature.** This is a technical archive; a listing that shows thirty
   records beats one that shows six.
6. **Motion explains, never decorates.** Every transition answers "where did this come
   from" or "what changed".
7. **Prose is sacred.** Whatever the surrounding chrome does, the reading column stays
   calm, wide-margined, and high-contrast.

---

## 3. Identity

**Wordmark:** `CODEBLIN` set in the display face, tight tracking, with a hairline box
around a leading glyph block. Adjacent standing line in label mono:
`SECURITY RESEARCH // ARCHIVE`.

**Record system.** Every article and project carries a permanent zero-padded record
number, shown as `//0042` in listings, headers, and the RSS feed. It is derived once at
creation and stored in frontmatter. This is the single strongest recognisability
device: a numbered archive rather than a blog.

**Offsets.** Article sections are indexed as hex offsets in the table of contents
(`0x00`, `0x04`, `0x0C`) — an honest count of major headings, not decoration.

**Grain.** A tiled PNG noise overlay at low opacity, promoted to its own
compositor layer. It is what makes the black feel like paper instead of `#000`.
It is never an SVG `feTurbulence` filter — that re-rasterises on scroll and
flickers.

**Sigil.** A four-pointed star, boxed, as the house mark. Same geometry in the
favicon, the masthead, and the footer. Not a square, not a skull.

**Frame.** A 1px sulfur bezel around the viewport, BIOS-style. Index caps
(`┌ ┐ └ ┘`) on section lines. Navigation is a tab strip: the current destination
is a solid sulfur block, like a setup-utility selection — not an underline.

---

## 4. Colour

Dark only. A light mode would fight the grain, the hairlines and the duotone imagery,
and would not be better — so it is not built.

### Surfaces

| Token | Value | Use |
| --- | --- | --- |
| `--void` | `#08080A` | page field |
| `--tar` | `#0C0C10` | panels, cards |
| `--slate` | `#131318` | raised panel, code background, inputs |
| `--carbon` | `#1A1A20` | hover fill, alternating table rows |
| `--hair` | `#23232B` | default 1px border |
| `--hair-lit` | `#373742` | hovered / focused border |

### Ink

| Token | Value | Use |
| --- | --- | --- |
| `--bone` | `#E9E5DC` | primary text — warm off-white, never pure white |
| `--ash` | `#9B9B93` | secondary text, deck copy |
| `--dust` | `#6B6B66` | metadata, labels, disabled |
| `--ghost` | `#43433F` | dividers in type, dot leaders |

### Accent

| Token | Value | Use |
| --- | --- | --- |
| `--sulfur` | `#CFD84E` | the one accent: active state, current nav item, focus ring, key rules, link underline on hover |
| `--sulfur-ink` | `#0A0A08` | text placed *on* sulfur |
| `--sulfur-veil` | `rgba(207,216,78,0.12)` | selection, active row tint |

Sulfur is a dirty yellow-green — sharper than olive, duller than lime. Under grain and
at 2% coverage it reads as printed ink rather than neon. It is deliberately not cyan,
not lime, not phosphor green.

### Severity (content semantics only, never chrome)

| Token | Value |
| --- | --- |
| `--sev-critical` | `#FF4438` |
| `--sev-high` | `#FF8A3D` |
| `--sev-medium` | `#E0A73C` |
| `--sev-low` | `#6FA8FF` |
| `--sev-info` | `#8E8E88` |

Severity colours appear only inside finding blocks and severity badges. They never
style navigation, buttons or links, so they never compete with sulfur.

### CMS-only

`--ember: #FF5B29` for destructive actions. Scoped to `apps/cms`; the public site never
loads it.

### Imagery

Screenshots and photographs are duotoned toward `--void` / `--bone` with an optional
sulfur lift in the highlights, and framed in a hairline box with a caption in label
mono beneath. A raw full-colour screenshot is allowed when the colour is the evidence —
that exception is a per-image flag, not a default.

---

## 5. Typography

Four families, each with one job. All self-hosted, variable where available, subset.

| Role | Family | Why |
| --- | --- | --- |
| Display | **Archivo Variable** (width + weight axes) | A grotesque that can go expanded-and-huge for mastheads or condensed-and-dense for poster headlines, from one file. Covers both reference A and reference B from a single asset. |
| Body | **Newsreader Variable** (optical size axis) | A serif for long-form. It is the decision that makes this read as a *publication* and not a dashboard, and it separates prose from every mono element on the page without any other cue. |
| Label mono | **Martian Mono Variable** | Wide, engineered, unmistakable at 10–12px uppercase. Used for every label, badge, status readout and dot leader. Subset to uppercase, digits and punctuation. |
| Code mono | **IBM Plex Mono** 400/600 | Actually comfortable to read forty lines of at 13px, which Martian Mono is not. Loaded only on pages containing code. |

Explicitly avoided: Inter, JetBrains Mono, Space Grotesk — the default trio of every
generated developer portfolio.

### Scale

```css
--fs-display-1: clamp(2.9rem, 1.1rem + 7.4vw, 7.5rem);   /* homepage statement    */
--fs-display-2: clamp(2.1rem, 1.1rem + 4.4vw, 4.25rem);  /* article title         */
--fs-display-3: clamp(1.6rem, 1.1rem + 2.2vw, 2.5rem);   /* section heads         */
--fs-h2:        1.5rem;
--fs-h3:        1.1875rem;
--fs-body:      1.0625rem;   /* 17px, line-height 1.72, measure 68ch */
--fs-small:     0.9375rem;
--fs-code:      0.8125rem;   /* 13px, line-height 1.6                */
--fs-label:     0.6875rem;   /* 11px, tracking 0.14em, uppercase     */
--fs-micro:     0.625rem;    /* 10px, tracking 0.18em, uppercase     */
```

### Rules

- Display type: tracking `-0.02em` at large sizes, optical alignment, `text-wrap:
  balance`, never more than three lines.
- Label mono: always uppercase, always tracked, always `--dust` unless it is active.
- Body: `text-wrap: pretty`, hanging punctuation, no justification, no hyphenation.
- Numerals: tabular everywhere they line up in a column, proportional in prose.
- One display face per viewport. Two competing display treatments is the failure mode.

---

## 6. Grid and space

4px base unit. Steps: `4 8 12 16 24 32 48 64 96 128 192 256`.

Desktop is a 12-column grid, 1440px maximum, 32px margins, 24px gutters. The grid is
occasionally *visible*: section boundaries are full-bleed hairlines, and card clusters
share single borders rather than each drawing their own, so the page reads as one
ruled sheet.

Radius is `0` on the public site. The only curvature in the system is the **chamfer**:

```css
--notch: 9px;
clip-path: polygon(var(--notch) 0, 100% 0, 100% calc(100% - var(--notch)),
                   calc(100% - var(--notch)) 100%, 0 100%, 0 var(--notch));
```

Chamfers are reserved for *instrument* surfaces — finding blocks, terminal blocks, CMS
panels — so cut corners always signal "this is machinery", and prose containers stay
square.

Reading column: 68ch, offset left of centre on desktop with the technical sidebar in
the residual column. Not centred; centred is what a template does.

---

## 7. Component language

**Hairline box.** The atom. 1px `--hair`, `--tar` fill, no radius. On hover the border
lifts to `--hair-lit` and four 8px corner brackets in sulfur draw in from the corners
over 180ms. That single interaction is the site's signature and appears on every
card-like surface.

**Label.** `10–11px` Martian Mono, uppercase, tracked, `--dust`. Section labels take a
slash prefix: `/ LATEST RESEARCH`.

**Dot leader.** Label on the left, value on the right, dotted `--ghost` fill between,
rendered with a repeating radial-gradient so it reflows correctly. Used for article
metadata, finding fields, and CMS readouts.

**Record row.** The archive and listing primitive: `//0042 · DATE · CATEGORY · TITLE ·
READ TIME`, one line, tabular figures, hairline separated, hover lifts the row fill to
`--carbon` and slides the title 4px right.

**Article card.** Hairline box, record number top-left, category top-right, title in
display, one-line excerpt in `--ash`, tags as bare labels along the bottom. Optional
duotone cover with a 1px inset frame.

**Finding block.** Chamfered panel, severity colour as a 2px left edge and as the badge
fill, header row with ID / severity / CWE as dot-leader fields, body prose beneath.

**Terminal block.** Chamfered, `--slate`, a title bar carrying a host label, prompts in
`--dust`, output in `--bone`, exit codes coloured by severity. No typing animation.

**HTTP block.** Method and path in the header bar, headers as a dimmed key/value table,
body as syntax-highlighted code, copy button per section.

**File tree.** Box-drawing characters rendered as real text in code mono, directories in
`--bone`, files in `--ash`, annotated nodes in sulfur.

**Table of contents.** Desktop: fixed in the residual column, hex offsets on the left,
current section marked by a sulfur bracket that animates between positions. Mobile:
collapses into a bottom sheet triggered by a floating control.

---

## 8. Motion

```css
--dur-1:  90ms;   /* state flips: hover fills, focus rings   */
--dur-2: 140ms;   /* small transforms                        */
--dur-3: 220ms;   /* component enter/exit                    */
--dur-4: 340ms;   /* panel and sheet motion                  */
--dur-5: 560ms;   /* page transitions                        */
--dur-6: 900ms;   /* one-shot reveals, hero only             */

--ease-exit:  cubic-bezier(0.4, 0.0, 1, 1);
--ease-enter: cubic-bezier(0.16, 1, 0.3, 1);      /* expo out */
--ease-std:   cubic-bezier(0.4, 0.0, 0.2, 1);
--ease-snap:  cubic-bezier(0.2, 0.9, 0.25, 1);
```

### The four signature motions

1. **Decode.** Short label-mono strings resolve through a brief scramble of glyphs,
   left to right, over ~280ms, capped at 48 characters. Restricted to: the homepage
   index line, and the 404 status. Display headlines never scramble — rewriting a
   80px statement every frame is jank.
2. **Sweep.** Removed as a scroll-driven animation. Section rules are static hairlines
   with a dashed ASCII leader between title and meta. Drawing a `scaleX` off
   `animation-timeline: view()` re-ran work on every scroll frame.
3. **Bracket.** Corner brackets converge on hover/focus for any interactive box. 180ms,
   `--ease-snap`, transform + opacity only.
4. **Stagger.** Listing rows are visible from first paint. Nothing hides, nothing
   rises, no IntersectionObserver mutates the listing while you scroll.

### Page transitions

Off. Native view transitions snapshot named layers on every scroll frame in
Chromium, which is the flicker, and on navigation they screenshot the whole
document so the fade drops frames. Instant document loads until a transition can
name a thumbnail rather than a scrolling surface.

### Discipline

- Transform and opacity only. Nothing animates layout.
- Nothing loops. No ambient motion anywhere on the public site.
- Glitch is used exactly twice in the entire product: the 404 page, and a failed publish
  in the CMS. Anywhere else it is noise.
- `prefers-reduced-motion: reduce` disables decode, sweep, stagger and shared-element
  transitions entirely, keeping only opacity crossfades under 120ms. This is
  implemented as a single global rule plus a `useReducedMotion` guard in the two JS
  effects — not as an afterthought per component.

---

## 9. Mobile

Mobile gets its own interaction model, not a narrower desktop.

- **Navigation** is a bottom-anchored bar with four destinations and a search trigger,
  because the top of a phone screen is the worst place for a control. It hides on
  scroll-down and returns on scroll-up.
- **Article metadata** collapses into a single tappable summary line that expands into a
  sheet with full details, tags and the table of contents.
- **Code, terminal, HTTP and table blocks** break the reading margin to full bleed, scroll
  horizontally with a fade mask at the edges, and expose a copy control pinned to the
  block header.
- **Listings** drop to record rows rather than cards — denser and faster to scan on a
  narrow screen.
- **Motion** is reduced by default on small viewports: stagger caps at six elements,
  shared-element transitions are disabled, decode runs only on the homepage.
- Tap targets ≥ 44px. Reading measure stays at 34–40 characters with 20px margins.

---

## 10. The CMS looks related but not identical

The public site is a publication; the CMS is an instrument. They share tokens, fonts
and motion, and differ in density and geometry.

- Chamfered panels are the *default* here rather than the exception.
- Persistent chrome: a left rail of destinations, a top bar with document status, and a
  bottom status strip showing git branch, dirty-file count, last autosave, and preview
  connection — real state, continuously.
- More `--slate`, less `--void`; UI text in label mono, prose only inside the editor
  itself, where it uses the real body serif at the real measure so writing looks like
  reading.
- `--ember` for destructive actions, which the public site never uses.
- 2px radius on inputs and buttons, because a 0px input feels broken to type into.

---

## 11. Motif budget

The line between "technical publication" and "cheesy hacker site" is quantity. These
are hard limits, checked in design review:

- At most **two** decorative-technical motifs visible in any single viewport.
- Grain opacity ≤ `0.05`. It should be felt, not seen. Bitmap tile only — never a live
  SVG filter, never `background-attachment: fixed`, never a scanline overlay.
- Sulfur coverage ≤ **2%** of viewport pixels.
- Box-drawing is allowed in chrome: corner marks, index caps, section leaders, the
  colophon. Not in prose. File-tree blocks still render real tree characters.
- Zero fake data. No invented progress bars, uptime counters, animated statistics, fake
  IP addresses, or terminal prompts that are not real commands from the article.
- No skulls, no matrix rain, no scanline overlay as a permanent layer, no neon glow, no
  gradient text, no glassmorphism (`backdrop-filter` on sticky chrome included), no blob
  shapes, no `border-radius: 16px` cards.
- Hero sections state a fact or a title. They never say "Hi, I'm —".

## 12. Review checklist

Every new screen is checked against these before it ships:

1. Could a reader identify this site from a screenshot with the logo cropped out?
2. Does every rule, number and label refer to something real?
3. Is the accent still under 2%?
4. Does it still read well at 320px, and does it use a *different* interaction there?
5. Does every animation answer a question about where something came from?
6. With `prefers-reduced-motion` on, is it still complete and still good?
7. Is contrast ≥ 4.5:1 for body text and ≥ 3:1 for large text and UI borders?
8. Is there a visible focus state on every interactive element, and does it survive
   keyboard-only navigation of the whole page?
