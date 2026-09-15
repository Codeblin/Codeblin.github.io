# CODEBLIN

A personal security research publication and the local instrument that writes it.

```
Open CMS → write → preview → save draft → publish → git commit → git push → GitHub Pages
```

Two applications, one repository, git as the source of truth.

| | URL | What |
| --- | --- | --- |
| Publication | http://localhost:4321 | Astro static site |
| CMS | http://localhost:4322 | React authoring UI (local only) |
| CMS API | http://127.0.0.1:4323 | Hono, loopback only |

The CMS is never deployed. `npm run build` builds `apps/web` only.

## Setup

```bash
npm install
npm run fonts
npm run dev
```

Requires Node 22+. Git on the PATH for publishing.

Fill in `apps/web/src/site.config.ts` (domain, author, social links) before the
first deploy.

## Authoring

From the CMS: **Posts → Create → write → Save → Publish**.

Publish validates the record, stages its files, commits, and pushes with the
machine's existing git credentials. A failed push leaves the article saved on
disk.

From the command line:

```bash
npm run new:post -- "Title" --category mobile-security
npm run content:validate
npm run content:fmt
```

Content lives in `content/posts/<slug>/index.md` with colocated `media/`.
The format is CommonMark + YAML frontmatter + typed directives. See
`CONTENT_MODEL.md`.

## Deploy

GitHub Actions builds the static site and deploys to GitHub Pages on push to
`main`. Enable Pages in the repository settings (source: GitHub Actions).

For a custom domain, point DNS at Pages and set `site.url` in
`apps/web/src/site.config.ts`.

## Layout

```
apps/web          public site (Astro)
apps/cms          local CMS (Vite + Hono)
packages/content  schemas, markdown ⇄ blocks, filesystem repo
packages/tokens   design tokens
content/          the archive itself
```

Architecture, design, content model and the phase plan:

- `ARCHITECTURE.md`
- `DESIGN.md`
- `CONTENT_MODEL.md`
- `ROADMAP.md`
- `SECURITY.md`
