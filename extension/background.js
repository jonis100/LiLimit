import { extractHostname, limits_to_string } from './utils.js';

const visitCounts = {};
const timeLimits = {};
const visitLimits = {};
const timers = {};
const lastHandle = {};
const timerStartTimes = {};

let isInitialized = false;
let initializationPromise = null;

async function initializeFromStorage() {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes'],
      (result) => {
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

function redirectTabToTimeExceeded(tabID) {
  chrome.tabs
    .update(Number(tabID), {
      url: 'https://github.com/jonis100/LiLimit#time-exceeded',
    })
    .catch(() => {
      console.log(`Tab ${tabID} no longer exists, cleaned up timer data`);
      timeLimits[tabID] = undefined;
      timerStartTimes[tabID] = undefined;
      updateStorage();
    });
}

function setTimerForTab(tabID, hostname, remainingMinutes, startTime = Date.now()) {
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

function calculateRemainingTime(startTime, timeLimit) {
  const now = Date.now();
  const elapsed = (now - startTime) / 60000; // minutes
  return timeLimit - elapsed;
}

function resumeOrExpireTimer(tabID, hostname, timeLimit, existingStartTime) {
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

async function restoreTimers() {
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

function handleHostname(hostname, tabID) {
  console.log('Handling: ', hostname);

  if (visitLimits[hostname] && lastHandle[tabID] != hostname) {
    visitCounts[hostname] = (visitCounts[hostname] || 0) + 1;
    console.log(
      `Visit count for ${hostname} is now ${visitCounts[hostname]} (limit: ${visitLimits[hostname]})`
    );
    updateStorage();

    if (visitLimits[hostname] !== undefined && visitCounts[hostname] > visitLimits[hostname]) {
      console.log(`Visit limit exceeded for ${hostname} on tabId: ${tabID}`);
      chrome.tabs.update(tabID, {
        url: 'https://github.com/jonis100/LiLimit#visits-per-day-exceeded',
      });
      return;
    }
  }

  if (timeLimits[hostname] !== undefined && lastHandle[tabID] !== hostname) {
    const timeLimit = timeLimits[hostname];
    setTimerForTab(tabID, hostname, timeLimit);
    console.log(`New timer set for ${hostname} on tabId: ${tabID} for ${timeLimit} minutes`);
  }
  lastHandle[tabID] = hostname;
}

initializeFromStorage().then(() => restoreTimers());

function updateStorage() {
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
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
    console.log("Can't handle in onUpdated:", error);
    console.log('The problematic URL: ', changeInfo);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await initializeFromStorage();

    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (typeof tab.pendingUrl == 'undefined') {
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  initializeFromStorage()
    .then(() => {
      if (request.hostname && extractHostname(request.hostname) === 'github.com') {
        console.log(
          "You can't limit github.com.\n" +
            '\t1. It could cause an infinite loop if the redirect page is on github.com.\n' +
            "\t2. Don't worry, you're not wasting your time there!"
        );
        return;
      }

      switch (request.type) {
        case 'setVisitLimit': {
          const hostname = extractHostname(request.hostname);
          const v = Number(request.visitLimit);
          visitLimits[hostname] = Number.isFinite(v) ? v : request.visitLimit;
          updateStorage();
          break;
        }

        case 'setTimeLimit': {
          const hostname = extractHostname(request.hostname);
          const t = Number(request.timeLimit);
          timeLimits[hostname] = Number.isFinite(t) ? t : request.timeLimit;
          updateStorage();
          break;
        }

        case 'deLimit': {
          const hostname = extractHostname(request.hostname);
          delete visitLimits[hostname];
          delete timeLimits[hostname];
          delete visitCounts[hostname];
          updateStorage();
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
          const stats = [];
          const timeLimitsSet = new Set(Object.keys(timeLimits));
          const visitLimitsSet = new Set(Object.keys(visitLimits));
          const allLimitsUnion = new Set([...timeLimitsSet, ...visitLimitsSet]);

          allLimitsUnion.forEach((hostname) => {
            const stat = {
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
          const limits = [];
          const timeLimitsSet = new Set(Object.keys(timeLimits));
          const visitLimitsSet = new Set(Object.keys(visitLimits));
          const allLimitsUnion = new Set([...timeLimitsSet, ...visitLimitsSet]);

          allLimitsUnion.forEach((hostname) => {
            const limit = {
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
    })
    .catch((error) => {
      console.error("Can't handle message:", error);
    });
  return true;
});

const DAILY_RESET_ALARM = 'dailyResetAlarm';

async function setupDailyResetAlarm() {
  try {
    await initializeFromStorage();

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delayInMinutes = (nextMidnight - now) / (1000 * 60);

    chrome.alarms.create(DAILY_RESET_ALARM, {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60,
    });

    console.log(`Daily reset alarm scheduled for ${nextMidnight.toLocaleString()}`);
  } catch (error) {
    console.error("Can't setup daily reset alarm:", error);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_RESET_ALARM) {
    try {
      console.log('Daily reset triggered at', new Date().toLocaleString());

      for (const member in visitCounts) delete visitCounts[member];
      for (const tabID in timers) {
        clearTimeout(timers[tabID]);
        delete timers[tabID];
      }
      for (const member in timerStartTimes) delete timerStartTimes[member];

      updateStorage();
      console.log('Visit counts, timers, and timer data reset for new day');
    } catch (error) {
      console.error("Can't process daily reset:", error);
    }
  }
});

setupDailyResetAlarm();
