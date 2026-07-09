/**
 * Unit tests for popup.ts
 * Testing UI and message handling functionality with real DOM
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MessageResponse } from '../src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = fs.readFileSync(path.resolve(__dirname, '../public/popup.html'), 'utf8');

interface MockChrome {
  runtime: {
    sendMessage: jest.MockedFunction<(message: unknown) => Promise<MessageResponse>>;
  };
}

describe('LiLimit Popup', () => {
  let mockChrome: MockChrome;

  beforeEach(async () => {
    document.documentElement.innerHTML = html.toString();

    mockChrome = {
      runtime: {
        sendMessage: jest.fn<(message: unknown) => Promise<MessageResponse>>(),
      },
    };

    // Override global chrome with our mock
    Object.defineProperty(global, 'chrome', {
      value: mockChrome,
      writable: true,
      configurable: true,
    });

    // Override global functions for testing
    Object.defineProperty(global, 'alert', {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global, 'confirm', {
      value: jest.fn(() => true),
      writable: true,
      configurable: true,
    });

    global.console.log = jest.fn();

    jest.resetModules();

    await import(`../src/popup/popup.ts?t=${Date.now()}`);

    document.dispatchEvent(new Event('DOMContentLoaded'));
    mockChrome.runtime.sendMessage.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Interaction', () => {
    test('should send limitTime message when only timeLimit is provided', () => {
      const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
      const timeLimitInput = document.getElementById('timeLimit') as HTMLInputElement;
      const form = document.getElementById('limitsForm') as HTMLFormElement;

      hostnameInput.value = 'example.com';
      timeLimitInput.value = '30';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setTimeLimit',
        hostname: 'example.com',
        timeLimit: '30',
      });

      const messageEl = document.getElementById('message') as HTMLElement;
      expect(messageEl.hidden).toBe(false);
      expect(messageEl.textContent).toContain('30 minutes');
      expect(messageEl.textContent).toContain('No limit visits');
    });

    test('should send limitVisit message when only visitLimit is provided', () => {
      const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
      const visitLimitInput = document.getElementById('visitLimit') as HTMLInputElement;
      const form = document.getElementById('limitsForm') as HTMLFormElement;

      hostnameInput.value = 'example.com';
      visitLimitInput.value = '5';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setVisitLimit',
        hostname: 'example.com',
        visitLimit: '5',
      });

      const messageEl = document.getElementById('message') as HTMLElement;
      expect(messageEl.textContent).toContain('No limit time');
      expect(messageEl.textContent).toContain('5 visits');
    });

    test('should send both messages when both limits are provided', () => {
      const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
      const timeLimitInput = document.getElementById('timeLimit') as HTMLInputElement;
      const visitLimitInput = document.getElementById('visitLimit') as HTMLInputElement;
      const form = document.getElementById('limitsForm') as HTMLFormElement;

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
      const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
      const form = document.querySelector('form') as HTMLFormElement;

      hostnameInput.value = 'test.com';

      form.dispatchEvent(new Event('submit'));

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
      const messageEl = document.getElementById('message') as HTMLElement;
      expect(messageEl.textContent).toBe('No limits applied on test.com');
    });
  });

  describe('Buttons', () => {
    test('DeleteLimits button should send deLimit message', () => {
      const btn = document.getElementById('DeleteLimits') as HTMLButtonElement;
      const hostnameInput = document.getElementById('hostname') as HTMLInputElement;

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
    test('should initialize with Time Left tab active', () => {
      const timeLeftTab = document.getElementById('time-left') as HTMLElement;
      const setLimitsTab = document.getElementById('set-limits') as HTMLElement;
      const statsTab = document.getElementById('stats') as HTMLElement;
      const allLimitsTab = document.getElementById('all-limits') as HTMLElement;

      expect(timeLeftTab.classList.contains('active')).toBe(true);
      expect(setLimitsTab.classList.contains('active')).toBe(false);
      expect(statsTab.classList.contains('active')).toBe(false);
      expect(allLimitsTab.classList.contains('active')).toBe(false);
    });

    test('should switch to Live Stats tab when clicked', () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();

      const setLimitsTab = document.getElementById('set-limits') as HTMLElement;
      const statsTab = document.getElementById('stats') as HTMLElement;

      expect(setLimitsTab.classList.contains('active')).toBe(false);
      expect(statsTab.classList.contains('active')).toBe(true);
    });

    test('should switch to All Limits tab when clicked', () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: [] });

      allLimitsButton.click();

      const setLimitsTab = document.getElementById('set-limits') as HTMLElement;
      const allLimitsTab = document.getElementById('all-limits') as HTMLElement;

      expect(setLimitsTab.classList.contains('active')).toBe(false);
      expect(allLimitsTab.classList.contains('active')).toBe(true);
    });
  });

  describe('Live Stats Display', () => {
    test('should load stats when Stats tab is clicked', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getStats' });
    });

    test('should display empty state when no stats available', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();
      await Promise.resolve();

      const statsContent = document.getElementById('statsContent') as HTMLElement;
      expect(statsContent.innerHTML).toContain('No activity yet today');
    });

    test('should display stats cards with segmented progress bar', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
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

      const statsContent = document.getElementById('statsContent') as HTMLElement;
      expect(statsContent.innerHTML).toContain('example.com');
      expect(statsContent.innerHTML).toContain('30 min');
      expect(statsContent.innerHTML).toContain('3/5');
      expect(statsContent.innerHTML).toContain('progress-bar');
      expect(statsContent.innerHTML).toContain('progress-fill');
      expect(statsContent.innerHTML).toContain('progress-segment');
    });

    test('should apply correct color to progress bar based on percentage', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        stats: [
          {
            hostname: 'example.com',
            visitLimit: 10,
            visitCount: 9,
          },
        ],
      });

      statsButton.click();
      await Promise.resolve();

      const statsContent = document.getElementById('statsContent') as HTMLElement;
      expect(statsContent.innerHTML).toContain('warning');
    });

    test('should handle stats load error gracefully', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Load failed'));

      statsButton.click();
      await Promise.resolve();

      const statsContent = document.getElementById('statsContent') as HTMLElement;
      expect(statsContent.innerHTML).toContain('Failed to load stats');
    });
  });

  describe('All Limits Display', () => {
    test('should load limits when All Limits tab is clicked', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: [] });

      allLimitsButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getAllLimits' });
    });

    test('should display empty state when no limits set', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: [] });

      allLimitsButton.click();
      await Promise.resolve();

      const limitsContent = document.getElementById('limitsContent') as HTMLElement;
      expect(limitsContent.innerHTML).toContain('No limits set yet');
    });

    test('should display limit cards with time and visit limits', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
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

      const limitsContent = document.getElementById('limitsContent') as HTMLElement;
      const timeLimitInput = limitsContent.querySelector('.limit-time-input') as HTMLInputElement;
      expect(limitsContent.innerHTML).toContain('example.com');
      expect(timeLimitInput.value).toBe('30');
      expect(limitsContent.innerHTML).toContain('minutes per visit');
      expect(limitsContent.innerHTML).toContain('5 visits per day');
    });

    test('should update a time limit from the all limits card', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30, visitLimit: 5 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      mockChrome.runtime.sendMessage.mockClear();
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      const timeLimitInput = document.querySelector('.limit-time-input') as HTMLInputElement;
      const saveButton = document.querySelector('.save-limit-btn') as HTMLButtonElement;

      timeLimitInput.value = '45';
      saveButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setTimeLimit',
        hostname: 'example.com',
        timeLimit: 45,
      });
      expect((document.querySelector('.limit-time-input') as HTMLInputElement).value).toBe('45');
      expect(document.getElementById('message')?.textContent).toBe(
        'Time limit updated for example.com'
      );
    });

    test('should display multiple limit cards', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [
          { hostname: 'example.com', timeLimit: 30, visitLimit: 5 },
          { hostname: 'test.com', timeLimit: 60, visitLimit: 10 },
        ],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const limitsContent = document.getElementById('limitsContent') as HTMLElement;
      expect(limitsContent.innerHTML).toContain('example.com');
      expect(limitsContent.innerHTML).toContain('test.com');
    });
  });

  describe('Search Functionality', () => {
    test('should filter limits based on search input', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [
          { hostname: 'example.com', timeLimit: 30 },
          { hostname: 'test.com', timeLimit: 60 },
        ],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const searchInput = document.getElementById('searchLimits') as HTMLInputElement;
      searchInput.value = 'example';
      searchInput.dispatchEvent(new Event('input'));

      const limitsContent = document.getElementById('limitsContent') as HTMLElement;
      expect(limitsContent.innerHTML).toContain('example.com');
      expect(limitsContent.innerHTML).not.toContain('test.com');
    });

    test('should show empty state when search has no results', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      const searchInput = document.getElementById('searchLimits') as HTMLInputElement;
      searchInput.value = 'nonexistent';
      searchInput.dispatchEvent(new Event('input'));

      const limitsContent = document.getElementById('limitsContent') as HTMLElement;
      expect(limitsContent.innerHTML).toContain('No matching limits found');
    });
  });

  describe('Refresh Stats Button', () => {
    test('should refresh stats when button is clicked', async () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();
      await Promise.resolve();

      mockChrome.runtime.sendMessage.mockClear();

      const refreshButton = document.getElementById('refreshStats') as HTMLButtonElement;
      refreshButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getStats' });
    });

    test('should add spinning class to refresh button when clicked', () => {
      const statsButton = document.querySelector('[data-tab="stats"]') as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({ stats: [] });

      statsButton.click();

      const refreshButton = document.getElementById('refreshStats') as HTMLButtonElement;
      refreshButton.click();

      expect(refreshButton.classList.contains('spinning')).toBe(true);
    });
  });

  describe('Delete Limit from Card', () => {
    test('should delete limit when delete button in card is clicked', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      global.confirm = jest.fn(() => true);

      mockChrome.runtime.sendMessage.mockResolvedValueOnce({ success: true });

      const deleteButton = document.querySelector('.delete-limit-btn') as HTMLButtonElement;
      const limitCard = deleteButton.closest('.limit-card') as HTMLElement;

      deleteButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'deLimit',
        hostname: 'example.com',
      });

      expect(limitCard.parentNode).toBeNull();
    });

    test('should not delete limit when user cancels confirmation', async () => {
      const allLimitsButton = document.querySelector(
        '[data-tab="all-limits"]'
      ) as HTMLButtonElement;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      allLimitsButton.click();
      await Promise.resolve();

      mockChrome.runtime.sendMessage.mockClear();
      global.confirm = jest.fn(() => false);

      const deleteButton = document.querySelector('.delete-limit-btn') as HTMLButtonElement;
      deleteButton.click();

      await Promise.resolve();

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deLimit' })
      );
    });
  });
});
