import type { FC } from 'react';
import { useTips } from '../hooks/useTips.js';
import { ChevronRightIcon } from '../icons.js';

export const Footer: FC = () => {
  const { tip, fading, advanceTip } = useTips();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className={`footer-tip${fading ? ' fade-out' : ''}`}>
          {tip.isFeature ? <strong>New Feature: {tip.text}</strong> : `Tip: ${tip.text}`}
        </div>
        <button
          id="nextTipBtn"
          className="next-tip-btn"
          aria-label="Next tip"
          title="Next tip"
          onClick={advanceTip}
        >
          <ChevronRightIcon size={12} />
        </button>
      </div>
    </footer>
  );
};
