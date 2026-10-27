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

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  describe('Settings Toggles', () => {
    test('should load tabSwitchCountsAsVisit when opening settings', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        settings: { dailyTimeLimit: false, tabSwitchCountsAsVisit: true },
      });

      (document.getElementById('settingsBtn') as HTMLButtonElement).click();
      await Promise.resolve();

      const toggle = document.getElementById('tabSwitchCountsAsVisit') as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });

    test('should save tabSwitchCountsAsVisit when its row is clicked', () => {
      const toggle = document.getElementById('tabSwitchCountsAsVisit') as HTMLInputElement;
      toggle.checked = false;

      (document.getElementById('tabSwitchCountsAsVisitRow') as HTMLElement).click();

      expect(toggle.checked).toBe(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setSettings',
        settings: { tabSwitchCountsAsVisit: true },
      });
    });
  });

  describe('Time Left', () => {
    const item = { hostname: 'example.com', timeLimit: 10, remainingMs: 300000, spentMs: 300000 };

    async function openTimeLeft(response: MessageResponse): Promise<HTMLElement> {
      mockChrome.runtime.sendMessage.mockResolvedValue(response);
      (document.querySelector('[data-tab="time-left"]') as HTMLButtonElement).click();
      await flushPromises();
      return document.getElementById('timeLeftContent') as HTMLElement;
    }

    test('should show the active badge only for sites with a running timer', async () => {
      const content = await openTimeLeft({
        timeLeft: [
          { ...item, isActive: true },
          { ...item, hostname: 'idle.com', isActive: false },
        ],
        dailyTimeLimit: true,
      });

      const cards = content.querySelectorAll('.time-left-card');
      expect(cards).toHaveLength(2);
      const active = Array.from(cards).filter((card) =>
        card.querySelector('.time-left-status.active')
      );
      expect(active.map((card) => card.getAttribute('data-hostname'))).toEqual(['example.com']);
    });

    test('should title the tab by budget mode', async () => {
      const title = document.querySelector('.time-left-title') as HTMLElement;

      await openTimeLeft({ timeLeft: [{ ...item, isActive: true }], dailyTimeLimit: true });
      expect(title.textContent).toBe('Time Left Today');

      await openTimeLeft({ timeLeft: [{ ...item, isActive: true }], dailyTimeLimit: false });
      expect(title.textContent).toBe('Time Left This Visit');
    });

    test('should escape hostnames before rendering them', async () => {
      const content = await openTimeLeft({
        timeLeft: [{ ...item, hostname: '<img src=x onerror=alert(1)>', isActive: false }],
        dailyTimeLimit: true,
      });

      expect(content.querySelector('img')).toBeNull();
      expect(content.textContent).toContain('<img src=x onerror=alert(1)>');
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

    test('should only offer time limit editing for sites that have a time limit', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'visitsonly.com', visitLimit: 5 }],
      });

      (document.querySelector('[data-tab="all-limits"]') as HTMLButtonElement).click();
      await flushPromises();

      expect(document.getElementById('limitsContent')?.innerHTML).toContain('visitsonly.com');
      expect(document.querySelector('.limit-time-input')).toBeNull();
    });

    test('should label the edit row per day when the daily budget mode is on', async () => {
      (document.getElementById('dailyTimeLimit') as HTMLInputElement).checked = true;
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30 }],
      });

      (document.querySelector('[data-tab="all-limits"]') as HTMLButtonElement).click();
      await flushPromises();

      expect(document.querySelector('.limit-edit-unit')?.textContent).toBe('minutes per day');
    });

    test('should remove only the time limit when the field is cleared', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        limits: [{ hostname: 'example.com', timeLimit: 30, visitLimit: 5 }],
      });
      (document.querySelector('[data-tab="all-limits"]') as HTMLButtonElement).click();
      await flushPromises();

      mockChrome.runtime.sendMessage.mockClear();
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
      (document.querySelector('.limit-time-input') as HTMLInputElement).value = '';
      (document.querySelector('.save-limit-btn') as HTMLButtonElement).click();
      await flushPromises();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'removeTimeLimit',
        hostname: 'example.com',
      });
      const content = document.getElementById('limitsContent')?.innerHTML ?? '';
      expect(content).toContain('example.com');
      expect(content).toContain('5 visits per day');
      expect(document.querySelector('.limit-time-input')).toBeNull();
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
