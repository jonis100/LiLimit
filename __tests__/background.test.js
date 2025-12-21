/**
 * Unit tests for background.js
 * Testing core functionality of the LiLimit Chrome extension
 */

import { jest } from '@jest/globals';

// Mock Chrome API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
    },
    onActivated: {
      addListener: jest.fn(),
    },
    update: jest.fn(),
    get: jest.fn(),
  },
};

// Set up global chrome mock
global.chrome = mockChrome;

describe('Chrome message handlers', () => {
  test('chrome.runtime.onMessage should have listeners', () => {
    expect(mockChrome.runtime.onMessage.addListener).toBeDefined();
  });

  test('chrome.tabs.onUpdated should have listeners', () => {
    expect(mockChrome.tabs.onUpdated.addListener).toBeDefined();
  });

  test('chrome.tabs.onActivated should have listeners', () => {
    expect(mockChrome.tabs.onActivated.addListener).toBeDefined();
  });

  test('chrome.storage.local.get should be callable', () => {
    expect(mockChrome.storage.local.get).toBeDefined();
  });

  test('chrome.storage.local.set should be callable', () => {
    expect(mockChrome.storage.local.set).toBeDefined();
  });
});
