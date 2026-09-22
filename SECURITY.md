# Security decisions

CODEBLIN is a static publication plus a local authoring instrument. This file
records the decisions and the accepted gaps so they are not rediscovered as
accidents.

## Public site

- **No raw HTML from content.** `remark-rehype` runs with `allowDangerousHtml:
  false`. Directive attributes are zod-validated. `href` values are restricted
  to `https:`, `mailto:`, site-relative paths, and fragments.
- **No third-party runtime, with two narrow exceptions.** No analytics, no
  font CDN. Self-hosted fonts only. Gist embeds stay as link cards. YouTube
  **video** blocks iframe `https://www.youtube-nocookie.com/embed/<id>` so the
  player sits in the article; CSP `frame-src` allows only that host. Mermaid
  diagrams load mermaid.js only on pages that contain a diagram block, with
  `securityLevel: 'strict'` and `htmlLabels: false`; the SVG is sanitised
  before insert. Server-side Mermaid (jsdom) cannot measure real SVG layout
  and crops the chart, so the public page uses the same browser renderer as
  the CMS preview. The footer reads same-origin `/advisories.json`
  (GitHub is contacted by the build / dev server, never the browser).
  CSP `connect-src` is `'self'` only.
- **CSP via meta tag.** GitHub Pages cannot set response headers. A
  `Content-Security-Policy` meta tag is the available control. It is weaker
  than a real header (it cannot restrict `frame-ancestors` or some navigation
  policies). Moving behind a proxy later is a one-file change: add
  `public/_headers` or the Pages custom-header config.
- **Uploads never reach production except as committed files.** Images in
  `content/**/media` are reviewed in git. SVG is rejected at the CMS boundary.
- **Drafts are not built.** `listPosts()` excludes `status: draft`. The
  `/_draft/` preview route emits zero paths in production.

### Accepted gaps

- GitHub Pages cannot emit `Strict-Transport-Security`, `X-Frame-Options`, or
  a header CSP. Documented. Mitigate with a custom domain + CDN if the threat
  model ever includes clickjacking of the archive itself.
- Client-side search loads `/search-index.json`. It contains published text
  only. It is not a secret.

## CMS

- Binds `127.0.0.1` only. Never `0.0.0.0`.
- Origin, `Host`, `Sec-Fetch-Site`, and JSON/multipart content-type checks on
  every mutating request.
- Every filesystem path is resolved and asserted to sit inside `content/`
  before read or write. Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Git runs as `execFile('git', argv)` with a fixed argument list. There is no
  endpoint that accepts a command string.
- No tokens in the repo, the client bundle, or `localStorage`. Authentication
  is whatever the local git credential helper already has.
- Uploads: extension allowlist plus magic-byte sniff. SVG rejected. Filenames
  regenerated from a slugified stem plus the sniffed type.
- Recovery journal at `.cms/journal/` is gitignored and never served.

### Accepted gaps

- There is no authentication on the loopback API. A process on the same
  machine can call it. That is the local-instrument threat model, not a
  networked service.
- A compromised browser extension running in the CMS tab has the same
  privileges as the author. Do not install untrusted extensions in that
  profile.

## Dependencies

- npm workspaces, lockfile committed.
- CI runs `npm ci`, content validation, tests, and the production build.
- No `eval`, no `child_process.exec` (string form). Author markdown is never
  assigned to `innerHTML`. Mermaid is compiled to sanitized SVG at build time
  and inlined; that SVG is generated output, not the author's source.
