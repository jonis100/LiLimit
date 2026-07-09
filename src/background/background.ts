import { extractHostname, limits_to_string } from '../shared/utils.js';

interface VisitCounts {
  [hostname: string]: number;
}

interface Limits {
  [hostname: string]: number;
}

interface Timers {
  [tabId: string]: NodeJS.Timeout;
}

interface LastHandle {
  [tabId: string]: string;
}

interface TimerStartTime {
  hostname: string;
  startTime: number;
}

interface TimerStartTimes {
  [tabId: string]: TimerStartTime;
}

interface Settings {
  dailyTimeLimit: boolean;
}

const DEFAULT_SETTINGS: Settings = { dailyTimeLimit: false };

interface DailyTimeSpent {
  [hostname: string]: number;
}

interface StorageData {
  timeLimits?: Limits;
  visitLimits?: Limits;
  visitCounts?: VisitCounts;
  timerStartTimes?: TimerStartTimes;
  dailyTimeSpent?: DailyTimeSpent;
  settings?: Settings;
}

interface MessageRequest {
  type: string;
  hostname?: string;
  visitLimit?: number;
  timeLimit?: number;
  settings?: Partial<Settings>;
}

interface StatItem {
  hostname: string;
  timeLimit?: number;
  visitLimit?: number;
  visitCount: number;
}

interface LimitItem {
  hostname: string;
  timeLimit?: number;
  visitLimit?: number;
}

interface TimeLeftItem {
  hostname: string;
  timeLimit: number;
  remainingMs: number;
  spentMs: number;
  isActive: boolean;
}

const visitCounts: VisitCounts = {};
const timeLimits: Limits = {};
const visitLimits: Limits = {};
const timers: Timers = {};
const lastHandle: LastHandle = {};
const timerStartTimes: TimerStartTimes = {};
const dailyTimeSpent: DailyTimeSpent = {};
const settings: Settings = { ...DEFAULT_SETTINGS };

const DAILY_RESET_ALARM = 'dailyResetAlarm';
const MS_IN_MINUTE = 60000;

let currentActiveTabId: number | null = null;
const removedTabIds = new Set<number>();

let isRestored: boolean = false;
let restorePromise: Promise<void> | null = null;

let isInitialized: boolean = false;
let initializationPromise: Promise<void> | null = null;

async function initializeFromStorage(): Promise<void> {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes', 'dailyTimeSpent', 'settings'],
      (result: StorageData) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading data from storage:', chrome.runtime.lastError);
          isInitialized = false;
          initializationPromise = null;
          reject(chrome.runtime.lastError);
          return;
        }

        try {
          if (result && result.timeLimits) Object.assign(timeLimits, result.timeLimits);
          if (result && result.visitLimits) Object.assign(visitLimits, result.visitLimits);
          if (result && result.visitCounts) Object.assign(visitCounts, result.visitCounts);
          if (result && result.timerStartTimes)
            Object.assign(timerStartTimes, result.timerStartTimes);
          if (result && result.dailyTimeSpent) Object.assign(dailyTimeSpent, result.dailyTimeSpent);
          if (result && result.settings) Object.assign(settings, result.settings);
          console.log('Loaded persisted data from storage:', {
            timeLimits,
            visitLimits,
            visitCounts,
            timerStartTimes,
          });
          isInitialized = true;
          resolve();
        } catch (e) {
          console.error('Error parsing data from storage:', e);
          isInitialized = false;
          initializationPromise = null;
          reject(e);
        }
      }
    );
  });

  return initializationPromise;
}

function redirectTabToTimeExceeded(tabID: string | number): void {
  chrome.tabs
    .update(Number(tabID), {
      url: chrome.runtime.getURL('pages/time-exceeded.html'),
    })
    .catch(() => {
      console.log(`Tab ${tabID} no longer exists, cleaned up timer data`);
      delete timeLimits[tabID];
      delete timerStartTimes[tabID];
      updateStorage();
    });
}

function setTimerForTab(
  tabID: string | number,
  hostname: string,
  remainingMinutes: number,
  startTime: number = Date.now()
): NodeJS.Timeout {
  timerStartTimes[tabID] = {
    hostname: hostname,
    startTime: startTime,
  };

  const timer = setTimeout(() => {
    if (settings.dailyTimeLimit && timeLimits[hostname] !== undefined) {
      dailyTimeSpent[hostname] = timeLimits[hostname] * MS_IN_MINUTE;
    }
    delete timers[tabID];
    delete timerStartTimes[tabID];
    updateStorage();
    redirectTabToTimeExceeded(tabID);
  }, remainingMinutes * MS_IN_MINUTE);
  timers[tabID] = timer;
  updateStorage();
  return timer;
}

