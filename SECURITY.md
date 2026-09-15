# Security decisions

CODEBLIN is a static publication plus a local authoring instrument. This file
records the decisions and the accepted gaps so they are not rediscovered as
accidents.

## Public site

- **No raw HTML from content.** `remark-rehype` runs with `allowDangerousHtml:
  false`. Directive attributes are zod-validated. `href` values are restricted
  to `https:`, `mailto:`, site-relative paths, and fragments.
- **No third-party runtime.** No analytics, no font CDN, no embed iframes
  (YouTube/Gist render as link cards). Self-hosted fonts only. The footer
  status strip is the one exception: it reads GitHub's public advisories API
  (no auth, no cookies, `referrerPolicy: no-referrer`) so the strip can show
  live GHSA/CVE data. Responses are cached in `sessionStorage` for 30 minutes.
  CSP `connect-src` allows `https://api.github.com` and nothing else off-origin.
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
- No `eval`, no `child_process.exec` (string form), no `innerHTML` assignment
  of author content on the public site.
