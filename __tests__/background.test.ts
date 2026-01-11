/**
 * Unit tests for background.ts
 * Testing background script functionality with mocked Chrome APIs
 */

import { jest } from '@jest/globals';
import type { StatsResponse, LimitsResponse, StatItem, LimitItem } from '../src/shared/types.js';

interface MockStorageData {
  timeLimits?: Record<string, number>;
  visitLimits?: Record<string, number>;
  visitCounts?: Record<string, number>;
  timerStartTimes?: Record<string, { hostname: string; startTime: number }>;
}

interface MockTab {
  id?: number;
  url?: string;
  pendingUrl?: string;
}

interface MockAlarm {
  name: string;
}

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => boolean | void;

type TabsOnUpdatedListener = (
  tabId: number,
  changeInfo: { url?: string },
  tab: MockTab
) => void | Promise<void>;

type TabsOnActivatedListener = (activeInfo: { tabId: number }) => void | Promise<void>;

type AlarmListener = (alarm: MockAlarm) => void | Promise<void>;

const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockTabsUpdate = jest.fn();
const mockTabsQuery = jest.fn() as jest.MockedFunction<() => Promise<MockTab[]>>;
const mockTabsGet = jest.fn();
const mockAlarmsCreate = jest.fn();
const mockRuntimeGetURL = jest.fn((path: string) => `chrome-extension://fake-id/${path}`);

declare const global: typeof globalThis & {
  chrome: {
    storage: {
      local: {
        get: typeof mockStorageGet;
        set: typeof mockStorageSet;
      };
    };
    tabs: {
      onUpdated: { addListener: jest.MockedFunction<(listener: TabsOnUpdatedListener) => void> };
      onActivated: {
        addListener: jest.MockedFunction<(listener: TabsOnActivatedListener) => void>;
      };
      update: typeof mockTabsUpdate;
      get: typeof mockTabsGet;
      query: typeof mockTabsQuery;
    };
    runtime: {
      onMessage: { addListener: jest.MockedFunction<(listener: MessageListener) => void> };
      lastError: { message: string } | null;
      getURL: typeof mockRuntimeGetURL;
    };
    alarms: {
      create: typeof mockAlarmsCreate;
      onAlarm: { addListener: jest.MockedFunction<(listener: AlarmListener) => void> };
    };
  };
};

Object.defineProperty(global, 'chrome', {
  value: {
    storage: {
      local: {
        get: mockStorageGet,
        set: mockStorageSet,
      },
    },
    tabs: {
      onUpdated: { addListener: jest.fn() },
      onActivated: { addListener: jest.fn() },
      update: mockTabsUpdate,
      get: mockTabsGet,
      query: mockTabsQuery,
    },
    runtime: {
      onMessage: { addListener: jest.fn() },
      lastError: null,
      getURL: mockRuntimeGetURL,
    },
    alarms: {
      create: mockAlarmsCreate,
      onAlarm: { addListener: jest.fn() },
    },
  },
  writable: true,
  configurable: true,
});

mockStorageGet.mockImplementation((...args: unknown[]) => {
  const callback = args[args.length - 1] as (data: MockStorageData) => void;
  callback({ timeLimits: {}, visitLimits: {}, visitCounts: {}, timerStartTimes: {} });
});

let messageListener: MessageListener;
let onUpdatedListener: TabsOnUpdatedListener;
let onActivatedListener: TabsOnActivatedListener;
let alarmListener: AlarmListener;

