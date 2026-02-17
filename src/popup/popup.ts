import { extractHostname } from '../shared/utils.js';
import type {
  LimitItem,
  StatItem,
  StatsResponse,
  LimitsResponse,
  DeLimitResponse,
  SettingsResponse,
} from '../shared/types.js';

function initTabs(): void {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      if (!targetTab) return;

      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));
      document.getElementById('settingsBtn')?.classList.remove('active');

      button.classList.add('active');
      const targetElement = document.getElementById(targetTab);
      if (targetElement) {
        targetElement.classList.add('active');
      }

      if (targetTab === 'stats') {
        loadStats();
      } else if (targetTab === 'all-limits') {
        loadAllLimits();
      }
    });
  });
}

function limitTime(hostname: string, timeLimit: number | string): void {
  chrome.runtime.sendMessage({
    type: 'setTimeLimit',
    hostname: hostname,
    timeLimit: timeLimit,
  });
}

function limitVisit(hostname: string, visitLimit: number | string): void {
  chrome.runtime.sendMessage({
    type: 'setVisitLimit',
    hostname: hostname,
    visitLimit: visitLimit,
  });
}

const form = document.querySelector<HTMLFormElement>('form');
if (form) {
  form.addEventListener('submit', (event: Event) => {
    event.preventDefault();

    const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
    const timeLimitInput = document.getElementById('timeLimit') as HTMLInputElement;
    const visitLimitInput = document.getElementById('visitLimit') as HTMLInputElement;

    const hostname = extractHostname(hostnameInput.value);
    const timeLimit = timeLimitInput.value;
    const visitLimit = visitLimitInput.value;

    if (timeLimit && visitLimit) {
      showMessage(
        `This submit will limit the hostname ${hostname}:\n ${timeLimit} minutes \n ${visitLimit} visits`
      );
      limitTime(hostname, timeLimit);
      limitVisit(hostname, visitLimit);
    } else if (timeLimit) {
      showMessage(
        `This submit will limit the hostname ${hostname}:\n ${timeLimit} minutes \n No limit visits`
      );
      limitTime(hostname, timeLimit);
    } else if (visitLimit) {
      showMessage(
        `This submit will limit the hostname ${hostname}:\n No limit time \n ${visitLimit} visits`
      );
      limitVisit(hostname, visitLimit);
    } else {
      showMessage(`No limits applied on ${hostname}`);
    }

    hostnameInput.value = '';
    timeLimitInput.value = '';
    visitLimitInput.value = '';
  });
}

async function loadStats(): Promise<void> {
  const statsContent = document.getElementById('statsContent');
  if (!statsContent) return;

  statsContent.innerHTML = '<div class="loading">Loading stats...</div>';

  try {
    const response = (await chrome.runtime.sendMessage({ type: 'getStats' })) as StatsResponse;

    if (!response || !response.stats || response.stats.length === 0) {
      statsContent.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
          </svg>
          <p>No activity yet today</p>
        </div>
      `;
      return;
    }

    const MAX_PROGRESS_SEGMENTS = 50;
    let statsHTML = '';
    response.stats.forEach((stat: StatItem) => {
      const safeVisitCount = stat.visitLimit
        ? Math.min(stat.visitCount, stat.visitLimit)
        : stat.visitCount;
      const visitPercent = stat.visitLimit ? (safeVisitCount / stat.visitLimit) * 100 : 0;
      const visitColor = visitPercent >= 100 ? 'danger' : visitPercent > 66 ? 'warning' : 'success';

      let segmentsHTML = '';
      if (stat.visitLimit && stat.visitLimit > 1 && stat.visitLimit <= MAX_PROGRESS_SEGMENTS) {
        for (let i = 1; i < stat.visitLimit; i++) {
          const position = (i / stat.visitLimit) * 100;
          segmentsHTML += `<div class="progress-segment" style="left: ${position}%"></div>`;
        }
      }

      statsHTML += `
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
              </svg>
            </div>
            <div class="stat-hostname">${stat.hostname}</div>
          </div>
          ${
            stat.visitLimit
              ? `
          <div class="stat-row">
            <div class="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <span>Visits</span>
            </div>
            <div class="stat-value">${safeVisitCount}/${stat.visitLimit}</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${visitColor}" style="width: ${visitPercent}%"></div>
            ${segmentsHTML}
          </div>
          `
              : ''
          }
          ${
            stat.timeLimit
              ? `
          <div class="stat-row">
            <div class="stat-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span>Time limit</span>
            </div>
            <div class="stat-value">${stat.timeLimit} min</div>
          </div>
          `
              : ''
          }
        </div>
      `;
    });

    statsContent.innerHTML = statsHTML;
  } catch (error) {
    console.error('Error loading stats:', error);
    statsContent.innerHTML = '<div class="error-state">Failed to load stats</div>';
  }
}

async function loadSettings(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: 'getSettings' })) as SettingsResponse;
  const toggle = document.getElementById('countSwitchAsVisit') as HTMLInputElement;
  if (toggle && response?.settings) {
    toggle.checked = response.settings.countSwitchAsVisit;
  }
}

async function loadAllLimits(): Promise<void> {
  const limitsContent = document.getElementById('limitsContent');
  if (!limitsContent) return;

  limitsContent.innerHTML = '<div class="loading">Loading limits...</div>';

  try {
    const response = (await chrome.runtime.sendMessage({ type: 'getAllLimits' })) as LimitsResponse;

    if (!response || !response.limits || response.limits.length === 0) {
      limitsContent.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <p>No limits set yet</p>
        </div>
      `;
      return;
    }

    renderLimits(response.limits);
  } catch (error) {
    console.error('Error loading limits:', error);
    limitsContent.innerHTML = '<div class="error-state">Failed to load limits</div>';
  }
}

