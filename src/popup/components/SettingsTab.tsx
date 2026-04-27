import { useState, useEffect, type FC, type ReactNode } from 'react';
import type { SettingsResponse } from '../../shared/types.js';
import { SunIcon, MoonIcon, InfoIcon } from '../icons.js';

interface SettingsTabProps {
  isActive: boolean;
  onToggleTheme: () => void;
}

interface SettingRowProps {
  ariaLabel: string;
  label: string;
  desc: ReactNode;
  control: ReactNode;
  onClick: () => void;
}

const SettingRow: FC<SettingRowProps> = ({ ariaLabel, label, desc, control, onClick }) => (
  <button
    type="button"
    className="setting-row setting-row-clickable"
    aria-label={ariaLabel}
    onClick={onClick}
  >
    <div className="setting-info">
      <span className="setting-label">{label}</span>
      <span className="setting-desc">{desc}</span>
    </div>
    {control}
  </button>
);

export const SettingsTab: FC<SettingsTabProps> = ({ isActive, onToggleTheme }) => {
  const [dailyTimeLimit, setDailyTimeLimit] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    chrome.runtime.sendMessage({ type: 'getSettings' })
      .then((response: unknown) => {
        const r = response as SettingsResponse;
        if (r?.settings) setDailyTimeLimit(r.settings.dailyTimeLimit);
      })
      .catch(() => {});
  }, [isActive]);

  const toggleDailyTimeLimit = () => {
    const next = !dailyTimeLimit;
    setDailyTimeLimit(next);
    chrome.runtime.sendMessage({ type: 'setSettings', settings: { dailyTimeLimit: next } });
  };

  return (
    <div id="settings" className={`tab-content${isActive ? ' active' : ''}`}>
      <div className="settings-container">
        <h3 className="settings-title">Settings</h3>

        <SettingRow
          ariaLabel="Toggle theme"
          label="Dark mode"
          desc="Toggle between dark and light theme"
          onClick={onToggleTheme}
          control={
            <div className="theme-icons">
              <SunIcon size={18} className="sun-icon" />
              <MoonIcon size={18} className="moon-icon" />
            </div>
          }
        />

        <SettingRow
          ariaLabel="Toggle daily time limit"
          label="Count Time Across Visits"
          desc={
            <>
              Controls how time is counted for this site.{' '}
              <span className="info-icon" tabIndex={0} aria-describedby="daily-limit-tooltip">
                <InfoIcon size={11} strokeWidth={2.5} />
                <span className="tooltip" id="daily-limit-tooltip">
                  On: time limit adds up across all visits today. Off: time limit resets on each new
                  visit.
                </span>
              </span>
            </>
          }
          onClick={toggleDailyTimeLimit}
          control={
            <label className="toggle" aria-hidden="true" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                id="dailyTimeLimit"
                tabIndex={-1}
                checked={dailyTimeLimit}
                onChange={toggleDailyTimeLimit}
              />
              <span className="toggle-slider"></span>
            </label>
          }
        />
      </div>
    </div>
  );
};