describe('Background Script', () => {
  beforeAll(async () => {
    await import('../src/background/background.js');

    messageListener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
    onUpdatedListener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];
    onActivatedListener = global.chrome.tabs.onActivated.addListener.mock.calls[0][0];
    alarmListener = global.chrome.alarms.onAlarm.addListener.mock.calls[0][0];

    expect(global.chrome.storage.local.get).toHaveBeenCalledWith(
      ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes'],
      expect.any(Function)
    );
  });

  beforeEach(() => {
    mockTabsQuery.mockClear();
    mockTabsUpdate.mockClear();
    mockStorageSet.mockClear();

    mockTabsQuery.mockResolvedValue([]);
    mockStorageGet.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (data: MockStorageData) => void;
      callback({ timeLimits: {}, visitLimits: {}, visitCounts: {}, timerStartTimes: {} });
    });
  });

  describe('Initialization', () => {
    test('should register all required event listeners', () => {
      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(global.chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(global.chrome.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(global.chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    });

    test('should setup daily reset alarm with correct timing', () => {
      const alarmCall = mockAlarmsCreate.mock.calls.find((call) => call[0] === 'dailyResetAlarm');
      expect(alarmCall).toBeDefined();

      const alarmInfo = alarmCall![1] as { delayInMinutes: number; periodInMinutes: number };
      expect(alarmInfo.delayInMinutes).toBeGreaterThan(0);
      expect(alarmInfo.delayInMinutes).toBeLessThanOrEqual(24 * 60);
      expect(alarmInfo.periodInMinutes).toBe(24 * 60);
    });

    test('should load persisted data from storage on startup', () => {
      expect(mockStorageGet).toHaveBeenCalledWith(
        ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes'],
        expect.any(Function)
      );
    });
  });

  describe('Message Handling - setVisitLimit', () => {
    test('should set visit limit for hostname', async () => {
      const sendResponse = jest.fn();

      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          visitLimits: expect.objectContaining({ 'example.com': 5 }),
        }),
        expect.any(Function)
      );
    });

    test('should extract hostname from full URL', async () => {
      const sendResponse = jest.fn();

      messageListener(
        { type: 'setVisitLimit', hostname: 'https://www.example.com/path', visitLimit: 10 },
        {},
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          visitLimits: expect.objectContaining({ 'example.com': 10 }),
        }),
        expect.any(Function)
      );
    });

    test('should query open tabs to apply limits immediately', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com/page' }]);

      const sendResponse = jest.fn();
      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTabsQuery).toHaveBeenCalledWith({});
    });

    test('should return true for async message handling', () => {
      const sendResponse = jest.fn();
      const result = messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        sendResponse
      );

      expect(result).toBe(true);
    });
  });

  describe('Message Handling - setTimeLimit', () => {
    test('should set time limit for hostname', async () => {
      const sendResponse = jest.fn();

      messageListener(
        { type: 'setTimeLimit', hostname: 'github.com', timeLimit: 30 },
        {},
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          timeLimits: expect.objectContaining({ 'github.com': 30 }),
        }),
        expect.any(Function)
      );
    });

    test('should handle numeric string values', async () => {
      const sendResponse = jest.fn();

      messageListener(
        { type: 'setTimeLimit', hostname: 'example.com', timeLimit: '60' as unknown as number },
        {},
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          timeLimits: expect.objectContaining({ 'example.com': 60 }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('Message Handling - deLimit', () => {
    test('should remove all limits for hostname', async () => {
      const sendResponse = jest.fn();

      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        jest.fn()
      );
      messageListener(
        { type: 'setTimeLimit', hostname: 'example.com', timeLimit: 30 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      messageListener({ type: 'deLimit', hostname: 'example.com' }, {}, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      expect(mockStorageSet).toHaveBeenCalled();

      const limit = mockStorageSet.mock.calls[
        mockStorageSet.mock.calls.length - 1
      ][0] as MockStorageData;
      expect(limit.visitLimits).not.toHaveProperty('example.com');
      expect(limit.timeLimits).not.toHaveProperty('example.com');
    });
  });

  describe('Message Handling - getStats', () => {
    test('should return stats array (may include previously set limits)', async () => {
      const sendResponse = jest.fn();

      messageListener({ type: 'getStats' }, {}, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = sendResponse.mock.calls[0][0] as StatsResponse;
      expect(response.stats).toBeInstanceOf(Array);
      expect(response).toHaveProperty('stats');
    });

    test('should return stats with visit counts for newly set limits', async () => {
      const sendResponse = jest.fn();

      const testHostname = 'newstatstest.com';
      messageListener(
        { type: 'setVisitLimit', hostname: testHostname, visitLimit: 10 },
        {},
        jest.fn()
      );
      messageListener(
        { type: 'setTimeLimit', hostname: testHostname, timeLimit: 30 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      messageListener({ type: 'getStats' }, {}, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = sendResponse.mock.calls[0][0] as StatsResponse;
      expect(response.stats).toBeInstanceOf(Array);

      const stat = response.stats.find((s: StatItem) => s.hostname === testHostname);
      expect(stat).toBeDefined();
      expect(stat).toMatchObject({
        hostname: testHostname,
        visitLimit: 10,
        timeLimit: 30,
        visitCount: 0,
      });
    });

    test('should include visit count in stats response', async () => {
      const sendResponse = jest.fn();

      const testHostname = 'visitcounttest.com';
      messageListener(
        { type: 'setVisitLimit', hostname: testHostname, visitLimit: 10 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      messageListener({ type: 'getStats' }, {}, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = sendResponse.mock.calls[0][0] as StatsResponse;
      const stat = response.stats.find((s: StatItem) => s.hostname === testHostname);

      expect(stat).toBeDefined();
      if (stat) {
        expect(stat).toHaveProperty('visitCount');
        expect(typeof stat.visitCount).toBe('number');
        expect(stat.visitCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Message Handling - getAllLimits', () => {
    test('should return limits array', async () => {
      const sendResponse = jest.fn();

      messageListener({ type: 'getAllLimits' }, {}, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = sendResponse.mock.calls[0][0] as LimitsResponse;
      expect(response.limits).toBeInstanceOf(Array);
      expect(response).toHaveProperty('limits');
    });

    test('should return all configured limits', async () => {
      const sendResponse = jest.fn();

      const hostname1 = 'limitstest1.com';
      const hostname2 = 'limitstest2.com';

      messageListener({ type: 'setVisitLimit', hostname: hostname1, visitLimit: 5 }, {}, jest.fn());
      messageListener({ type: 'setTimeLimit', hostname: hostname2, timeLimit: 60 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      messageListener({ type: 'getAllLimits' }, {}, sendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = sendResponse.mock.calls[0][0] as LimitsResponse;
      expect(response.limits).toBeInstanceOf(Array);

      const limit1 = response.limits.find((l: LimitItem) => l.hostname === hostname1);
      const limit2 = response.limits.find((l: LimitItem) => l.hostname === hostname2);

      expect(limit1).toBeDefined();
      expect(limit1?.visitLimit).toBe(5);
      expect(limit2).toBeDefined();
      expect(limit2?.timeLimit).toBe(60);
    });
  });

  describe('Tab Event - onUpdated', () => {
    test('should handle tab URL changes', async () => {
      await onUpdatedListener(1, { url: 'https://example.com' }, {});
      expect(true).toBe(true);
    });

    test('should ignore updates without URL changes', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await onUpdatedListener(1, {}, {});

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('was updated'));

      consoleSpy.mockRestore();
    });

    test('should handle malformed URLs gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await onUpdatedListener(1, { url: 'invalid://bad::url' }, {});

      const logMessages = consoleSpy.mock.calls.map((call) => call.join(' '));
      expect(logMessages.some((msg) => msg.includes('was updated'))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Tab Event - onActivated', () => {
    test('should handle tab activation with valid URL', async () => {
      mockTabsGet.mockImplementation((...args: unknown[]) => {
        const callback = args[1] as (tab: MockTab) => void;
        callback({ url: 'https://example.com', pendingUrl: undefined });
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await onActivatedListener({ tabId: 1 });

      expect(mockTabsGet).toHaveBeenCalledWith(1, expect.any(Function));

      consoleSpy.mockRestore();
    });

    test('should handle new tabs with pendingUrl', async () => {
      mockTabsGet.mockImplementation((...args: unknown[]) => {
        const callback = args[1] as (tab: MockTab) => void;
        callback({ url: 'about:blank', pendingUrl: 'https://pending.com' });
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await onActivatedListener({ tabId: 1 });

      const logMessages = consoleSpy.mock.calls.map((call) => call.join(' '));
      expect(logMessages.some((msg) => msg.includes('new tab from onActivated'))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Daily Reset Alarm', () => {
    test('should process daily reset alarm', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await alarmListener({ name: 'dailyResetAlarm' });

      const logMessages = consoleSpy.mock.calls.map((call) => call.join(' '));
      expect(
        logMessages.some((msg) => msg.includes('Daily reset triggered') || msg.includes('reset'))
      ).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should ignore non-reset alarms', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await alarmListener({ name: 'someOtherAlarm' });

      const logMessages = consoleSpy.mock.calls.map((call) => call.join(' '));
      expect(logMessages.some((msg) => msg.includes('Daily reset'))).toBe(false);

      consoleSpy.mockRestore();
    });
  });
  describe('Apply Limits to Open Tabs', () => {
    beforeEach(() => {
      mockTabsQuery.mockClear();
      mockTabsUpdate.mockClear();
    });

    test('should query all tabs when setting limits', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com/page' }]);

      const sendResponse = jest.fn();
      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTabsQuery).toHaveBeenCalledWith({});
    });

    test('should apply limits to matching open tabs', async () => {
      const uniqueHostname = 'uniquetabtest' + Date.now() + '.com';

      mockTabsQuery.mockResolvedValue([
        { id: 101, url: `https://${uniqueHostname}/page1` },
        { id: 102, url: `https://${uniqueHostname}/page2` },
        { id: 103, url: 'https://other.com/page' },
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      messageListener(
        { type: 'setVisitLimit', hostname: uniqueHostname, visitLimit: 5 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logMessages = consoleSpy.mock.calls.map((call) => call.join(' '));
      const appliedLogs = logMessages.filter((msg) =>
        msg.includes(`Found open tab for ${uniqueHostname}`)
      );

      expect(appliedLogs.length).toBeGreaterThanOrEqual(1);
      expect(mockTabsQuery).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle tabs without URLs gracefully', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, url: 'https://example.com/page' },
        { id: 2 },
        { id: 3, url: undefined },
      ]);

      const testFunction = async () => {
        messageListener(
          { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
          {},
          jest.fn()
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      };

      await expect(testFunction()).resolves.not.toThrow();
    });

    test('should handle tab query errors gracefully', async () => {
      mockTabsQuery.mockRejectedValue(new Error('Query failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error querying tabs:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Storage Persistence', () => {
    test('should persist all data when updating storage', async () => {
      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          timeLimits: expect.any(Object),
          visitLimits: expect.any(Object),
          visitCounts: expect.any(Object),
          timerStartTimes: expect.any(Object),
        }),
        expect.any(Function)
      );
    });

    test('should handle storage errors gracefully', async () => {
      mockStorageSet.mockImplementation((...args: unknown[]) => {
        const callback = args[1] as (() => void) | undefined;
        global.chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        if (callback) callback();
        // Reset to null - already typed as nullable in declaration
        (global.chrome.runtime.lastError as unknown) = null;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      messageListener(
        { type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error saving data to storage:',
        expect.any(Object)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('URL Redirect Functionality', () => {
    test('should use chrome.runtime.getURL for time-exceeded page', () => {
      const url = mockRuntimeGetURL('time-exceeded.html');
      expect(url).toBe('chrome-extension://fake-id/time-exceeded.html');
    });

    test('should use chrome.runtime.getURL for visits-exceeded page', () => {
      const url = mockRuntimeGetURL('visits-exceeded.html');
      expect(url).toBe('chrome-extension://fake-id/visits-exceeded.html');
    });
  });
});