interface LimitsManager {
  setLimits: (limits: LimitItem[]) => void;
  getLimits: () => LimitItem[];
  removeLimitByHostname: (hostname: string) => void;
}

const createLimitsManager = (): LimitsManager => {
  let currentLimits: LimitItem[] = [];

  return {
    setLimits: (limits: LimitItem[]) => {
      currentLimits = limits;
    },
    getLimits: () => currentLimits,
    removeLimitByHostname: (hostname: string) => {
      currentLimits = currentLimits.filter((l) => l.hostname !== hostname);
    },
  };
};

const limitsManager = createLimitsManager();

function renderLimits(limits: LimitItem[], filterText: string = ''): void {
  const limitsContent = document.getElementById('limitsContent');
  if (!limitsContent) return;

  if (!filterText) {
    limitsManager.setLimits(limits);
  }

  const filtered = limits.filter((limit) =>
    limit.hostname.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    limitsContent.innerHTML = `
      <div class="empty-state">
        <p>${filterText ? 'No matching limits found' : 'No limits set yet'}</p>
      </div>
    `;
    return;
  }

  let limitsHTML = '';
  filtered.forEach((limit) => {
    limitsHTML += `
      <div class="limit-card" data-hostname="${limit.hostname}">
        <div class="limit-header">
          <div class="limit-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
            </svg>
          </div>
          <div class="limit-hostname">${limit.hostname}</div>
          <button class="delete-limit-btn icon-btn" data-hostname="${limit.hostname}" aria-label="Delete limit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
        <div class="limit-details">
          ${
            limit.timeLimit
              ? `
          <div class="limit-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>${limit.timeLimit} minutes per visit</span>
          </div>
          `
              : ''
          }
          ${
            limit.visitLimit
              ? `
          <div class="limit-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <span>${limit.visitLimit} visits per day</span>
          </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  });

  limitsContent.innerHTML = limitsHTML;

  document.querySelectorAll<HTMLButtonElement>('.delete-limit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e: Event) => {
      e.stopPropagation();
      const hostname = btn.getAttribute('data-hostname');
      if (!hostname) return;

      if (confirm(`Delete all limits for ${hostname}?`)) {
        const response = (await chrome.runtime.sendMessage({
          type: 'deLimit',
          hostname,
        })) as DeLimitResponse;
        if (response && response.success) {
          showMessage(`Limits removed for ${hostname}`);
          const target = e.target as HTMLElement;
          const limitCard = target.closest('.limit-card');
          if (limitCard) {
            limitCard.remove();
          }
          limitsManager.removeLimitByHostname(hostname);
        } else {
          showMessage(`Failed to remove limits for ${hostname}`, 5000, true);
        }
      }
    });
  });
}

const searchInput = document.getElementById('searchLimits') as HTMLInputElement;
if (searchInput) {
  searchInput.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;
    renderLimits(limitsManager.getLimits(), target.value);
  });
}

const refreshStatsBtn = document.getElementById('refreshStats');
if (refreshStatsBtn) {
  refreshStatsBtn.addEventListener('click', () => {
    const btn = refreshStatsBtn;
    btn.classList.add('spinning');
    loadStats().finally(() => {
      setTimeout(() => btn.classList.remove('spinning'), 500);
    });
  });
}

const DeleteLimitsBtn = document.getElementById('DeleteLimits');
if (DeleteLimitsBtn) {
  DeleteLimitsBtn.addEventListener('click', (event: Event) => {
    event.preventDefault();
    const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
    const hostname = extractHostname(hostnameInput.value);

    alert(`Deleted all the limits on the hostname :\n ${hostname}`);

    chrome.runtime.sendMessage({
      type: 'deLimit',
      hostname: hostname,
    });
  });
}

