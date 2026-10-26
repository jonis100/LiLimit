/**
 * Tests for background state restoration after an MV3 service worker restart.
 * Each test loads a fresh copy of the module to simulate the worker waking up.
 */

import { jest } from '@jest/globals';

interface StoredTimer {
  hostname: string;
  startTime: number;
}

interface StoredData {
  timeLimits?: Record<string, number>;
  visitLimits?: Record<string, number>;
  visitCounts?: Record<string, number>;
  timerStartTimes?: Record<string, StoredTimer>;
  dailyTimeSpent?: Record<string, number>;
  settings?: { dailyTimeLimit: boolean };
  lastResetDate?: string;
}

interface Tab {
  id: number;
  url: string;
}

type Listener = (...args: unknown[]) => void | Promise<void>;

const realSetTimeout = globalThis.setTimeout;
const NOW = new Date('2026-10-25T12:00:00').getTime();
const TODAY = '2026-10-25';
const SITE = 'distracting.com';

let storageSet: jest.Mock<(data: unknown, cb?: () => void) => void>;
let listeners: Record<string, Listener>;
let tabsUpdate: jest.Mock<(tabId: number, props: { url: string }) => Promise<void>>;

function lastSaved(): StoredData {
  const calls = storageSet.mock.calls;
  return calls[calls.length - 1][0] as StoredData;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => realSetTimeout(resolve, 0));
}

async function startWorker(
  stored: StoredData,
  { activeTab, sessionAlive }: { activeTab: Tab | null; sessionAlive: boolean }
): Promise<void> {
  const tabs: Record<number, Tab> = activeTab ? { [activeTab.id]: activeTab } : {};
  const session: Record<string, unknown> = sessionAlive ? { browserSessionStarted: true } : {};
  storageSet = jest.fn((_data: unknown, cb?: () => void) => cb?.());
  listeners = {};
  tabsUpdate = jest.fn(() => Promise.resolve());
  const capture = (name: string) => ({
    addListener: (fn: Listener) => {
      listeners[name] = fn;
    },
  });

  Object.defineProperty(global, 'chrome', {
    value: {
      storage: {
        local: {
          // Async like the real API, so events can arrive before storage has loaded.
          get: (_keys: unknown, cb: (data: StoredData) => void) =>
            realSetTimeout(
              () => cb(JSON.parse(JSON.stringify({ lastResetDate: TODAY, ...stored }))),
              0
            ),
          set: storageSet,
        },
        session: {
          get: async (key: string) => (key in session ? { [key]: session[key] } : {}),
          set: async (data: Record<string, unknown>) => Object.assign(session, data),
        },
      },
      tabs: {
        onUpdated: capture('onUpdated'),
        onActivated: capture('onActivated'),
        onRemoved: capture('onRemoved'),
        update: tabsUpdate,
        get: (id: number, cb: (tab: Tab) => void) =>
          cb(tabs[id] ?? { id, url: 'https://other.com' }),
        query: async (info: { active?: boolean }) =>
          info.active ? (activeTab ? [activeTab] : []) : Object.values(tabs),
      },
      runtime: {
        onMessage: capture('onMessage'),
        lastError: null,
        getURL: (path: string) => `chrome-extension://id/${path}`,
      },
      windows: { WINDOW_ID_NONE: -1, onFocusChanged: capture('onFocusChanged') },
      alarms: { create: jest.fn(), onAlarm: capture('onAlarm') },
    },
    writable: true,
    configurable: true,
  });

  await import(`../src/background/background.ts?t=${Math.random()}`);
}

