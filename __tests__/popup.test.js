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

const html = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');

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
    
    // Mock window.alert and console.log to avoid noise
    global.alert = jest.fn();
    global.console.log = jest.fn();

    // Reset modules to reload popup.js for each test
    jest.resetModules();

    // Load the script
    // This executes the code in popup.js which attaches event listeners
    // Use a timestamp to force re-execution if jest.resetModules isn't enough for native ESM
    await import(`../popup.js?t=${Date.now()}`);
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
        timeLimit: '30'
      });
      
      // Check message update
      const messageEl = document.getElementById('message');
      expect(messageEl.hidden).toBe(false);
      expect(messageEl.textContent).toContain('30 sec');
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
        visitLimit: '5'
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
        timeLimit: '60'
      });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'setVisitLimit',
        hostname: 'facebook.com',
        visitLimit: '10'
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
    test('ShowLimits button should request limits', async () => {
      const btn = document.getElementById('ShowLimits');
      
      // Mock the response for the async showLimits call
      mockChrome.runtime.sendMessage.mockResolvedValue({ limits: 'Current limits: ...' });
      
      btn.click();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'showLimits'
      });

      // Since the click handler is async, we need to wait a tick
      await Promise.resolve();
      
      const messageEl = document.getElementById('message');
      expect(messageEl.textContent).toBe('Current limits: ...');
    });

    test('DeleteLimits button should send deLimit message', () => {
      const btn = document.getElementById('DeleteLimits');
      const hostnameInput = document.getElementById('hostname');
      
      hostnameInput.value = 'todelete.com';
      
      btn.click();
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'deLimit',
        hostname: 'todelete.com'
      });
      
      expect(global.alert).toHaveBeenCalled();
    });
  });
});
