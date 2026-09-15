/**
 * Rewrite every post and project in canonical markdown form so hand-edits
 * and CMS edits never fight in the diff. See ARCHITECTURE.md §2.4.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  atomicWrite,
  documentFile,
  parsePostDocument,
  postsRoot,
  projectDirectory,
  projectsRoot,
  serializePost,
  serializeProject,
  splitDocument,
  projectFrontmatterSchema,
  parseBlocks,
} from '@codeblin/content';

function fmtPosts() {
  let count = 0;
  for (const slug of readdirSync(postsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)) {
    const file = documentFile(path.join(postsRoot, slug));
    const post = parsePostDocument(slug, path.join(postsRoot, slug), readFileSync(file, 'utf8'));
    atomicWrite(file, serializePost(post.frontmatter, post.blocks));
    count += 1;
  }
  return count;
}

function fmtProjects() {
  let count = 0;
  let entries = [];
  try {
    entries = readdirSync(projectsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name);
  } catch {
    return 0;
  }
  for (const slug of entries) {
    const directory = projectDirectory(slug);
    const file = documentFile(directory);
    const { data, body } = splitDocument(readFileSync(file, 'utf8'));
    const frontmatter = projectFrontmatterSchema.parse(data);
    const { blocks } = parseBlocks(body);
    atomicWrite(file, serializeProject(frontmatter, blocks));
    count += 1;
  }
  return count;
}

const posts = fmtPosts();
const projects = fmtProjects();
console.log(`Formatted ${posts} posts, ${projects} projects.`);
