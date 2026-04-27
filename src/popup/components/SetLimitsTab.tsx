import { useState, type FC } from 'react';
import type { DeLimitResponse } from '../../shared/types.js';
import { extractHostname } from '../../shared/utils.js';
import { GlobeIcon } from '../icons.js';

interface SetLimitsTabProps {
  isActive: boolean;
  showMessage: (text: string, duration?: number, isError?: boolean) => void;
}

export const SetLimitsTab: FC<SetLimitsTabProps> = ({ isActive, showMessage }) => {
  const [hostname, setHostname] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [visitLimit, setVisitLimit] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const host = extractHostname(hostname);

    if (!timeLimit && !visitLimit) {
      showMessage(`No limits applied on ${host}`);
      return;
    }

    const timePart = timeLimit ? `${timeLimit} minutes` : 'No limit time';
    const visitPart = visitLimit ? `${visitLimit} visits` : 'No limit visits';

    try {
      if (timeLimit) {
        await chrome.runtime.sendMessage({ type: 'setTimeLimit', hostname: host, timeLimit });
      }
      if (visitLimit) {
        await chrome.runtime.sendMessage({ type: 'setVisitLimit', hostname: host, visitLimit });
      }
      showMessage(`This submit will limit the hostname ${host}:\n ${timePart} \n ${visitPart}`);
    } catch {
      showMessage('Failed to set limits', 5000, true);
      return;
    }

    setHostname('');
    setTimeLimit('');
    setVisitLimit('');
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    const host = extractHostname(hostname);
    if (!confirm(`Delete all limits for ${host}?`)) return;
    const response = (await chrome.runtime.sendMessage({
      type: 'deLimit',
      hostname: host,
    })) as DeLimitResponse;
    if (response?.success) {
      showMessage(`Limits removed for ${host}`);
    } else {
      showMessage(`Failed to remove limits for ${host}`, 5000, true);
    }
  };

  const handleCurrentTab = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const host = extractHostname(tab.url);
        setHostname(host);
        showMessage(`Current tab URL loaded: ${host}`, 3000);
      } else {
        showMessage('Could not get current tab URL', 3000, true);
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      showMessage('Failed to get current tab URL', 3000, true);
    }
  };

  return (
    <div id="set-limits" className={`tab-content${isActive ? ' active' : ''}`}>
      <form id="limitsForm" className="form" autoComplete="off" onSubmit={handleSubmit}>
        <div className="form-header">
          <label htmlFor="hostname" className="label">
            Website (URL or hostname)
          </label>
          <button
            type="button"
            id="useCurrentTab"
            className="current-tab-btn"
            title="Use current tab URL"
            onClick={handleCurrentTab}
          >
            <GlobeIcon size={14} />
            <span>Current Tab</span>
          </button>
        </div>

        <input
          type="text"
          id="hostname"
          name="hostname"
          className="input"
          placeholder="e.g. https://www.example.com or example.com"
          aria-label="Website URL or hostname"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
        />

        <div className="two-col">
          <div>
            <label htmlFor="timeLimit" className="label">
              Time limit (minutes)
            </label>
            <input
              type="number"
              id="timeLimit"
              name="timeLimit"
              className="input"
              min="1"
              placeholder="No time limit yet"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="visitLimit" className="label">
              Visit limit (per day)
            </label>
            <input
              type="number"
              id="visitLimit"
              name="visitLimit"
              className="input"
              min="1"
              placeholder="No visit limit yet"
              value={visitLimit}
              onChange={(e) => setVisitLimit(e.target.value)}
            />
          </div>
        </div>

        <div className="buttons">
          <button type="submit" id="submitButton" className="btn primary">
            Set limit
          </button>
          <button type="button" id="DeleteLimits" className="btn danger" onClick={handleDelete}>
            Delete limit
          </button>
        </div>
      </form>
    </div>
  );
};