function calculateRemainingTime(startTime: number, timeLimit: number): number {
  const now = Date.now();
  const elapsed = (now - startTime) / MS_IN_MINUTE;
  return timeLimit - elapsed;
}

function resumeOrExpireTimer(
  tabID: string | number,
  hostname: string,
  timeLimit: number,
  existingStartTime: number
): { resumed: boolean; remaining: number } {
  const remaining = calculateRemainingTime(existingStartTime, timeLimit);

  if (remaining > 0) {
    setTimerForTab(tabID, hostname, remaining, existingStartTime);
    return { resumed: true, remaining };
  } else {
    delete timerStartTimes[tabID];
    delete timers[tabID];
    updateStorage();
    redirectTabToTimeExceeded(tabID);
    return { resumed: false, remaining };
  }
}

function pauseTimerForTab(tabID: string | number): void {
  if (!timerStartTimes[tabID]) return;
  const { hostname, startTime } = timerStartTimes[tabID];
  if (settings.dailyTimeLimit) {
    const elapsed = Date.now() - startTime;
    dailyTimeSpent[hostname] = (dailyTimeSpent[hostname] || 0) + elapsed;
    console.log(`Paused timer for ${hostname} on tab ${tabID}, accumulated ${elapsed}ms`);
  }
  clearTimeout(timers[tabID]);
  delete timers[tabID];
  delete timerStartTimes[tabID];
  updateStorage();
}

async function restoreTimers(): Promise<void> {
  if (isRestored) return;
  if (restorePromise) return restorePromise;

  restorePromise = (async () => {
    await initializeFromStorage();

    // Determine the currently active tab so we only resume timers that
    // should actually be running. Stored segments for non-active tabs are
    // stale — the tab was likely not being viewed when the service worker
    // was killed. Dropping them without folding elapsed avoids the rogue
    // full-budget over-count that previously reset users' daily time.
    let activeTabId: number | null = null;
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (activeTab && activeTab.id) {
        activeTabId = activeTab.id;
      }
    } catch (error) {
      console.log('Could not query active tab during restore:', error);
    }
    currentActiveTabId = activeTabId;

    for (const tabID in timerStartTimes) {
      const numericTabId = Number(tabID);
      const timerData = timerStartTimes[tabID];
      const hostname = timerData.hostname;
      const startTime = timerData.startTime;
      const timeLimit = timeLimits[hostname];
      lastHandle[tabID] = hostname;

      if (removedTabIds.has(numericTabId)) {
        pauseTimerForTab(tabID);
        delete lastHandle[tabID];
        continue;
      }

      if (timeLimit === undefined) {
        delete timerStartTimes[tabID];
        clearTimeout(timers[tabID]);
        delete timers[tabID];
        continue;
      }

      // Only resume for the currently active tab; drop all others.
      if (numericTabId !== activeTabId) {
        delete timerStartTimes[tabID];
        clearTimeout(timers[tabID]);
        delete timers[tabID];
        continue;
      }

      if (settings.dailyTimeLimit) {
        // Fold the elapsed segment for the active tab (it was being viewed).
        const elapsed = Date.now() - startTime;
        dailyTimeSpent[hostname] = (dailyTimeSpent[hostname] || 0) + elapsed;
        delete timerStartTimes[tabID];

        const remainingMs = timeLimit * MS_IN_MINUTE - dailyTimeSpent[hostname];
        if (remainingMs > 0) {
          setTimerForTab(tabID, hostname, remainingMs / MS_IN_MINUTE);
          console.log(
            `Restored daily timer for ${hostname} on tabId: ${tabID}, ${(remainingMs / MS_IN_MINUTE).toFixed(2)} minutes remaining`
          );
        } else {
          redirectTabToTimeExceeded(tabID);
        }
      } else {
        const result = resumeOrExpireTimer(tabID, hostname, timeLimit, startTime);
        if (result.resumed) {
          console.log(
            `Restored timer for ${hostname} on tabId: ${tabID}, ${result.remaining.toFixed(2)} minutes remaining`
          );
        }
      }
    }
    updateStorage();
    isRestored = true;
  })();

  try {
    await restorePromise;
  } catch (error) {
    restorePromise = null;
    throw error;
  }
}

