import { extractHostname, limits_to_string } from './utils.js';

const visitCounts = {};
const timeLimits = {};
const visitLimits = {};
const timers = {};
const lastHandle = {};

let isInitialized = false;
let initializationPromise = null;

async function initializeFromStorage() {
  if (isInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise((resolve, reject) => {
    chrome.storage.local.get(['timeLimits', 'visitLimits', 'visitCounts'], (result) => {
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
        console.log('Loaded persisted data from storage:', {
          timeLimits,
          visitLimits,
          visitCounts,
        });
        isInitialized = true;
        resolve();
      } catch (e) {
        console.error('Error parsing data from storage:', e);
        isInitialized = false;
        initializationPromise = null;
        reject(e);
      }
    });
  });

  return initializationPromise;
}

initializeFromStorage();

function updateStorage() {
  try {
    chrome.storage.local.set(
      {
        timeLimits: timeLimits,
        visitLimits: visitLimits,
        visitCounts: visitCounts,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data to storage:', chrome.runtime.lastError);
        } else {
          console.log('Saved data to storage:', {
            timeLimits,
            visitLimits,
            visitCounts,
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
    await initializeFromStorage();

    const hostname = extractHostname(changeInfo.url);
    console.log(`Tab with id: ${tabId} was updated. New url: ${changeInfo.url}`);
    if (timers[tabId] && lastHandle[tabId] != hostname) {
      clearTimeout(timers[tabId]);
      delete timers[tabId];
      console.log(`clear timout on tabId: ${tabId}`);
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

function handleHostname(hostname, tabID) {
  console.log('Handling: ', hostname);

  if (visitCounts[hostname] && lastHandle[tabID] != hostname) {
    visitCounts[hostname]++;
    updateStorage();

    if (visitLimits[hostname] !== undefined && visitCounts[hostname] > visitLimits[hostname]) {
      chrome.tabs.update(tabID, {
        url: 'https://github.com/jonis100/LiLimit#visits-per-day-exceeded',
      });
    }
  } else {
    if (visitLimits[hostname] && lastHandle[tabID] != hostname) {
      visitCounts[hostname] = 1;
      updateStorage();
    }
  }

  if (timeLimits[hostname] !== undefined) {
    const timeLimit = timeLimits[hostname];
    const timer = setTimeout(() => {
      chrome.tabs.update(tabID, {
        url: 'https://github.com/jonis100/LiLimit#time-exceeded',
      });
    }, timeLimit * 60000);
    timers[tabID] = timer;
    console.log(`timers[tabID]: set on tabId: ${tabID} timer: ${timer}`);
  }
  lastHandle[tabID] = hostname;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  initializeFromStorage()
    .then(() => {
      if (request.hostname && extractHostname(request.hostname) === 'github.com') {
        console.log(
          "You can't limit github.com. \n " +
            '\t1. It will cause an infinite loop. \n' +
            "\t2. There isn't worried you will waste youre time there.."
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
      for (const member in timers) delete timers[member];

      updateStorage();
      console.log('Visit counts and timers reset for new day');
    } catch (error) {
      console.error("Can't process daily reset:", error);
    }
  }
});

setupDailyResetAlarm();
