import { useEffect, useState } from 'react';

import { api, type ProjectListItem } from '../api.ts';

interface Props {
  go: (to: string) => void;
  onToast: (toast: { text: string; fail?: boolean }) => void;
}

export function Projects({ go, onToast }: Props): React.ReactElement {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void api
      .projects()
      .then((payload) => setProjects(payload.projects))
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Load failed', fail: true }));
  }, [onToast]);

  const create = async (): Promise<void> => {
    const nextName = name.trim();
    const nextTagline = tagline.trim();
    if (!nextName) {
      onToast({ text: 'Give the project a name first', fail: true });
      return;
    }
    if (!nextTagline) {
      onToast({ text: 'Add a tagline', fail: true });
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const created = await api.createProject({ name: nextName, tagline: nextTagline });
      onToast({ text: `Project //${created.record.toString().padStart(4, '0')}` });
      setName('');
      setTagline('');
      go(`/projects/${created.slug}`);
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
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="off" />
        </label>
        <label>
          Tagline
          <input value={tagline} onChange={(event) => setTagline(event.target.value)} required autoComplete="off" />
        </label>
        <button className="primary" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      <table className="rows">
        <thead>
          <tr>
            <th>Record</th>
            <th>Name</th>
            <th>Status</th>
            <th>Stack</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.slug} onClick={() => go(`/projects/${project.slug}`)} style={{ cursor: 'pointer' }}>
              <td>//{project.record.toString().padStart(4, '0')}</td>
              <td>{project.name}</td>
              <td>{project.status}</td>
              <td>{project.technologies.join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
