/**
 * Unit tests for popup.js
 * Testing UI and message handling functionality with real DOM
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = fs.readFileSync(path.resolve(__dirname, '../extension/popup.html'), 'utf8');

describe('LiLimit Popup', () => {
  let mockChrome;

  beforeEach(async () => {
    // Reset DOM
    document.documentElement.innerHTML = html.toString();

    // Mock Chrome API
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
      },
    };
    global.chrome = mockChrome;

    // Mock window.alert, console.log, and confirm to avoid noise
    global.alert = jest.fn();
    global.console.log = jest.fn();
    global.confirm = jest.fn(() => true);

    // Reset modules to reload popup.js for each test
    jest.resetModules();

    // Load the script
    await import(`../extension/popup.js?t=${Date.now()}`);

    // Manually trigger DOMContentLoaded since it doesn't fire in tests
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Interaction', () => {
    test('should send limitTime message when only timeLimit is provided', () => {
      const hostnameInput = document.getElementById('hostname');
      const timeLimitInput = document.getElementById('timeLimit');
      const form = document.getElementById('limitsForm');

      hostnameInput.value = 'example.com';
      timeLimitInput.value = '30';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setTimeLimit',
        hostname: 'example.com',
        timeLimit: '30',
      });

      // Check message update
      const messageEl = document.getElementById('message');
      expect(messageEl.hidden).toBe(false);
      expect(messageEl.textContent).toContain('30 minutes');
      expect(messageEl.textContent).toContain('No limit visits');
    });

    test('should send limitVisit message when only visitLimit is provided', () => {
      const hostnameInput = document.getElementById('hostname');
      const visitLimitInput = document.getElementById('visitLimit');
      const form = document.getElementById('limitsForm');

      hostnameInput.value = 'example.com';
      visitLimitInput.value = '5';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setVisitLimit',
        hostname: 'example.com',
        visitLimit: '5',
      });

      const messageEl = document.getElementById('message');
      expect(messageEl.textContent).toContain('No limit time');
      expect(messageEl.textContent).toContain('5 visits');
    });

    test('should send both messages when both limits are provided', () => {
      const hostnameInput = document.getElementById('hostname');
      const timeLimitInput = document.getElementById('timeLimit');
      const visitLimitInput = document.getElementById('visitLimit');
      const form = document.getElementById('limitsForm');

      hostnameInput.value = 'facebook.com';
      timeLimitInput.value = '60';
      visitLimitInput.value = '10';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setTimeLimit',
        hostname: 'facebook.com',
        timeLimit: '60',
      });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setVisitLimit',
        hostname: 'facebook.com',
        visitLimit: '10',
      });
    });

    test('should show no limits message when submitting empty form', () => {
      const hostnameInput = document.getElementById('hostname');
      const form = document.querySelector('form');

      hostnameInput.value = 'test.com';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
      const messageEl = document.getElementById('message');
      expect(messageEl.textContent).toBe('No limits applied on test.com');
    });
  });

  describe('Buttons', () => {
    test('DeleteLimits button should send deLimit message', () => {
      const btn = document.getElementById('DeleteLimits');
      const hostnameInput = document.getElementById('hostname');

      hostnameInput.value = 'todelete.com';

      btn.click();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'deLimit',
        hostname: 'todelete.com',
      });

      expect(global.alert).toHaveBeenCalled();
    });
  });

  describe('Tab Switching', () => {
    test('should initialize with Set Limits tab active', () => {
      const setLimitsTab = document.getElementById('set-limits');
      const statsTab = document.getElementById('stats');
      const allLimitsTab = document.getElementById('all-limits');

      expect(setLimitsTab.classList.contains('active')).toBe(true);
      expect(statsTab.classList.contains('active')).toBe(false);
      expect(allLimitsTab.classList.contains('active')).toBe(false);
    });

    test('should switch to Live Stats tab when clicked', () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();

      const setLimitsTab = document.getElementById('set-limits');
      const statsTab = document.getElementById('stats');

      expect(setLimitsTab.classList.contains('active')).toBe(false);
      expect(statsTab.classList.contains('active')).toBe(true);
    });

    test('should switch to All Limits tab when clicked', () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: [] });

      allLimitsButton.click();

      const setLimitsTab = document.getElementById('set-limits');
      const allLimitsTab = document.getElementById('all-limits');

      expect(setLimitsTab.classList.contains('active')).toBe(false);
      expect(allLimitsTab.classList.contains('active')).toBe(true);
    });
  });

  describe('Live Stats Display', () => {
    test('should load stats when Stats tab is clicked', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getStats' });
    });

    test('should display empty state when no stats available', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();
      await Promise.resolve();

      const statsContent = document.getElementById('statsContent');
      expect(statsContent.innerHTML).toContain('No activity yet today');
    });

    test('should display stats cards with progress bars', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        stats: [
          {
            hostname: 'example.com',
            timeLimit: 30,
            visitLimit: 5,
            visitCount: 3,
          },
        ],
      });

      statsButton.click();
      await Promise.resolve();

      const statsContent = document.getElementById('statsContent');
      expect(statsContent.innerHTML).toContain('example.com');
      expect(statsContent.innerHTML).toContain('30 min');
      expect(statsContent.innerHTML).toContain('3 / 5');
      expect(statsContent.innerHTML).toContain('progress-bar');
    });

    test('should apply correct color to progress bar based on percentage', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        stats: [
          {
            hostname: 'example.com',
            visitLimit: 10,
            visitCount: 9, // 90% - should be danger
          },
        ],
      });

      statsButton.click();
      await Promise.resolve();

      const statsContent = document.getElementById('statsContent');
      expect(statsContent.innerHTML).toContain('danger');
    });

    test('should handle stats load error gracefully', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Load failed'));

      statsButton.click();
      await Promise.resolve();
      await Promise.resolve(); // Extra tick for error handling

      const statsContent = document.getElementById('statsContent');
      expect(statsContent.innerHTML).toContain('Failed to load stats');
    });
  });

  describe('All Limits Display', () => {
    test('should load limits when All Limits tab is clicked', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: [] });

      allLimitsButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getAllLimits' });
    });

    test('should display empty state when no limits set', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: [] });

      allLimitsButton.click();
      await Promise.resolve();

      const limitsContent = document.getElementById('limitsContent');
      expect(limitsContent.innerHTML).toContain('No limits set yet');
    });

    test('should display limit cards with time and visit limits', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [
          {
            hostname: 'example.com',
            timeLimit: 30,
            visitLimit: 5,
          },
        ],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const limitsContent = document.getElementById('limitsContent');
      expect(limitsContent.innerHTML).toContain('example.com');
      expect(limitsContent.innerHTML).toContain('30 minutes per visit');
      expect(limitsContent.innerHTML).toContain('5 visits per day');
    });

    test('should display multiple limit cards', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [
          { hostname: 'example.com', timeLimit: 30, visitLimit: 5 },
          { hostname: 'test.com', timeLimit: 60, visitLimit: 10 },
        ],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const limitsContent = document.getElementById('limitsContent');
      expect(limitsContent.innerHTML).toContain('example.com');
      expect(limitsContent.innerHTML).toContain('test.com');
    });
  });

  describe('Search Functionality', () => {
    test('should filter limits based on search input', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [
          { hostname: 'example.com', timeLimit: 30 },
          { hostname: 'test.com', timeLimit: 60 },
        ],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const searchInput = document.getElementById('searchLimits');
      searchInput.value = 'example';
      searchInput.dispatchEvent(new Event('input'));

      const limitsContent = document.getElementById('limitsContent');
      expect(limitsContent.innerHTML).toContain('example.com');
      expect(limitsContent.innerHTML).not.toContain('test.com');
    });

    test('should show empty state when search has no results', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const searchInput = document.getElementById('searchLimits');
      searchInput.value = 'nonexistent';
      searchInput.dispatchEvent(new Event('input'));

      const limitsContent = document.getElementById('limitsContent');
      expect(limitsContent.innerHTML).toContain('No matching limits found');
    });
  });

  describe('Refresh Stats Button', () => {
    test('should refresh stats when button is clicked', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();
      await Promise.resolve();

      mockChrome.runtime.sendMessage.mockClear();

      const refreshButton = document.getElementById('refreshStats');
      refreshButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getStats' });
    });

    test('should add spinning class to refresh button when clicked', () => {
      const statsButton = document.querySelector('[data-tab="stats"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();

      const refreshButton = document.getElementById('refreshStats');
      refreshButton.click();

      expect(refreshButton.classList.contains('spinning')).toBe(true);
    });
  });

  describe('Delete Limit from Card', () => {
    test('should delete limit when delete button in card is clicked', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      global.confirm = jest.fn(() => true);

      mockChrome.runtime.sendMessage.mockResolvedValueOnce({ success: true });

      const deleteButton = document.querySelector('.delete-limit-btn');
      const limitCard = deleteButton.closest('.limit-card');

      deleteButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'deLimit',
        hostname: 'example.com',
      });

      expect(limitCard.parentNode).toBeNull();
    });

    test('should not delete limit when user cancels confirmation', async () => {
      const allLimitsButton = document.querySelector('[data-tab="all-limits"]');
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      mockChrome.runtime.sendMessage.mockClear();
      global.confirm = jest.fn(() => false);

      const deleteButton = document.querySelector('.delete-limit-btn');
      deleteButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deLimit' })
      );
    });
  });
});
