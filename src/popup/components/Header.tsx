import { useEffect, useRef, type FC } from 'react';
import { GearIcon } from '../icons.js';
import { launchConfetti } from '../utils/confetti.js';

interface HeaderProps {
  settingsActive: boolean;
  onSettingsClick: () => void;
  showMessage: (text: string, duration?: number, isError?: boolean) => void;
}

export const Header: FC<HeaderProps> = ({ settingsActive, onSettingsClick, showMessage }) => {
  const clickCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleLogoClick = () => {
    clickCountRef.current++;

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 10000);

    if (clickCountRef.current === 3) {
      launchConfetti();
      showMessage('👋 Hey, you caught my trick!', 10000);
      clickCountRef.current = 0;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    }
  };

  return (
    <header className="header">
      <img
        src="images/lily.png"
        alt="LiLimit logo"
        className="logo"
        onClick={handleLogoClick}
      />
      <h1 className="title">LiLimit</h1>
      <button
        id="settingsBtn"
        className={`theme-toggle${settingsActive ? ' active' : ''}`}
        aria-label="Settings"
        onClick={onSettingsClick}
      >
        <GearIcon />
      </button>
    </header>
  );
};
