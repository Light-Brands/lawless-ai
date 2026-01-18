'use client';

interface BreadcrumbProps {
  repoName: string;
  currentPath: string;
  onNavigate: (path: string, isFile?: boolean) => void;
}

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default function Breadcrumb({ repoName, currentPath, onNavigate }: BreadcrumbProps) {
  const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const handleClick = (index: number) => {
    if (index === -1) {
      // Root
      onNavigate('', false);
    } else {
      const path = parts.slice(0, index + 1).join('/');
      onNavigate(path, false);
    }
  };

  return (
    <nav className="breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <button
            className={`breadcrumb-link ${!currentPath ? 'active' : ''}`}
            onClick={() => handleClick(-1)}
          >
            {repoName}
          </button>
        </li>
        {parts.map((part, index) => (
          <li key={index} className="breadcrumb-item">
            <span className="breadcrumb-separator">
              <ChevronRightIcon />
            </span>
            <button
              className={`breadcrumb-link ${index === parts.length - 1 ? 'active' : ''}`}
              onClick={() => handleClick(index)}
            >
              {part}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