const useCurrentTabBtn = document.getElementById('useCurrentTab');
if (useCurrentTabBtn) {
  useCurrentTabBtn.addEventListener('click', async (event: Event) => {
    event.preventDefault();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const hostname = extractHostname(tab.url);
        const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
        if (hostnameInput) {
          hostnameInput.value = hostname;
        }
        showMessage(`Current tab URL loaded: ${hostname}`, 3000);
      } else {
        showMessage('Could not get current tab URL', 3000, true);
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      showMessage('Failed to get current tab URL', 3000, true);
    }
  });
}

let messageTimer: NodeJS.Timeout | undefined;

function showMessage(text: string, duration: number = 5000, isError: boolean = false): void {
  const el = document.getElementById('message');
  if (!el) {
    console.log(text);
    return;
  }
  el.hidden = false;
  el.textContent = text || '';
  el.style.color = isError ? 'var(--danger)' : '';

  if (messageTimer) {
    clearTimeout(messageTimer);
  }
  messageTimer = setTimeout(() => {
    el.hidden = true;
    el.textContent = '';
  }, duration);
}

const tips: string[] = [
  'Got feedback? Email us at LiLimit@protonmail.com',
  'You can leave time or visits empty to apply only one limit',
  'Enter either a full URL or just the hostname',
  'Visit limits reset every day at midnight',
  'Time limits apply per visit to the website',
  'Use the Live Stats tab to track your usage',
  'Search for websites in the All Limits tab',
  'Click the refresh icon to update your stats',
];

let currentTipIndex = Math.floor(Math.random() * tips.length);

function showCurrentTip(): void {
  const footerTip = document.querySelector<HTMLElement>('.footer-tip');
  if (!footerTip) return;

  footerTip.textContent = `Tip: ${tips[currentTipIndex]}`;
}

function showNextTip(): void {
  const footerTip = document.querySelector<HTMLElement>('.footer-tip');
  if (!footerTip) return;

  currentTipIndex = (currentTipIndex + 1) % tips.length;
  footerTip.textContent = `Tip: ${tips[currentTipIndex]}`;
}

function transitionTip(updateTipFn: () => void): void {
  const footerTip = document.querySelector<HTMLElement>('.footer-tip');
  if (!footerTip) return;

  footerTip.classList.add('fade-out');
  setTimeout(() => {
    updateTipFn();
    footerTip.classList.remove('fade-out');
  }, 300);
}

function startTipRotation(): void {
  showCurrentTip();

  setInterval(() => {
    transitionTip(showNextTip);
  }, 10000);
}

function initTheme(): void {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme(): void {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

function initExportStats(): void {
  const exportBtn = document.getElementById('exportStats');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', async () => {
    try {
      const response = (await chrome.runtime.sendMessage({ type: 'getStats' })) as StatsResponse;

      if (response && response.stats) {
        const dataStr = JSON.stringify(response.stats, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `lilimit-stats-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showMessage('Stats exported successfully!');
      }
    } catch (error) {
      console.error('Error exporting stats:', error);
      showMessage('Failed to export stats', 5000, true);
    }
  });
}

function initLogoEasterEgg(): void {
  const logo = document.querySelector<HTMLImageElement>('.logo');
  if (!logo) return;

  let clickCount = 0;
  let resetTimer: NodeJS.Timeout | undefined;

  logo.addEventListener('click', () => {
    clickCount++;

    if (resetTimer) {
      clearTimeout(resetTimer);
    }

    resetTimer = setTimeout(() => {
      clickCount = 0;
    }, 10000);

    if (clickCount === 3) {
      showMessage(
        '👋 Hey, glad you’re here! Got feedback? Drop us a line at LiLimit@protonmail.com',
        10000
      );
      clickCount = 0;
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initExportStats();
  initLogoEasterEgg();
  startTipRotation();

  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => btn.classList.remove('active'));
      document.querySelectorAll<HTMLElement>('.tab-content').forEach((c) => c.classList.remove('active'));
      settingsBtn.classList.add('active');
      const settingsPanel = document.getElementById('settings');
      if (settingsPanel) settingsPanel.classList.add('active');
      loadSettings();
    });
  }

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  const switchToggle = document.getElementById('countSwitchAsVisit') as HTMLInputElement;
  if (switchToggle) {
    switchToggle.addEventListener('change', () => {
      chrome.runtime.sendMessage({
        type: 'setSettings',
        settings: { countSwitchAsVisit: switchToggle.checked },
      });
    });
  }

  const nextTipBtn = document.getElementById('nextTipBtn');
  if (nextTipBtn) {
    nextTipBtn.addEventListener('click', () => transitionTip(showNextTip));
  }
});
