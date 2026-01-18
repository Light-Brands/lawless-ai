'use client';

import Link from 'next/link';

// SVG Icons
const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
    <path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);

const RocketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);

const IntegrationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="8" x="2" y="2" rx="2"/>
    <path d="M14 2c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2"/>
    <path d="M20 2c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2"/>
    <path d="M10 18H5c-1.7 0-3-1.3-3-3v-1"/>
    <polyline points="7 21 10 18 7 15"/>
    <rect width="8" height="8" x="14" y="14" rx="2"/>
  </svg>
);

const TerminalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

const WorkspaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>
  </svg>
);

const RepoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

interface ToolCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const tools: ToolCard[] = [
  {
    title: 'Databases',
    description: 'Manage and query your databases',
    icon: <DatabaseIcon />,
    href: '/databases',
    color: 'var(--color-primary-500)',
  },
  {
    title: 'Deployments',
    description: 'View and manage your deployments',
    icon: <RocketIcon />,
    href: '/deployments',
    color: 'var(--color-success)',
  },
  {
    title: 'Integrations',
    description: 'Connect external services',
    icon: <IntegrationIcon />,
    href: '/integrations',
    color: 'var(--color-accent-500)',
  },
  {
    title: 'Workspace',
    description: 'Access your development workspace',
    icon: <WorkspaceIcon />,
    href: '/repos',
    color: 'var(--color-warning)',
  },
];

export default function ToolsPage() {
  return (
    <div className="tools-page">
      <header className="tools-header">
        <h1>Tools</h1>
        <p>Access development tools and services</p>
      </header>

      <div className="tools-grid">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="tool-card">
            <div className="tool-card-icon" style={{ color: tool.color }}>
              {tool.icon}
            </div>
            <div className="tool-card-content">
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
            </div>
            <div className="tool-card-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
