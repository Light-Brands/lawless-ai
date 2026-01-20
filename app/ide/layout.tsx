import { Metadata } from 'next';
import './styles/ide.css';

export const metadata: Metadata = {
  title: 'Lawless AI IDE',
  description: 'AI-powered development environment with Claude at its core',
};

export default function IDELayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ide-root">
      {children}
    </div>
  );
}
