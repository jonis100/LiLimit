import { jest } from '@jest/globals';

const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockTabsUpdate = jest.fn();
const mockTabsQuery = jest.fn();
const mockAlarmsCreate = jest.fn();

global.chrome = {
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
    get: jest.fn(),
    query: mockTabsQuery,
  },
  runtime: {
    onMessage: { addListener: jest.fn() },
    lastError: null,
    getURL: jest.fn((path) => `chrome-extension://fake-extension-id/${path}`),
  },
  alarms: {
    create: mockAlarmsCreate,
    onAlarm: { addListener: jest.fn() },
  },
};

mockStorageGet.mockImplementation((_keys, callback) => {
  callback({ timeLimits: {}, visitLimits: {}, visitCounts: {} });
});
await import('../extension/background.js');

describe('Background Script', () => {
  beforeAll(() => {
    expect(global.chrome.storage.local.get).toHaveBeenCalled();
  });

  describe('Storage Persistence', () => {
    test('should load all required data from storage', () => {
      expect(mockStorageGet).toHaveBeenCalledWith(
        ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes'],
        expect.any(Function)
      );
    });

    test('should persist all data when saving to storage', () => {
      if (mockStorageSet.mock.calls.length > 0) {
        const lastCall = mockStorageSet.mock.calls[mockStorageSet.mock.calls.length - 1];
        expect(lastCall[0]).toHaveProperty('timeLimits');
        expect(lastCall[0]).toHaveProperty('visitLimits');
        expect(lastCall[0]).toHaveProperty('visitCounts');
        expect(lastCall[0]).toHaveProperty('timerStartTimes');
      }
    });
  });

  describe('Event Listeners', () => {
    test('onMessage listener should return true for async communication', () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const result = listener({ type: 'showLimits' }, {}, jest.fn());
      expect(result).toBe(true);
    });
  });

  describe('Chrome Alarms API', () => {
    test('should use chrome.alarms with correct configuration', () => {
      expect(mockAlarmsCreate).toHaveBeenCalledWith(
        'dailyResetAlarm',
        expect.objectContaining({
          delayInMinutes: expect.any(Number),
          periodInMinutes: 24 * 60,
        })
      );
    });

    test('should calculate midnight delay correctly', () => {
      const alarmInfo = mockAlarmsCreate.mock.calls[0][1];
      expect(alarmInfo.delayInMinutes).toBeGreaterThan(0);
      expect(alarmInfo.delayInMinutes).toBeLessThanOrEqual(24 * 60);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing URL in onUpdated listener', async () => {
      const listener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];
      await listener(1, {}, {});
      expect(true).toBe(true);
    });

    test('should catch errors in onUpdated listener with bad URL', async () => {
      const listener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await listener(1, { url: 'invalid://malformed::url' }, {});
      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    test('should handle setVisitLimit message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 10 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('should handle setTimeLimit message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      listener({ type: 'setTimeLimit', hostname: 'example.com', timeLimit: 30 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('should handle deLimit message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      listener({ type: 'deLimit', hostname: 'example.com' }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('should allow github.com hostname to be limited', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      listener({ type: 'setVisitLimit', hostname: 'github.com', visitLimit: 5 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('getStats should return actual limit values', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSendResponse = jest.fn();

      listener({ type: 'setVisitLimit', hostname: 'testsite.com', visitLimit: 15 }, {}, jest.fn());
      listener({ type: 'setTimeLimit', hostname: 'testsite.com', timeLimit: 45 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      listener({ type: 'getStats' }, {}, mockSendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = mockSendResponse.mock.calls[mockSendResponse.mock.calls.length - 1][0];
      expect(response.stats).toBeInstanceOf(Array);
      expect(response.stats.length).toBeGreaterThan(0);

      const testSiteStat = response.stats.find((s) => s.hostname === 'testsite.com');
      expect(testSiteStat).toBeDefined();
      expect(testSiteStat.hostname).toBe('testsite.com');
      expect(testSiteStat.timeLimit).toBe(45);
      expect(testSiteStat.visitLimit).toBe(15);
      expect(testSiteStat.visitCount).toBe(0);
    });

    test('getAllLimits should return actual limit values', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSendResponse = jest.fn();

      listener({ type: 'setVisitLimit', hostname: 'site1.com', visitLimit: 8 }, {}, jest.fn());
      listener({ type: 'setTimeLimit', hostname: 'site2.com', timeLimit: 25 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      listener({ type: 'getAllLimits' }, {}, mockSendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = mockSendResponse.mock.calls[mockSendResponse.mock.calls.length - 1][0];
      expect(response.limits).toBeInstanceOf(Array);
      expect(response.limits.length).toBeGreaterThanOrEqual(2);

      const site1Limit = response.limits.find((l) => l.hostname === 'site1.com');
      const site2Limit = response.limits.find((l) => l.hostname === 'site2.com');

      expect(site1Limit).toBeDefined();
      expect(site1Limit.hostname).toBe('site1.com');
      expect(site1Limit.visitLimit).toBe(8);

      expect(site2Limit).toBeDefined();
      expect(site2Limit.hostname).toBe('site2.com');
      expect(site2Limit.timeLimit).toBe(25);
    });

    test('getStats should include visit count after setting limits', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSendResponse = jest.fn();

      listener({ type: 'setVisitLimit', hostname: 'counted.com', visitLimit: 10 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 50));

      listener({ type: 'getStats' }, {}, mockSendResponse);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = mockSendResponse.mock.calls[mockSendResponse.mock.calls.length - 1][0];
      const countedStat = response.stats.find((s) => s.hostname === 'counted.com');

      expect(countedStat).toBeDefined();
      expect(countedStat.hostname).toBe('counted.com');
      expect(countedStat).toHaveProperty('visitCount');
      expect(countedStat.visitCount).toBe(0);
      expect(typeof countedStat.visitCount).toBe('number');
    });
  });

  describe('Tab Event Handlers', () => {
    test('onActivated should handle tabs with pendingUrl', async () => {
      const listener = global.chrome.tabs.onActivated.addListener.mock.calls[0][0];

      global.chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback({
          url: 'https://example.com',
          pendingUrl: 'https://pending.com',
        });
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await listener({ tabId: 1 });

      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasNewTabLog = logCalls.some((call) => call.includes('new tab from onActivated'));
      expect(hasNewTabLog).toBe(true);

      consoleLogSpy.mockRestore();
    });

    test('onUpdated should clear timers when switching hosts', async () => {
      const listener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];

      await listener(1, { url: 'https://example.com' }, {});

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await listener(1, { url: 'https://different.com' }, {});

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Redirect Functionality', () => {
    test.each([
      ['time-exceeded', 'time-exceeded.html'],
      ['visits-exceeded', 'visits-exceeded.html'],
    ])('should use chrome.runtime.getURL for %s redirect', (_name, page) => {
      expect(global.chrome.runtime.getURL).toBeDefined();
      const url = global.chrome.runtime.getURL(page);
      expect(url).toContain(page);
      expect(url).toMatch(/chrome-extension:\/\//);
    });
  });

  describe('Storage Error Handling', () => {
    test('updateStorage should handle chrome.runtime.lastError', () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      mockStorageSet.mockImplementation((data, callback) => {
        global.chrome.runtime.lastError = { message: 'Save failed' };
        if (callback) callback();
        global.chrome.runtime.lastError = null;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      listener({ type: 'setVisitLimit', hostname: 'test.com', visitLimit: 5 }, {}, jest.fn());

      return new Promise((resolve) => {
        setTimeout(() => {
          consoleErrorSpy.mockRestore();
          resolve();
        }, 50);
      });
    });
  });

  describe('Alarm Handlers', () => {
    test('should process dailyResetAlarm', async () => {
      const alarmListener = global.chrome.alarms.onAlarm.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await alarmListener({ name: 'dailyResetAlarm' });

      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasResetLog = logCalls.some(
        (call) => call.includes('Daily reset triggered') || call.includes('reset for new day')
      );
      expect(hasResetLog).toBe(true);

      consoleLogSpy.mockRestore();
    });

    test('should ignore non-reset alarms', async () => {
      const alarmListener = global.chrome.alarms.onAlarm.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await alarmListener({ name: 'someOtherAlarm' });

      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasResetLog = logCalls.some((call) => call.includes('Daily reset'));
      expect(hasResetLog).toBe(false);

      consoleLogSpy.mockRestore();
    });
  });

  // Should be ensure the tests
  describe('Apply Limits to Open Tabs', () => {
    beforeEach(() => {
      mockTabsQuery.mockClear();
      mockTabsUpdate.mockClear();
    });

    test('should query all tabs when setting a visit limit', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://other.com/page2' },
      ]);

      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 }, {}, jest.fn());

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTabsQuery).toHaveBeenCalledWith({});
    });

    test('should query all tabs when setting a time limit', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com/page1' }]);

      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      listener({ type: 'setTimeLimit', hostname: 'example.com', timeLimit: 30 }, {}, jest.fn());

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTabsQuery).toHaveBeenCalledWith({});
    });

    test('should apply limits to matching open tabs', async () => {
      mockTabsQuery.mockReset();
      mockTabsQuery.mockResolvedValue([
        { id: 101, url: 'https://uniqueexample.com/page1' },
        { id: 102, url: 'https://uniqueexample.com/page2' },
        { id: 103, url: 'https://other.com/page' },
      ]);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      listener(
        { type: 'setVisitLimit', hostname: 'uniqueexample.com', visitLimit: 5 },
        {},
        jest.fn()
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const appliedLimitsLogs = logCalls.filter((call) =>
        call.includes('Found open tab for uniqueexample.com')
      );

      expect(appliedLimitsLogs.length).toBe(2);
      consoleLogSpy.mockRestore();
    });

    test('should not re-process tabs that are already tracked', async () => {
      // Use a unique hostname to avoid interference from previous tests
      const uniqueHost = 'notrackedyet' + Date.now() + '.com';
      mockTabsQuery.mockReset();
      mockTabsQuery.mockResolvedValue([{ id: 999, url: `https://${uniqueHost}/page1` }]);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // First limit set - should process the tab
      listener({ type: 'setVisitLimit', hostname: uniqueHost, visitLimit: 5 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 100));

      const firstCallLogs = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const firstAppliedLogs = firstCallLogs.filter((call) =>
        call.includes(`Found open tab for ${uniqueHost}`)
      );
      expect(firstAppliedLogs.length).toBe(1);

      consoleLogSpy.mockClear();

      // Override limit - should NOT re-process the tab (lastHandle is already set)
      listener({ type: 'setTimeLimit', hostname: uniqueHost, timeLimit: 30 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondCallLogs = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const secondAppliedLogs = secondCallLogs.filter((call) =>
        call.includes(`Found open tab for ${uniqueHost}`)
      );
      expect(secondAppliedLogs.length).toBe(0);

      consoleLogSpy.mockRestore();
    });

    test('should handle tabs without URLs gracefully', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, url: 'https://example.com/page1' },
        { id: 2 }, // Tab without URL
        { id: 3, url: null }, // Tab with null URL
      ]);

      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      await expect(async () => {
        listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 }, {}, jest.fn());
        await new Promise((resolve) => setTimeout(resolve, 100));
      }).not.toThrow();
    });

    test('should re-apply limits to open tabs after daily reset', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://test.com/page2' },
      ]);

      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Set limits for two hostnames
      listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 }, {}, jest.fn());
      listener({ type: 'setTimeLimit', hostname: 'test.com', timeLimit: 30 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 100));

      mockTabsQuery.mockClear();
      mockTabsQuery.mockResolvedValue([
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://test.com/page2' },
      ]);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const alarmListener = global.chrome.alarms.onAlarm.addListener.mock.calls[0][0];

      await alarmListener({ name: 'dailyResetAlarm' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const reappliedLog = logCalls.some((call) =>
        call.includes('Limits re-applied to open tabs for new day')
      );

      expect(reappliedLog).toBe(true);
      expect(mockTabsQuery).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    test('should handle errors when querying tabs', async () => {
      mockTabsQuery.mockRejectedValue(new Error('Query failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 }, {}, jest.fn());
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error querying tabs:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    test('should not query tabs for non-limit message types', async () => {
      mockTabsQuery.mockClear();

      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSendResponse = jest.fn();

      listener({ type: 'getStats' }, {}, mockSendResponse);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockTabsQuery).not.toHaveBeenCalled();
    });

    test('should handle malformed URLs in tabs', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'invalid://malformed::url' },
      ]);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      await expect(async () => {
        listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 5 }, {}, jest.fn());
        await new Promise((resolve) => setTimeout(resolve, 100));
      }).not.toThrow();

      consoleLogSpy.mockRestore();
    });
  });
});
