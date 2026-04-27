import type { FC } from 'react';

export type Tab = 'set-limits' | 'stats' | 'all-limits' | 'settings';

interface TabNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'set-limits', label: 'Set Limits' },
  { id: 'stats', label: 'Live Stats' },
  { id: 'all-limits', label: 'All Limits' },
];

export const TabNav: FC<TabNavProps> = ({ activeTab, onTabChange }) => (
  <nav className="tabs">
    {TABS.map(({ id, label }) => (
      <button
        key={id}
        className={`tab-btn${activeTab === id ? ' active' : ''}`}
        data-tab={id}
        onClick={() => onTabChange(id)}
      >
        {label}
      </button>
    ))}
  </nav>
);
