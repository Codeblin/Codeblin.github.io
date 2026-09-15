<?xml version="1.0" encoding="utf-8"?>
<!--
  Browsers render raw RSS as an error page or a wall of XML. This stylesheet
  gives the feed the same identity as the site for anyone who clicks the link
  expecting a page. Feed readers ignore it entirely.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="utf-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title><xsl:value-of select="/rss/channel/title"/> — Feed</title>
        <style>
          :root {
            --void: #08080a; --tar: #0c0c10; --hair: #23232b;
            --bone: #e9e5dc; --ash: #9b9b93; --dust: #6b6b66; --ghost: #43433f;
            --sulfur: #cfd84e;
            color-scheme: dark;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0; padding: 3rem 1.5rem 6rem; background: var(--void); color: var(--ash);
            font: 400 16px/1.6 ui-serif, Georgia, serif;
          }
          .wrap { max-inline-size: 62rem; margin-inline: auto; }
          .mono {
            font: 400 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
            letter-spacing: 0.16em; text-transform: uppercase;
          }
          .slash { color: var(--sulfur); }
          h1 {
            margin: 0.75rem 0 0; font-family: ui-sans-serif, "Helvetica Neue", Arial, sans-serif;
            font-size: clamp(2rem, 6vw, 3.5rem); font-weight: 800; letter-spacing: -0.02em;
            color: var(--bone); line-height: 0.95;
          }
          .lede { max-inline-size: 58ch; margin: 1rem 0 0; }
          .notice {
            margin: 2rem 0 0; padding: 1rem 1.25rem; border: 1px solid var(--hair);
            background: var(--tar);
          }
          .notice code { color: var(--sulfur); font-family: ui-monospace, monospace; font-size: 0.85em; }
          ol { list-style: none; margin: 3rem 0 0; padding: 0; border-block-start: 1px solid var(--hair); }
          li { border-block-end: 1px solid var(--hair); }
          a.item {
            display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: 1.5rem;
            padding: 1.25rem 0.5rem; text-decoration: none; color: inherit;
          }
          a.item:hover { background: var(--tar); }
          .date { color: var(--ghost); }
          a.item:hover .date { color: var(--sulfur); }
          .title {
            font-family: ui-sans-serif, "Helvetica Neue", Arial, sans-serif;
            font-size: 1.1875rem; font-weight: 600; color: var(--bone); line-height: 1.2;
          }
          .desc { margin: 0.5rem 0 0; font-size: 0.9375rem; color: var(--ash); }
          footer { margin-block-start: 3rem; color: var(--dust); }
          footer a { color: var(--ash); }
          @media (max-width: 40rem) { a.item { grid-template-columns: 1fr; gap: 0.5rem; } }
        </style>
      </head>
      <body>
        <div class="wrap">
          <p class="mono"><span class="slash">/</span> RSS FEED</p>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lede"><xsl:value-of select="/rss/channel/description"/></p>

          <div class="notice">
            <p class="mono" style="color:var(--dust);margin:0 0 0.5rem">Subscribe</p>
            <p style="margin:0">
              Paste <code><xsl:value-of select="/rss/channel/atom:link/@href"/></code>
              into any feed reader. Or
              <a href="{/rss/channel/link}" style="color:var(--sulfur)">read on the site</a>.
            </p>
          </div>

          <ol>
            <xsl:for-each select="/rss/channel/item">
              <li>
                <a class="item" href="{link}">
                  <span class="mono date"><xsl:value-of select="substring(pubDate, 6, 11)"/></span>
                  <span>
                    <span class="title"><xsl:value-of select="title"/></span>
                    <p class="desc"><xsl:value-of select="description"/></p>
                  </span>
                </a>
              </li>
            </xsl:for-each>
          </ol>

          <footer class="mono">
            <a href="{/rss/channel/link}">← Back to the archive</a>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