function handleHostname(hostname: string, tabID: number): void {
  console.log('Handling: ', hostname);

  if (visitLimits[hostname] && lastHandle[tabID] != hostname) {
    visitCounts[hostname] = (visitCounts[hostname] || 0) + 1;
    console.log(
      `Visit count for ${hostname} is now ${visitCounts[hostname]} (limit: ${visitLimits[hostname]})`
    );
    updateStorage();

    if (visitCounts[hostname] > visitLimits[hostname]) {
      console.log(`Visit limit exceeded for ${hostname} on tabId: ${tabID}`);
      chrome.tabs.update(tabID, {
        url: chrome.runtime.getURL('pages/visits-exceeded.html'),
      });
      return;
    }
  }

  if (timeLimits[hostname]) {
    if (settings.dailyTimeLimit) {
      // All-day mode: only start timer when this tab is not already tracking this hostname.
      if (!timerStartTimes[tabID] || timerStartTimes[tabID].hostname !== hostname) {
        const spentMs = dailyTimeSpent[hostname] || 0;
        const remainingMs = timeLimits[hostname] * MS_IN_MINUTE - spentMs;
        if (remainingMs <= 0) {
          console.log(`Daily time limit exceeded for ${hostname} on tabId: ${tabID}`);
          redirectTabToTimeExceeded(tabID);
          return;
        }
        setTimerForTab(tabID, hostname, remainingMs / MS_IN_MINUTE);
        console.log(
          `Daily timer set for ${hostname} on tabId: ${tabID}, ${(remainingMs / MS_IN_MINUTE).toFixed(2)} minutes remaining`
        );
      }
    } else if (lastHandle[tabID] !== hostname) {
      // Per-visit mode: fresh timer on each new visit
      setTimerForTab(tabID, hostname, timeLimits[hostname]);
      console.log(
        `New timer set for ${hostname} on tabId: ${tabID} for ${timeLimits[hostname]} minutes`
      );
    }
  }
  if (timeLimits[hostname] || visitLimits[hostname]) {
    lastHandle[tabID] = hostname;
    console.log(`Set lastHandle for tabId: ${tabID} to ${hostname}`);
  } else {
    console.log(`No limits for ${hostname}, so not set as lastHandle. \n
       clearing lastHandle for tabId: ${tabID}`);
    delete lastHandle[tabID];
  }
}

async function applyLimitToOpenTabs(hostname: string): Promise<void> {
  console.log(`Applying limits to currently open tabs for ${hostname}`);

  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue;

      try {
        const tabHostname = extractHostname(tab.url);
        if (tabHostname === hostname && lastHandle[tab.id] !== hostname) {
          console.log(`Found open tab for ${hostname}, applying limits to tab ${tab.id}`);
          handleHostname(hostname, tab.id);
        }
      } catch (error) {
        console.log(`Error processing tab ${tab.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error querying tabs:', error);
  }
}

function getAllLimitedHostnames(): Set<string> {
  return new Set([...Object.keys(timeLimits), ...Object.keys(visitLimits)]);
}

function computeTimeLeft(): TimeLeftItem[] {
  const items: TimeLeftItem[] = [];
  const now = Date.now();

  for (const hostname of Object.keys(timeLimits)) {
    const timeLimit = timeLimits[hostname];
    if (timeLimit === undefined) continue;

    const budgetMs = timeLimit * MS_IN_MINUTE;

    // Elapsed time on any tab currently running a timer for this hostname.
    // The running segment is not yet folded into dailyTimeSpent, so add it live.
    let liveElapsedMs = 0;
    let isActive = false;
    for (const tabID in timerStartTimes) {
      if (timerStartTimes[tabID].hostname === hostname) {
        isActive = true;
        liveElapsedMs = Math.max(liveElapsedMs, now - timerStartTimes[tabID].startTime);
      }
    }

    let spentMs: number;
    if (settings.dailyTimeLimit) {
      // Daily budget accumulates across visits; add the live running segment.
      spentMs = (dailyTimeSpent[hostname] || 0) + liveElapsedMs;
    } else {
      // Per-visit mode: budget is per session, so only the current session counts.
      spentMs = liveElapsedMs;
    }

    const remainingMs = Math.max(0, budgetMs - spentMs);

    items.push({
      hostname,
      timeLimit,
      remainingMs,
      spentMs: Math.min(spentMs, budgetMs),
      isActive,
    });
  }

  return items;
}

function updateStorage(): void {
  try {
    chrome.storage.local.set(
      {
        settings: settings,
        timeLimits: timeLimits,
        visitLimits: visitLimits,
        visitCounts: visitCounts,
        timerStartTimes: timerStartTimes,
        dailyTimeSpent: dailyTimeSpent,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data to storage:', chrome.runtime.lastError);
        } else {
          console.log('Saved data to storage:', {
            settings,
            timeLimits,
            visitLimits,
            visitCounts,
            timerStartTimes,
            dailyTimeSpent,
          });
        }
      }
    );
  } catch (e) {
    console.error('updateStorage failed', e);
  }
}

chrome.tabs.onUpdated.addListener(
  async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, _tab: chrome.tabs.Tab) => {
    try {
      if (!changeInfo.url) return;

      await restoreTimers();

      const hostname = extractHostname(changeInfo.url);
      console.log(`Tab with id: ${tabId} was updated. New url: ${changeInfo.url}`);

      if (timerStartTimes[tabId] && lastHandle[tabId] && lastHandle[tabId] !== hostname) {
        pauseTimerForTab(tabId);
        console.log(
          `Cleared timer on tabId: ${tabId}, hostname changed from ${lastHandle[tabId]} to ${hostname}`
        );
      }

      handleHostname(hostname, tabId);
    } catch (error) {
      console.log(`Can't handle in onUpdated: ${error} for ${changeInfo.url}`);
    }
  }
);

