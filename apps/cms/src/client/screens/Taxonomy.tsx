import { useEffect, useState } from 'react';

import { api, type Taxonomy } from '../api.ts';

interface Props {
  onToast: (toast: { text: string; fail?: boolean }) => void;
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

  const save = async (): Promise<void> => {
    try {
      setTaxonomy(await api.saveTaxonomy(taxonomy));
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
        <p className="stat__k">Categories</p>
        {taxonomy.categories.map((category, index) => (
          <div className="form-row" key={category.slug} style={{ marginBlockStart: '0.6rem' }}>
            <label>
              Slug
              <input
                value={category.slug}
                onChange={(event) => {
                  const categories = [...taxonomy.categories];
                  categories[index] = { ...category, slug: event.target.value };
                  setTaxonomy({ ...taxonomy, categories });
                }}
              />
            </label>
            <label>
              Name
              <input
                value={category.name}
                onChange={(event) => {
                  const categories = [...taxonomy.categories];
                  categories[index] = { ...category, name: event.target.value };
                  setTaxonomy({ ...taxonomy, categories });
                }}
              />
            </label>
            <label>
              Abbr
              <input
                value={category.abbr}
                onChange={(event) => {
                  const categories = [...taxonomy.categories];
                  categories[index] = { ...category, abbr: event.target.value };
                  setTaxonomy({ ...taxonomy, categories });
                }}
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
