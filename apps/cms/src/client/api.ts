export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep status text */
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean; preview: string }>('/api/health'),
  meta: () => request<Meta>('/api/meta'),
  posts: () => request<{ posts: PostListItem[] }>('/api/posts'),
  post: (slug: string) => request<PostDetail>(`/api/posts/${slug}`),
  createPost: (body: { title: string; category: string; slug?: string }) =>
    request<{ slug: string; record: number }>('/api/posts', { method: 'POST', body: JSON.stringify(body) }),
  savePost: (slug: string, body: unknown) =>
    request<PostDetail & { savedAt: string }>(`/api/posts/${slug}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePost: (slug: string) => request<{ ok: boolean }>(`/api/posts/${slug}`, { method: 'DELETE' }),
  media: (slug: string) => request<{ files: string[] }>(`/api/posts/${slug}/media`),
  upload: async (slug: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ src: string; files: string[] }>(`/api/posts/${slug}/media`, { method: 'POST', body: form });
  },
  deleteMedia: (slug: string, file: string) =>
    request<{ ok: boolean; files: string[] }>(`/api/posts/${slug}/media/${encodeURIComponent(file)}`, {
      method: 'DELETE',
    }),
  projects: () => request<{ projects: ProjectListItem[] }>('/api/projects'),
  project: (slug: string) => request<ProjectDetail>(`/api/projects/${slug}`),
  createProject: (body: { name: string; tagline: string; slug?: string }) =>
    request<{ slug: string; record: number }>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  saveProject: (slug: string, body: unknown) =>
    request<ProjectDetail & { savedAt: string }>(`/api/projects/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  taxonomy: () => request<Taxonomy>('/api/taxonomy'),
  saveTaxonomy: (body: Taxonomy) => request<Taxonomy>('/api/taxonomy', { method: 'PUT', body: JSON.stringify(body) }),
  git: () => request<GitPayload>('/api/git'),
  publish: (body: { slug: string; kind?: 'posts' | 'projects'; message?: string }) =>
    request<PublishResult>('/api/git/publish', { method: 'POST', body: JSON.stringify(body) }),
  unpublish: (slug: string) =>
    request<{ ok: boolean; status: string }>('/api/git/unpublish', { method: 'POST', body: JSON.stringify({ slug }) }),
  push: () => request<{ ok: boolean }>('/api/git/push', { method: 'POST', body: JSON.stringify({}) }),
};

export interface Issue {
  level: 'error' | 'warning';
  record: string;
  message: string;
  line?: number;
}

export interface PostListItem {
  slug: string;
  record: number;
  title: string;
  status: 'draft' | 'published';
  category: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  featured: boolean;
  wordCount: number;
  readingMinutes: number;
  issues: Issue[];
}

export interface PostDetail {
  slug: string;
  frontmatter: Record<string, unknown>;
  blocks: unknown[];
  headings?: unknown[];
  wordCount?: number;
  readingMinutes?: number;
  issues: Issue[];
  savedAt?: string;
}

export interface ProjectListItem {
  slug: string;
  record: number;
  name: string;
  tagline: string;
  status: string;
  published: boolean;
  featured: boolean;
  technologies: string[];
  startedAt: string;
  issues: Issue[];
}

export interface ProjectDetail {
  slug: string;
  frontmatter: Record<string, unknown>;
  blocks: unknown[];
  issues: Issue[];
}

export interface Taxonomy {
  categories: Array<{ slug: string; name: string; abbr: string; description: string; order: number }>;
  tags: Array<{ slug: string; name: string; description?: string }>;
  series: Array<{ slug: string; name: string; description?: string }>;
}

export interface GitState {
  branch: string;
  dirty: string[];
  ahead: number;
  behind: number;
  lastCommit: string | null;
}

export interface GitPayload extends GitState {
  commits: Array<{ hash: string; subject: string; at: string }>;
}

export interface Meta {
  counts: {
    posts: number;
    published: number;
    drafts: number;
    projects: number;
    categories: number;
    tags: number;
  };
  recent: Array<{ slug: string; title: string; publishedAt: string | null; record: number }>;
  draftAges: Array<{ slug: string; title: string; updatedAt: string | null }>;
  validation: { issues: Issue[]; errorCount: number; warningCount: number };
  git: GitState;
  commits: Array<{ hash: string; subject: string; at: string }>;
  preview: string;
}

export interface PublishResult {
  ok: boolean;
  steps: Array<{ id: string; ok: boolean; detail: string }>;
  error?: string;
}
