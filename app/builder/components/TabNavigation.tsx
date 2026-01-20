'use client';

import type { BuilderType } from '@/app/types/builder';

interface TabNavigationProps {
  activeTab: BuilderType;
  onTabChange: (tab: BuilderType) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="builder-tabs">
      <button
        className={`builder-tab ${activeTab === 'plan' ? 'active' : ''}`}
        onClick={() => onTabChange('plan')}
      >
        Plan Builder
      </button>
      <button
        className={`builder-tab ${activeTab === 'identity' ? 'active' : ''}`}
        onClick={() => onTabChange('identity')}
      >
        Identity Builder
      </button>
    </div>
  );
}
