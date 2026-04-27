import { useState, useEffect, useCallback, type FC } from 'react';
import type { StatItem, StatsResponse } from '../../shared/types.js';
import {
  GlobeIcon,
  PersonIcon,
  ClockIcon,
  DownloadIcon,
  RefreshIcon,
  BarChartIcon,
} from '../icons.js';

const MAX_PROGRESS_SEGMENTS = 50;

const StatCard: FC<{ stat: StatItem }> = ({ stat }) => {
  const safeVisitCount = stat.visitLimit
    ? Math.min(stat.visitCount, stat.visitLimit)
    : stat.visitCount;
  const visitPercent = stat.visitLimit ? (safeVisitCount / stat.visitLimit) * 100 : 0;
  const visitColor = visitPercent >= 100 ? 'danger' : visitPercent > 66 ? 'warning' : 'success';

  const segments =
    stat.visitLimit && stat.visitLimit > 1 && stat.visitLimit <= MAX_PROGRESS_SEGMENTS
      ? Array.from({ length: stat.visitLimit - 1 }, (_, i) => i + 1)
      : [];

  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-icon">
          <GlobeIcon size={16} />
        </div>
        <div className="stat-hostname">{stat.hostname}</div>
      </div>

      {stat.visitLimit && (
        <>
          <div className="stat-row">
            <div className="stat-label">
              <PersonIcon size={14} />
              <span>Visits</span>
            </div>
            <div className="stat-value">
              {safeVisitCount}/{stat.visitLimit}
            </div>
          </div>
          <div className="progress-bar">
            <div className={`progress-fill ${visitColor}`} style={{ width: `${visitPercent}%` }} />
            {segments.map((i) => (
              <div
                key={i}
                className="progress-segment"
                style={{ left: `${(i / stat.visitLimit!) * 100}%` }}
              />
            ))}
          </div>
        </>
      )}

      {stat.timeLimit && (
        <div className="stat-row">
          <div className="stat-label">
            <ClockIcon size={14} />
            <span>Time limit</span>
          </div>
          <div className="stat-value">{stat.timeLimit} min</div>
        </div>
      )}
    </div>
  );
};

interface StatsTabProps {
  isActive: boolean;
  showMessage: (text: string, duration?: number, isError?: boolean) => void;
}

export const StatsTab: FC<StatsTabProps> = ({ isActive, showMessage }) => {
  const [stats, setStats] = useState<StatItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = (await chrome.runtime.sendMessage({ type: 'getStats' })) as StatsResponse;
      setStats(response?.stats ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchStats();
    }
  }, [isActive, fetchStats]);

  const handleRefresh = async () => {
    setSpinning(true);
    try {
      await fetchStats();
    } finally {
      setSpinning(false);
    }
  };

  const handleExport = () => {
    if (!stats?.length) return;
    const dataStr = JSON.stringify(stats, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `lilimit-stats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showMessage('Stats exported successfully!');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div id="stats" className={`tab-content${isActive ? ' active' : ''}`}>
      <div className="stats-container">
        <div className="stats-header">
          <h3 className="stats-title">Today&apos;s Activity</h3>
          <div className="stats-actions">
            <button
              id="exportStats"
              className="icon-btn"
              aria-label="Export stats"
              title="Export stats as JSON"
              onClick={handleExport}
            >
              <DownloadIcon size={16} />
            </button>
            <button
              id="refreshStats"
              className={`icon-btn${spinning ? ' spinning' : ''}`}
              aria-label="Refresh stats"
              onClick={handleRefresh}
            >
              <RefreshIcon size={16} />
            </button>
          </div>
        </div>

        <div id="statsContent" className="stats-content">
          {loading && <div className="loading">Loading stats...</div>}
          {error && <div className="error-state">Failed to load stats</div>}
          {!loading && !error && stats !== null && stats.length === 0 && (
            <div className="empty-state">
              <BarChartIcon size={48} />
              <p>No activity yet today</p>
            </div>
          )}
          {!loading && !error && stats?.map((stat) => <StatCard key={stat.hostname} stat={stat} />)}
        </div>
      </div>
    </div>
  );
};
