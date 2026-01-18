'use client';

interface Project {
  id: string;
  name: string;
  framework: string | null;
  createdAt: number;
  updatedAt: number;
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
  onDeleteProject?: (project: Project) => void;
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

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

export default function ProjectTree({ projects, selectedProject, onSelectProject, onDeleteProject }: ProjectTreeProps) {
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
            <div className={`project-tree-item ${selectedProject?.id === project.id ? 'selected' : ''}`}>
              <button
                className="project-tree-item-main"
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
              {onDeleteProject && (
                <button
                  className="project-tree-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project);
                  }}
                  title="Delete project"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
