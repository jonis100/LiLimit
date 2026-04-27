import { useState, useEffect, useCallback, type FC } from 'react';
import type { LimitItem, LimitsResponse, DeLimitResponse } from '../../shared/types.js';
import { GlobeIcon, ClockIcon, PersonIcon, TrashIcon } from '../icons.js';

interface LimitCardProps {
  limit: LimitItem;
  onDelete: (hostname: string) => void;
  showMessage: (text: string, duration?: number, isError?: boolean) => void;
}

const LimitCard: FC<LimitCardProps> = ({ limit, onDelete, showMessage }) => {
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete all limits for ${limit.hostname}?`)) return;

    const response = (await chrome.runtime.sendMessage({
      type: 'deLimit',
      hostname: limit.hostname,
    })) as DeLimitResponse;

    if (response?.success) {
      showMessage(`Limits removed for ${limit.hostname}`);
      onDelete(limit.hostname);
    } else {
      showMessage(`Failed to remove limits for ${limit.hostname}`, 5000, true);
    }
  };

  return (
    <div className="limit-card" data-hostname={limit.hostname}>
      <div className="limit-header">
        <div className="limit-icon">
          <GlobeIcon size={16} />
        </div>
        <div className="limit-hostname">{limit.hostname}</div>
        <button
          className="delete-limit-btn icon-btn"
          data-hostname={limit.hostname}
          aria-label="Delete limit"
          onClick={handleDelete}
        >
          <TrashIcon size={16} />
        </button>
      </div>
      <div className="limit-details">
        {limit.timeLimit && (
          <div className="limit-detail">
            <ClockIcon size={14} />
            <span>{limit.timeLimit} minutes per visit</span>
          </div>
        )}
        {limit.visitLimit && (
          <div className="limit-detail">
            <PersonIcon size={14} />
            <span>{limit.visitLimit} visits per day</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface AllLimitsTabProps {
  isActive: boolean;
  showMessage: (text: string, duration?: number, isError?: boolean) => void;
}

export const AllLimitsTab: FC<AllLimitsTabProps> = ({ isActive, showMessage }) => {
  const [limits, setLimits] = useState<LimitItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchLimits = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'getAllLimits',
      })) as LimitsResponse;
      setLimits(response?.limits ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) fetchLimits();
  }, [isActive, fetchLimits]);

  const filtered = limits.filter((l) =>
    l.hostname.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleDelete = (hostname: string) => {
    setLimits((prev) => prev.filter((l) => l.hostname !== hostname));
  };

  const emptyMessage =
    !loading && !error && filtered.length === 0
      ? limits.length === 0 && !filterText
        ? 'No limits set yet'
        : 'No matching limits found'
      : null;

  return (
    <div id="all-limits" className={`tab-content${isActive ? ' active' : ''}`}>
      <div className="limits-container">
        <div className="limits-header">
          <input
            type="text"
            id="searchLimits"
            className="search-input"
            placeholder="Search websites..."
            aria-label="Search limits"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <div id="limitsContent" className="limits-content">
          {loading && <div className="loading">Loading limits...</div>}
          {error && <div className="error-state">Failed to load limits</div>}
          {emptyMessage && (
            <div className="empty-state">
              {limits.length === 0 && !filterText && <ClockIcon size={48} strokeWidth={1.5} />}
              <p>{emptyMessage}</p>
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((limit) => (
              <LimitCard
                key={limit.hostname}
                limit={limit}
                onDelete={handleDelete}
                showMessage={showMessage}
              />
            ))}
        </div>
      </div>
    </div>
  );
};
