import { findCategory, listPosts } from '@codeblin/content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { author, site } from '~/site.config.ts';

/**
 * Feed carries metadata and the excerpt, not the full article. Bodies contain
 * findings, terminal transcripts and file trees whose meaning depends on the
 * site's own styling; a reader would render them as undifferentiated mush.
 */
export async function GET(context: APIContext): Promise<Response> {
  const origin = context.site ?? new URL(site.url);

  return rss({
    title: site.title,
    description: site.description,
    site: origin,
    trailingSlash: true,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      dc: 'http://purl.org/dc/elements/1.1/',
      codeblin: new URL('ns/feed', site.url).href,
    },
    customData: [
      `<language>${site.language}</language>`,
      `<managingEditor>${author.email} (${author.name})</managingEditor>`,
      `<atom:link href="${new URL('rss.xml', origin).href}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
    items: listPosts().map((post) => {
      const { frontmatter } = post;
      const category = findCategory(frontmatter.category);

      return {
        title: frontmatter.title,
        link: `/research/${post.slug}/`,
        description: frontmatter.excerpt ?? frontmatter.subtitle ?? '',
        pubDate: frontmatter.publishedAt ? new Date(`${frontmatter.publishedAt}T00:00:00Z`) : undefined,
        categories: [category?.name ?? frontmatter.category, ...frontmatter.tags],
        customData: [
          `<dc:creator><![CDATA[${author.name}]]></dc:creator>`,
          `<codeblin:record>${frontmatter.record}</codeblin:record>`,
          `<codeblin:readingMinutes>${post.readingMinutes}</codeblin:readingMinutes>`,
        ].join(''),
      };
    }),
    stylesheet: '/rss.xsl',
  });
}
