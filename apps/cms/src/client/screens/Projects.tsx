import { useEffect, useState } from 'react';

import { api, type ProjectListItem } from '../api.ts';

interface Props {
  onToast: (toast: { text: string; fail?: boolean }) => void;
}

export function Projects({ onToast }: Props): React.ReactElement {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    void api
      .projects()
      .then((payload) => setProjects(payload.projects))
      .catch((error: unknown) => onToast({ text: error instanceof Error ? error.message : 'Load failed', fail: true }));
  }, [onToast]);

  const create = async (): Promise<void> => {
    if (!name.trim() || !tagline.trim()) return;
    try {
      const created = await api.createProject({ name: name.trim(), tagline: tagline.trim() });
      onToast({ text: `Project //${created.record.toString().padStart(4, '0')}` });
      setName('');
      setTagline('');
      const payload = await api.projects();
      setProjects(payload.projects);
    } catch (error) {
      onToast({ text: error instanceof Error ? error.message : 'Create failed', fail: true });
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
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Tagline
          <input value={tagline} onChange={(event) => setTagline(event.target.value)} />
        </label>
        <button className="primary" type="submit">
          Create
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
            <tr key={project.slug}>
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
