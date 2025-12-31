import { extractHostname } from './utils.js';

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (targetTab === 'stats') {
        loadStats();
      } else if (targetTab === 'all-limits') {
        loadAllLimits();
      }
    });
  });
}

function limitTime(hostname, timeLimit) {
  chrome.runtime.sendMessage({
    type: 'setTimeLimit',
    hostname: hostname,
    timeLimit: timeLimit,
  });
}

function limitVisit(hostname, visitLimit) {
  chrome.runtime.sendMessage({
    type: 'setVisitLimit',
    hostname: hostname,
    visitLimit: visitLimit,
  });
}

const form = document.querySelector('form');
form.addEventListener('submit', (event) => {
  event.preventDefault();

  const hostname = extractHostname(document.getElementById('hostname').value);
  const timeLimit = document.getElementById('timeLimit').value;
  const visitLimit = document.getElementById('visitLimit').value;

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
});

async function loadStats() {
  const statsContent = document.getElementById('statsContent');
  statsContent.innerHTML = '<div class="loading">Loading stats...</div>';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'getStats' });

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

    let statsHTML = '';
    response.stats.forEach((stat) => {
      const visitPercent = stat.visitLimit ? (stat.visitCount / stat.visitLimit) * 100 : 0;
      const visitColor = visitPercent > 80 ? 'danger' : visitPercent > 50 ? 'warning' : 'success';

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
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Visits today</span>
            </div>
            <div class="stat-value">${stat.visitCount} / ${stat.visitLimit}</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${visitColor}" style="width: ${Math.min(visitPercent, 100)}%"></div>
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

async function loadAllLimits() {
  const limitsContent = document.getElementById('limitsContent');
  limitsContent.innerHTML = '<div class="loading">Loading limits...</div>';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'getAllLimits' });

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

const createLimitsManager = () => {
  let currentLimits = [];

  return {
    setLimits: (limits) => {
      currentLimits = limits;
    },
    getLimits: () => currentLimits,
    removeLimitByHostname: (hostname) => {
      currentLimits = currentLimits.filter((l) => l.hostname !== hostname);
    },
  };
};

const limitsManager = createLimitsManager();

function renderLimits(limits, filterText = '') {
  const limitsContent = document.getElementById('limitsContent');

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

  document.querySelectorAll('.delete-limit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const hostname = btn.getAttribute('data-hostname');
      if (confirm(`Delete all limits for ${hostname}?`)) {
        const response = await chrome.runtime.sendMessage({ type: 'deLimit', hostname });
        if (response && response.success) {
          showMessage(`Limits removed for ${hostname}`);
          e.target.closest('.limit-card').remove();
          limitsManager.removeLimitByHostname(hostname);
        } else {
          showMessage(`Failed to remove limits for ${hostname}`, 5000, true);
        }
      }
    });
  });
}

const searchInput = document.getElementById('searchLimits');

searchInput.addEventListener('input', (e) => {
  renderLimits(limitsManager.getLimits(), e.target.value);
});

document.getElementById('refreshStats').addEventListener('click', () => {
  const btn = document.getElementById('refreshStats');
  btn.classList.add('spinning');
  loadStats().finally(() => {
    setTimeout(() => btn.classList.remove('spinning'), 500);
  });
});

const DeleteLimitsBtn = document.getElementById('DeleteLimits');
DeleteLimitsBtn.addEventListener('click', (event) => {
  event.preventDefault();
  const hostname = extractHostname(document.getElementById('hostname').value);

  alert(`Deleted all the limits on the hostname :\n ${hostname}`);

  chrome.runtime.sendMessage({
    type: 'deLimit',
    hostname: hostname,
  });
});

function showMessage(text, duration = 5000, isError = false) {
  const el = document.getElementById('message');
  if (!el) {
    console.log(text);
    return;
  }
  el.hidden = false;
  el.textContent = text || '';
  el.style.color = isError ? 'var(--danger)' : '';

  clearTimeout(showMessage._timer);
  showMessage._timer = setTimeout(() => {
    el.hidden = true;
    el.textContent = '';
  }, duration);
}

const tips = [
  'You can leave time or visits empty to apply only one limit',
  'Enter either a full URL or just the hostname',
  'Visit limits reset every day at midnight',
  'Time limits apply per visit to the website',
  'Use the Live Stats tab to track your usage',
  'Search for websites in the All Limits tab',
  'Click the refresh icon to update your stats',
];

function showRandomTip() {
  const footer = document.querySelector('.footer');
  if (!footer) return;

  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  footer.textContent = `Tip: ${randomTip}`;
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  showRandomTip();
});
