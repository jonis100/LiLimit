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

interface StorageData {
  timeLimits?: Limits;
  visitLimits?: Limits;
  visitCounts?: VisitCounts;
  timerStartTimes?: TimerStartTimes;
}

interface MessageRequest {
  type: string;
  hostname?: string;
  visitLimit?: number;
  timeLimit?: number;
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

const visitCounts: VisitCounts = {};
const timeLimits: Limits = {};
const visitLimits: Limits = {};
const timers: Timers = {};
const lastHandle: LastHandle = {};
const timerStartTimes: TimerStartTimes = {};

let isInitialized: boolean = false;
let initializationPromise: Promise<void> | null = null;

async function initializeFromStorage(): Promise<void> {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes'],
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
      url: chrome.runtime.getURL('../pages/time-exceeded.html'),
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
    delete timers[tabID];
    delete timerStartTimes[tabID];
    updateStorage();
    redirectTabToTimeExceeded(tabID);
  }, remainingMinutes * 60000);
  timers[tabID] = timer;
  updateStorage();
  return timer;
}

function calculateRemainingTime(startTime: number, timeLimit: number): number {
  const now = Date.now();
  const elapsed = (now - startTime) / 60000; // minutes
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

async function restoreTimers(): Promise<void> {
  await initializeFromStorage();

  for (const tabID in timerStartTimes) {
    const timerData = timerStartTimes[tabID];
    const hostname = timerData.hostname;
    const startTime = timerData.startTime;
    const timeLimit = timeLimits[hostname];

    if (timeLimit === undefined) {
      delete timerStartTimes[tabID];
      continue;
    }

    const result = resumeOrExpireTimer(tabID, hostname, timeLimit, startTime);
    if (result.resumed) {
      console.log(
        `Restored timer for ${hostname} on tabId: ${tabID}, ${result.remaining.toFixed(2)} minutes remaining`
      );
    }
  }
  updateStorage();
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
        url: chrome.runtime.getURL('../pages/visits-exceeded.html'),
      });
      return;
    }
  }

  if (timeLimits[hostname] && lastHandle[tabID] !== hostname) {
    const timeLimit = timeLimits[hostname];
    setTimerForTab(tabID, hostname, timeLimit);
    console.log(`New timer set for ${hostname} on tabId: ${tabID} for ${timeLimit} minutes`);
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

function updateStorage(): void {
  try {
    chrome.storage.local.set(
      {
        timeLimits: timeLimits,
        visitLimits: visitLimits,
        visitCounts: visitCounts,
        timerStartTimes: timerStartTimes,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data to storage:', chrome.runtime.lastError);
        } else {
          console.log('Saved data to storage:', {
            timeLimits,
            visitLimits,
            visitCounts,
            timerStartTimes,
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

      await initializeFromStorage();

      const hostname = extractHostname(changeInfo.url);
      console.log(`Tab with id: ${tabId} was updated. New url: ${changeInfo.url}`);

      if (timers[tabId] && lastHandle[tabId] && lastHandle[tabId] !== hostname) {
        clearTimeout(timers[tabId]);
        delete timers[tabId];
        delete timerStartTimes[tabId];
        console.log(
          `Cleared timer on tabId: ${tabId}, hostname changed from ${lastHandle[tabId]} to ${hostname}`
        );
        updateStorage();
      }

      handleHostname(hostname, tabId);
    } catch (error) {
      console.log(`Can't handle in onUpdated: ${error} for ${changeInfo.url}`);
    }
  }
);

chrome.tabs.onActivated.addListener(async (activeInfo: chrome.tabs.TabActiveInfo) => {
  try {
    await initializeFromStorage();

    chrome.tabs.get(activeInfo.tabId, (tab: chrome.tabs.Tab) => {
      if (typeof tab.pendingUrl == 'undefined' && tab.url && tab.id) {
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

chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    (async () => {
      try {
        await initializeFromStorage();
        let hostnameToApply: string | null = null;

        switch (request.type) {
          case 'setVisitLimit': {
            if (!request.hostname) break;
            const hostname = extractHostname(request.hostname);
            const v = Number(request.visitLimit);
            visitLimits[hostname] = Number.isFinite(v) ? v : request.visitLimit!;
            updateStorage();
            hostnameToApply = hostname;
            break;
          }

          case 'setTimeLimit': {
            if (!request.hostname) break;
            const hostname = extractHostname(request.hostname);
            const t = Number(request.timeLimit);
            timeLimits[hostname] = Number.isFinite(t) ? t : request.timeLimit!;
            updateStorage();
            hostnameToApply = hostname;
            break;
          }

          case 'deLimit': {
            if (!request.hostname) break;
            const hostname = extractHostname(request.hostname);
            delete visitLimits[hostname];
            delete timeLimits[hostname];
            delete visitCounts[hostname];
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

const DAILY_RESET_ALARM = 'dailyResetAlarm';

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
    await initializeFromStorage();
    await restoreTimers();
    await setupDailyResetAlarm();
  } catch (error) {
    console.error('Error in main:', error);
  }
}

main();
