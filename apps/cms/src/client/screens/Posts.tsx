import { useEffect, useMemo, useState } from 'react';

import { api, type PostListItem, type Taxonomy } from '../api.ts';
import { CommaListInput } from '../editor/CommaListInput.tsx';

interface Props {
  go: (to: string) => void;
  filter: 'all' | 'draft';
  onToast: (toast: { text: string; fail?: boolean }) => void;
}

export function Posts({ go, filter, onToast }: Props): React.ReactElement {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = (): void => {
    void api
      .posts()
      .then((payload) => setPosts(payload.posts))
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Load failed', fail: true }));
  };

  useEffect(load, [onToast]);

  useEffect(() => {
    void api
      .taxonomy()
      .then((payload) => {
        setTaxonomy(payload);
        setCategory((current) => current || payload.categories[0]?.slug || '');
      })
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Taxonomy failed', fail: true }));
  }, [onToast]);

  const visible = useMemo(() => {
    const needle = query.toLowerCase();
    return posts.filter((post) => {
      if (filter === 'draft' && post.status !== 'draft') return false;
      if (!needle) return true;
      return (
        post.title.toLowerCase().includes(needle) ||
        post.slug.includes(needle) ||
        post.tags.some((tag) => tag.includes(needle))
      );
    });
  }, [posts, query, filter]);

  const create = async (): Promise<void> => {
    const nextTitle = title.trim();
    const nextCategory = category.trim();
    if (!nextTitle) {
      onToast({ text: 'Give the article a title first', fail: true });
      return;
    }
    if (!nextCategory) {
      onToast({ text: 'Pick a category', fail: true });
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const created = await api.createPost({ title: nextTitle, category: nextCategory, tags });
      onToast({ text: `Created //${created.record.toString().padStart(4, '0')}` });
      setTitle('');
      setTags([]);
      go(`/posts/${created.slug}`);
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Create failed', fail: true });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <form
        className="form-row panel"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label>
          New title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Article title"
            required
            autoComplete="off"
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} required>
            {taxonomy?.categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <CommaListInput
          label="Tags"
          values={tags}
          onChange={setTags}
          placeholder="android, frida"
        />
        <button className="primary" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create'}
        </button>
        <label style={{ marginInlineStart: 'auto' }}>
          Filter
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="title, slug, tag" />
        </label>
      </form>

      <table className="rows">
        <thead>
          <tr>
            <th>Record</th>
            <th>Title</th>
            <th>Status</th>
            <th>Category</th>
            <th>Words</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((post) => (
            <tr key={post.slug} onClick={() => go(`/posts/${post.slug}`)} style={{ cursor: 'pointer' }}>
              <td>//{post.record.toString().padStart(4, '0')}</td>
              <td>{post.title}</td>
              <td className={`badge ${post.status}`}>{post.status}</td>
              <td>{post.category}</td>
              <td>{post.wordCount}</td>
              <td>{post.issues.filter((issue) => issue.level === 'error').length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
