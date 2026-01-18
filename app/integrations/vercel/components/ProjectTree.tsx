'use client';

interface Project {
  id: string;
  name: string;
  framework: string | null;
  latestDeployment: {
    id: string;
    url: string;
    state: string;
    createdAt: number;
  } | null;
}

interface ProjectTreeProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
}

const frameworkIcons: Record<string, string> = {
  nextjs: 'N',
  nuxtjs: 'Nu',
  gatsby: 'G',
  remix: 'R',
  svelte: 'S',
  vue: 'V',
  react: 'Re',
  angular: 'A',
  astro: 'As',
};

function getStatusColor(state: string): string {
  switch (state?.toUpperCase()) {
    case 'READY':
      return 'var(--color-success)';
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED':
      return 'var(--color-warning)';
    case 'ERROR':
      return 'var(--color-error)';
    case 'CANCELED':
      return 'var(--color-text-muted)';
    default:
      return 'var(--color-text-tertiary)';
  }
}

export default function ProjectTree({ projects, selectedProject, onSelectProject }: ProjectTreeProps) {
  if (!projects.length) {
    return (
      <div className="project-tree-empty">
        <span>No projects found</span>
      </div>
    );
  }

  return (
    <div className="project-tree">
      <ul className="project-tree-list">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              className={`project-tree-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
              onClick={() => onSelectProject(project)}
            >
              <div className="project-tree-item-icon">
                {frameworkIcons[project.framework || ''] || 'P'}
              </div>
              <div className="project-tree-item-content">
                <span className="project-tree-item-name">{project.name}</span>
                {project.latestDeployment && (
                  <span className="project-tree-item-status">
                    <span
                      className="status-dot"
                      style={{ backgroundColor: getStatusColor(project.latestDeployment.state) }}
                    ></span>
                    {project.latestDeployment.state}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
