import { slugify } from '@codeblin/content/client';
import { useEffect, useState } from 'react';

import { api, type Taxonomy } from '../api.ts';

interface Props {
  onToast: (toast: { text: string; fail?: boolean }) => void;
}

function unusedSlug(existing: readonly string[], base: string): string {
  if (!existing.includes(base)) return base;
  for (let index = 2; index < 80; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function Taxonomy({ onToast }: Props): React.ReactElement {
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);

  useEffect(() => {
    void api
      .taxonomy()
      .then(setTaxonomy)
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Load failed', fail: true }));
  }, [onToast]);

  if (!taxonomy) return <p className="empty">Loading taxonomy…</p>;

  const patchCategory = (index: number, patch: Partial<Taxonomy['categories'][number]>): void => {
    const categories = [...taxonomy.categories];
    const current = categories[index];
    if (!current) return;
    categories[index] = { ...current, ...patch };
    setTaxonomy({ ...taxonomy, categories });
  };

  const addCategory = (): void => {
    const slugs = taxonomy.categories.map((category) => category.slug);
    const order = taxonomy.categories.reduce((max, category) => Math.max(max, category.order), 0) + 1;
    setTaxonomy({
      ...taxonomy,
      categories: [
        ...taxonomy.categories,
        {
          slug: unusedSlug(slugs, 'new-category'),
          name: 'New category',
          abbr: 'NEW',
          description: 'Describe this category.',
          order,
        },
      ],
    });
  };

  const removeCategory = (index: number): void => {
    const category = taxonomy.categories[index];
    if (!category) return;
    if (!window.confirm(`Remove “${category.name}”? Posts still using this slug will fail validation.`)) return;
    setTaxonomy({
      ...taxonomy,
      categories: taxonomy.categories.filter((_, current) => current !== index),
    });
  };

  const save = async (): Promise<void> => {
    try {
      const payload: Taxonomy = {
        ...taxonomy,
        categories: taxonomy.categories.map((category) => ({
          ...category,
          slug: slugify(category.slug),
          abbr: category.abbr.toUpperCase(),
        })),
      };
      setTaxonomy(await api.saveTaxonomy(payload));
      onToast({ text: 'Taxonomy saved' });
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Save failed', fail: true });
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div className="form-row">
        <button className="primary" type="button" onClick={() => void save()}>
          Save taxonomy
        </button>
      </div>

      <section className="panel">
        <div className="form-row" style={{ justifyContent: 'space-between' }}>
          <p className="stat__k">Categories</p>
          <button type="button" onClick={addCategory}>
            Add category
          </button>
        </div>
        {taxonomy.categories.length === 0 && <p className="empty">No categories yet.</p>}
        {taxonomy.categories.map((category, index) => (
          <div key={`${category.order}-${index}`} style={{ marginBlockStart: '0.85rem' }}>
            <div className="form-row">
              <label>
                Slug
                <input
                  value={category.slug}
                  onChange={(event) => patchCategory(index, { slug: event.target.value })}
                />
              </label>
              <label>
                Name
                <input value={category.name} onChange={(event) => patchCategory(index, { name: event.target.value })} />
              </label>
              <label>
                Abbr
                <input
                  value={category.abbr}
                  maxLength={4}
                  onChange={(event) => patchCategory(index, { abbr: event.target.value.toUpperCase() })}
                />
              </label>
              <button type="button" className="danger" onClick={() => removeCategory(index)}>
                Remove
              </button>
            </div>
            <label style={{ marginBlockStart: '0.45rem' }}>
              Description
              <textarea
                rows={2}
                value={category.description}
                onChange={(event) => patchCategory(index, { description: event.target.value })}
              />
            </label>
          </div>
        ))}
      </section>

      <section className="panel">
        <p className="stat__k">Tags — {taxonomy.tags.length}</p>
        <p className="empty">
          Tags are created from the article editor. The registry only supplies display names.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {taxonomy.tags.map((tag) => (
            <span key={tag.slug} className="badge">
              #{tag.slug}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
