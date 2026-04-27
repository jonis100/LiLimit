import { useState, type FC } from 'react';
import { Header } from './components/Header.js';
import { TabNav, type Tab } from './components/TabNav.js';
import { SetLimitsTab } from './components/SetLimitsTab.js';
import { StatsTab } from './components/StatsTab.js';
import { AllLimitsTab } from './components/AllLimitsTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { Footer } from './components/Footer.js';
import { Message } from './components/Message.js';
import { useTheme } from './hooks/useTheme.js';
import { useMessage } from './hooks/useMessage.js';

export const App: FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('set-limits');
  const { toggleTheme } = useTheme();
  const { message, showMessage } = useMessage();

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="container">
      <Header
        settingsActive={activeTab === 'settings'}
        onSettingsClick={() => setActiveTab('settings')}
        showMessage={showMessage}
      />
      <TabNav activeTab={activeTab} onTabChange={handleTabChange} />
      <SetLimitsTab isActive={activeTab === 'set-limits'} showMessage={showMessage} />
      <StatsTab isActive={activeTab === 'stats'} showMessage={showMessage} />
      <AllLimitsTab isActive={activeTab === 'all-limits'} showMessage={showMessage} />
      <SettingsTab isActive={activeTab === 'settings'} onToggleTheme={toggleTheme} />
      <Message message={message} />
      <Footer />
    </div>
  );
};
