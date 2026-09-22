/**
 * @codeblin/content — the contract between the publication and the CMS.
 *
 * Everything the two applications share about what content *is* lives behind
 * this entry point: the schemas, the markdown ⇄ block conversion, the derived
 * data, the filesystem repository, and the one validator.
 */

export * from './schema/index.ts';

export { parseBlocks, type Diagnostic, type ParsedBody } from './markdown/parse.ts';
export { serializeBlocks } from './markdown/serialize.ts';
export { renderInline, renderMarkdown } from './markdown/inline.ts';
export { composeDocument, splitDocument } from './markdown/frontmatter.ts';
export {
  formatLineRanges,
  parseLineRanges,
  parseMeta,
  writeAttributes,
} from './markdown/attributes.ts';

export { collectHeadings, deriveDocument, toHexOffset } from './derive/document.ts';
export { countWords, extractText, stripMarkdown } from './derive/text.ts';
export { adjacentPosts, relatedPosts, seriesPosts, type Adjacent } from './derive/relations.ts';

export {
  byNewestFirst,
  invalidatePostCache,
  listPosts,
  listPostSlugs,
  parsePostDocument,
  readPost,
  serializePost,
  type LoadedPost,
  type PostQuery,
} from './repository/posts.ts';
export {
  allocateSlug,
  createPost,
  deleteMedia,
  deletePost,
  listMedia,
  nextPostRecord,
  readMedia,
  saveMedia,
  savePost,
  sniffMedia,
  type MediaKind,
} from './repository/mutate.ts';
export {
  createProject,
  deleteProject,
  nextProjectRecord,
  saveProject,
} from './repository/mutate-project.ts';
export { writeTaxonomy } from './repository/mutate-taxonomy.ts';
export { atomicWrite } from './repository/write.ts';
export { newBlockId, slugify, today } from './ids.ts';
export { emptyBlock } from './factory.ts';
export { looksLikeMermaid, sanitizeMermaidSvg } from './mermaid.ts';
export { isYoutubeSrc, parseYoutubeRef, youtubeSrc, youtubeWatchUrl } from './youtube.ts';
export {
  invalidatePageCache,
  pageFrontmatterSchema,
  readPage,
  type LoadedPage,
  type PageFrontmatter,
} from './repository/pages.ts';
export {
  invalidateProjectCache,
  listProjects,
  listProjectSlugs,
  readProject,
  serializeProject,
  type LoadedProject,
} from './repository/projects.ts';
export {
  findCategory,
  findSeries,
  findTag,
  humanise,
  invalidateTaxonomyCache,
  readTaxonomy,
  resolveTag,
} from './repository/taxonomy.ts';
export {
  assertInsideContent,
  contentRoot,
  documentFile,
  mediaDirectory,
  pagesRoot,
  postDirectory,
  postsRoot,
  projectDirectory,
  projectsRoot,
  repositoryRoot,
  taxonomyFile,
  toRepositoryPath,
} from './repository/paths.ts';

export {
  formatReport,
  pad,
  validateCorpus,
  validatePost,
  validateProject,
  type Issue,
  type IssueLevel,
  type ValidationReport,
} from './validate.ts';