describe('Background restore after service worker restart', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    jest.setSystemTime(NOW);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('daily mode', () => {
    const dailyStored = (tabId: number, startedAgoMs: number): StoredData => ({
      timeLimits: { [SITE]: 30 },
      timerStartTimes: { [tabId]: { hostname: SITE, startTime: NOW - startedAgoMs } },
      dailyTimeSpent: { [SITE]: 0 },
      settings: { dailyTimeLimit: true },
    });

    test('pauses the restored active tab when the user switches away', async () => {
      await startWorker(dailyStored(10, 60_000), {
        activeTab: { id: 10, url: `https://${SITE}` },
        sessionAlive: true,
      });
      await flush();
      expect(lastSaved().timerStartTimes?.[10]).toBeDefined();

      jest.setSystemTime(NOW + 30_000);
      await listeners.onActivated({ tabId: 11 });
      await flush();

      expect(lastSaved().timerStartTimes?.[10]).toBeUndefined();
      expect(lastSaved().dailyTimeSpent?.[SITE]).toBe(90_000);
    });

    test('folds a non-active tab segment without resuming its timer', async () => {
      await startWorker(dailyStored(10, 120_000), {
        activeTab: { id: 11, url: 'https://other.com' },
        sessionAlive: true,
      });
      await flush();

      expect(lastSaved().dailyTimeSpent?.[SITE]).toBe(120_000);
      expect(lastSaved().timerStartTimes?.[10]).toBeUndefined();
    });

    test('drops segments from a previous browser session instead of counting them', async () => {
      await startWorker(dailyStored(10, 5 * 60 * 60_000), {
        activeTab: { id: 10, url: `https://${SITE}` },
        sessionAlive: false,
      });
      await flush();

      expect(lastSaved().dailyTimeSpent?.[SITE]).toBe(0);
      expect(lastSaved().timerStartTimes).toEqual({});
    });
  });

  describe('per-visit mode', () => {
    test('keeps the original timer when re-activating a restored tab', async () => {
      const startTime = NOW - 5 * 60_000;
      await startWorker(
        {
          timeLimits: { [SITE]: 30 },
          timerStartTimes: { 10: { hostname: SITE, startTime } },
          settings: { dailyTimeLimit: false },
        },
        { activeTab: { id: 10, url: `https://${SITE}` }, sessionAlive: true }
      );
      await listeners.onActivated({ tabId: 10 });
      await flush();

      expect(lastSaved().timerStartTimes?.[10].startTime).toBe(startTime);
    });
  });

  test('daily reset alarm that wakes the worker is not undone by the storage load', async () => {
    await startWorker(
      {
        visitLimits: { [SITE]: 5 },
        visitCounts: { [SITE]: 3 },
        settings: { dailyTimeLimit: false },
      },
      { activeTab: null, sessionAlive: true }
    );
    await listeners.onAlarm({ name: 'dailyResetAlarm' });
    await flush();

    expect(lastSaved().visitCounts).toEqual({});
  });

  describe('missed daily reset', () => {
    const usedYesterday = (lastResetDate?: string): StoredData => ({
      visitLimits: { [SITE]: 5 },
      timeLimits: { [SITE]: 30 },
      visitCounts: { [SITE]: 5 },
      dailyTimeSpent: { [SITE]: 30 * 60_000 },
      settings: { dailyTimeLimit: true },
      lastResetDate,
    });

    test('resets on startup when Chrome was closed at midnight', async () => {
      await startWorker(usedYesterday('2026-10-24'), { activeTab: null, sessionAlive: false });
      await flush();

      expect(lastSaved().visitCounts).toEqual({});
      expect(lastSaved().dailyTimeSpent).toEqual({});
      expect(lastSaved().lastResetDate).toBe(TODAY);
      expect(lastSaved().timeLimits).toEqual({ [SITE]: 30 });
    });

    test('resets on first startup after upgrading, when no reset date was stored', async () => {
      await startWorker(
        { ...usedYesterday(), lastResetDate: undefined },
        { activeTab: null, sessionAlive: false }
      );
      await flush();

      expect(lastSaved().visitCounts).toEqual({});
      expect(lastSaved().lastResetDate).toBe(TODAY);
    });

    test('keeps counts when the reset already ran today', async () => {
      await startWorker(usedYesterday(TODAY), { activeTab: null, sessionAlive: true });
      await listeners.onActivated({ tabId: 99 });
      await flush();

      expect(lastSaved().visitCounts).toEqual({ [SITE]: 5 });
    });
  });

  test('user blocked yesterday can visit again after reopening Chrome the next day', async () => {
    const visit = async () => {
      await listeners.onUpdated(5, { url: `https://${SITE}/` }, {});
      await listeners.onUpdated(5, { url: 'https://other.com/' }, {});
      await flush();
    };
    const blockedTabs = () =>
      tabsUpdate.mock.calls.filter(([, props]) => props.url.includes('visits-exceeded'));

    await startWorker(
      { visitLimits: { [SITE]: 1 }, settings: { dailyTimeLimit: false } },
      { activeTab: null, sessionAlive: true }
    );
    await visit();
    await visit();
    expect(blockedTabs()).toHaveLength(1);

    // Chrome is closed over midnight, so the reset alarm never fires.
    const savedYesterday = lastSaved();
    jest.setSystemTime(new Date('2026-10-26T09:00:00'));

    await startWorker(savedYesterday, { activeTab: null, sessionAlive: false });
    await visit();

    expect(blockedTabs()).toHaveLength(0);
    expect(lastSaved().visitCounts).toEqual({ [SITE]: 1 });
  });
});
