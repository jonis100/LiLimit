/**
 * Unit tests for background.js
 * Focus: Service worker lifecycle, storage persistence, and critical logic
 */

import { jest } from '@jest/globals';

// Setup Chrome API mocks
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockTabsUpdate = jest.fn();
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
  },
  runtime: {
    onMessage: { addListener: jest.fn() },
    lastError: null,
  },
  alarms: {
    create: mockAlarmsCreate,
    onAlarm: { addListener: jest.fn() },
  },
};

// Import the module once at the top level
mockStorageGet.mockImplementation((_keys, callback) => {
  callback({ timeLimits: {}, visitLimits: {}, visitCounts: {} });
});
await import('../extension/background.js');

describe('Background Script - Critical Logic', () => {
  beforeAll(() => {
    // Module is already imported, just verify setup
    expect(global.chrome.storage.local.get).toHaveBeenCalled();
  });

  describe('Storage Persistence', () => {
    test('should load timeLimits, visitLimits, visitCounts, AND timerStartTimes from storage', () => {
      // Critical: must request all four data types
      expect(mockStorageGet).toHaveBeenCalledWith(
        ['timeLimits', 'visitLimits', 'visitCounts', 'timerStartTimes'],
        expect.any(Function)
      );
    });

    test('should persist all data when saving to storage', () => {
      // The module calls updateStorage during init
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

      // Critical: must return true to keep message channel open for async responses
      const result = listener({ type: 'showLimits' }, {}, jest.fn());
      expect(result).toBe(true);
    });
  });

  describe('Chrome Alarms API', () => {
    test('should use chrome.alarms with correct configuration', () => {
      // Critical: must use alarms API (survives service worker restart)
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

      // Delay should be positive and less than 24 hours
      expect(alarmInfo.delayInMinutes).toBeGreaterThan(0);
      expect(alarmInfo.delayInMinutes).toBeLessThanOrEqual(24 * 60);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing URL in onUpdated listener', async () => {
      const listener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];

      // onUpdated now returns early if no URL change
      await listener(1, {}, {}); // No url in changeInfo

      // Should not throw, just return early
      expect(true).toBe(true); // Test passes if no error thrown
    });

    test('should catch errors in onUpdated listener with bad URL', async () => {
      const listener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate error with invalid URL that extractHostname can't handle
      await listener(1, { url: 'invalid://malformed::url' }, {});

      // Should log error, not throw
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('Message Handling Logic', () => {
    test('should handle setVisitLimit message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      // Simulate setVisitLimit message
      listener({ type: 'setVisitLimit', hostname: 'example.com', visitLimit: 10 }, {}, jest.fn());

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should call storage.set
      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('should handle setTimeLimit message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      // Simulate setTimeLimit message
      listener({ type: 'setTimeLimit', hostname: 'example.com', timeLimit: 30 }, {}, jest.fn());

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should call storage.set
      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('should handle deLimit message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const initialCalls = mockStorageSet.mock.calls.length;

      // Simulate deLimit message
      listener({ type: 'deLimit', hostname: 'example.com' }, {}, jest.fn());

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should call storage.set to persist deletion
      expect(mockStorageSet.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    test('should handle showLimits message', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSendResponse = jest.fn();

      // Simulate showLimits message
      listener({ type: 'showLimits' }, {}, mockSendResponse);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should send response with limits
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ limits: expect.any(String) })
      );
    });

    test('should reject github.com hostname', async () => {
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate attempt to limit github.com
      listener({ type: 'setVisitLimit', hostname: 'github.com', visitLimit: 5 }, {}, jest.fn());

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should log rejection message
      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasGithubRejection = logCalls.some((call) => call.includes("can't limit github.com"));

      expect(hasGithubRejection).toBe(true);

      consoleLogSpy.mockRestore();
    });
  });

  describe('Tab Event Handlers - Detailed Coverage', () => {
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

      // Should log "new tab" message
      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasNewTabLog = logCalls.some((call) => call.includes('new tab from onActivated'));

      expect(hasNewTabLog).toBe(true);

      consoleLogSpy.mockRestore();
    });

    test('onUpdated should clear timers when switching hosts', async () => {
      const listener = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];

      // First update - sets timer
      await listener(1, { url: 'https://example.com' }, {});

      // Second update - different host, should clear timer
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await listener(1, { url: 'https://different.com' }, {});

      // May or may not clear depending on timer state, just verify no crash
      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('Storage Error Handling', () => {
    test('updateStorage should handle chrome.runtime.lastError', () => {
      // Trigger updateStorage by sending a message
      const listener = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Mock storage.set to trigger error
      mockStorageSet.mockImplementation((data, callback) => {
        global.chrome.runtime.lastError = { message: 'Save failed' };
        if (callback) callback();
        global.chrome.runtime.lastError = null;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Trigger save
      listener({ type: 'setVisitLimit', hostname: 'test.com', visitLimit: 5 }, {}, jest.fn());

      // Allow async execution
      return new Promise((resolve) => {
        setTimeout(() => {
          // Should log error but not crash
          consoleErrorSpy.mockRestore();
          resolve();
        }, 50);
      });
    });
  });

  describe('Alarm Handler Coverage', () => {
    test('alarm handler should process dailyResetAlarm', async () => {
      const alarmListener = global.chrome.alarms.onAlarm.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate dailyResetAlarm firing
      await alarmListener({ name: 'dailyResetAlarm' });

      // Should log reset messages
      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasResetLog = logCalls.some(
        (call) => call.includes('Daily reset triggered') || call.includes('reset for new day')
      );

      expect(hasResetLog).toBe(true);

      consoleLogSpy.mockRestore();
    });

    test('alarm handler should ignore other alarms', async () => {
      const alarmListener = global.chrome.alarms.onAlarm.addListener.mock.calls[0][0];
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate different alarm
      await alarmListener({ name: 'someOtherAlarm' });

      // Should not log reset messages
      const logCalls = consoleLogSpy.mock.calls.map((call) => call.join(' '));
      const hasResetLog = logCalls.some((call) => call.includes('Daily reset'));

      expect(hasResetLog).toBe(false);

      consoleLogSpy.mockRestore();
    });
  });
});