chrome.tabs.onActivated.addListener(async (activeInfo: chrome.tabs.TabActiveInfo) => {
  try {
    await restoreTimers();

    // Daily mode: pause the timer on the tab we're switching away from
    if (
      settings.dailyTimeLimit &&
      currentActiveTabId !== null &&
      currentActiveTabId !== activeInfo.tabId
    ) {
      pauseTimerForTab(currentActiveTabId);
    }

    currentActiveTabId = activeInfo.tabId;

    chrome.tabs.get(activeInfo.tabId, (tab: chrome.tabs.Tab) => {
      if (tab && typeof tab.pendingUrl == 'undefined' && tab.url && tab.id) {
        const hostname = extractHostname(tab.url);
        console.log('tab switched hostname extractHostname: ', hostname, 'call handleHostname..');
        handleHostname(hostname, tab.id);
      } else {
        console.log('new tab from onActivated');
      }
    });
  } catch (error) {
    console.log("Can't handle in onActivated:", error);
  }
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
  removedTabIds.add(tabId);
  void (async () => {
    try {
      await initializeFromStorage();
      pauseTimerForTab(tabId);
      delete lastHandle[tabId];
      if (currentActiveTabId === tabId) {
        currentActiveTabId = null;
      }
    } catch (error) {
      console.log("Can't handle in onRemoved:", error);
    } finally {
      removedTabIds.delete(tabId);
    }
  })();
});

chrome.windows.onFocusChanged.addListener(async (windowId: number) => {
  try {
    await restoreTimers();

    // Per-visit mode tracks time while the tab is open regardless of focus.
    if (!settings.dailyTimeLimit) return;

    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Chrome lost focus — pause the active tab's timer.
      if (currentActiveTabId !== null) {
        pauseTimerForTab(currentActiveTabId);
      }
    } else {
      // Chrome regained focus — track the active tab of the newly focused
      // window (which may differ from currentActiveTabId when switching
      // between windows). Pause the previously active tab first.
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, windowId });
        if (activeTab && activeTab.id && activeTab.url) {
          if (currentActiveTabId !== null && currentActiveTabId !== activeTab.id) {
            pauseTimerForTab(currentActiveTabId);
          }
          currentActiveTabId = activeTab.id;
          const hostname = extractHostname(activeTab.url);
          handleHostname(hostname, activeTab.id);
        }
      } catch (err) {
        console.log('Error updating active tab on focus regain:', err);
      }
    }
  } catch (error) {
    console.log("Can't handle onFocusChanged:", error);
  }
});

chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: Record<string, unknown>) => void
  ) => {
    (async () => {
      try {
        await restoreTimers();
        let hostnameToApply: string | null = null;

        switch (request.type) {
          case 'setVisitLimit': {
            if (!request.hostname) break;
            const hostname = extractHostname(request.hostname);
            const v = Number(request.visitLimit);
            if (Number.isFinite(v) && v > 0) {
              visitLimits[hostname] = v;
              updateStorage();
              hostnameToApply = hostname;
            }
            break;
          }

          case 'setTimeLimit': {
            if (!request.hostname) break;
            const hostname = extractHostname(request.hostname);
            const t = Number(request.timeLimit);
            if (Number.isFinite(t) && t > 0) {
              timeLimits[hostname] = t;
              updateStorage();
              hostnameToApply = hostname;
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false });
            }
            break;
          }

          case 'deLimit': {
            if (!request.hostname) break;
            const hostname = extractHostname(request.hostname);
            delete visitLimits[hostname];
            delete timeLimits[hostname];
            delete visitCounts[hostname];
            for (const tabID in timerStartTimes) {
              if (timerStartTimes[tabID].hostname === hostname) {
                clearTimeout(timers[tabID]);
                delete timers[tabID];
                delete timerStartTimes[tabID];
              }
            }
            updateStorage();
            sendResponse({ success: true });
            break;
          }

          case 'showLimits': {
            console.log(' from background ShowLimits clicked');
            const timeLimitsSet = new Set(Object.keys(timeLimits));
            const visitLimitsSet = new Set(Object.keys(visitLimits));
            const allLimitsUnion = new Set([...timeLimitsSet, ...visitLimitsSet]);
            const limitation_respond =
              allLimitsUnion.size > 0
                ? limits_to_string(Array.from(allLimitsUnion), timeLimits, visitLimits)
                : 'No Limits Yet';
            sendResponse({ limits: limitation_respond });
            break;
          }

          case 'getStats': {
            console.log('getStats called');
            const stats: StatItem[] = [];
            const allLimitsUnion = getAllLimitedHostnames();

            allLimitsUnion.forEach((hostname: string) => {
              const stat: StatItem = {
                hostname: hostname,
                timeLimit: timeLimits[hostname],
                visitLimit: visitLimits[hostname],
                visitCount: visitCounts[hostname] || 0,
              };
              stats.push(stat);
            });

            sendResponse({ stats });
            break;
          }

          case 'getSettings': {
            sendResponse({ settings });
            break;
          }

          case 'setSettings': {
            if (request.settings) {
              Object.assign(settings, request.settings);
              updateStorage();
            }
            sendResponse({ success: true });
            break;
          }

          case 'getAllLimits': {
            console.log('getAllLimits called');
            const limits: LimitItem[] = [];
            const allLimitsUnion = getAllLimitedHostnames();

            allLimitsUnion.forEach((hostname: string) => {
              const limit: LimitItem = {
                hostname: hostname,
                timeLimit: timeLimits[hostname],
                visitLimit: visitLimits[hostname],
              };
              limits.push(limit);
            });

            sendResponse({ limits });
            break;
          }

          case 'getTimeLeft': {
            console.log('getTimeLeft called');
            sendResponse({ timeLeft: computeTimeLeft() });
            break;
          }
        }

        if (hostnameToApply) {
          await applyLimitToOpenTabs(hostnameToApply);
        }
      } catch (error) {
        console.error("Can't handle message:", error);
      }
    })();
    return true;
  }
);

async function setupDailyResetAlarm(): Promise<void> {
  try {
    await initializeFromStorage();

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delayInMinutes = (nextMidnight.getTime() - now.getTime()) / (1000 * 60);

    chrome.alarms.create(DAILY_RESET_ALARM, {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60,
    });

    console.log(`Daily reset alarm scheduled for ${nextMidnight.toLocaleString()}`);
  } catch (error) {
    console.error("Can't setup daily reset alarm:", error);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === DAILY_RESET_ALARM) {
    try {
      console.log('Daily reset triggered at', new Date().toLocaleString());

      for (const member in visitCounts) delete visitCounts[member];
      for (const member in dailyTimeSpent) delete dailyTimeSpent[member];
      for (const tabID in timers) {
        clearTimeout(timers[tabID]);
        delete timers[tabID];
      }
      for (const member in timerStartTimes) delete timerStartTimes[member];
      for (const tabID in lastHandle) delete lastHandle[tabID];

      updateStorage();
      console.log('Visit counts, timers, and timer data reset for new day');

      const limitedHostnames = getAllLimitedHostnames();
      for (const hostname of limitedHostnames) {
        await applyLimitToOpenTabs(hostname);
      }
      console.log('Limits re-applied to open tabs for new day');
    } catch (error) {
      console.error("Can't process daily reset:", error);
    }
  }
});

async function main(): Promise<void> {
  try {
    await restoreTimers();
    await setupDailyResetAlarm();
  } catch (error) {
    console.error('Error in main:', error);
  }
}

main();
