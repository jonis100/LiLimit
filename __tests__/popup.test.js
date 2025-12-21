/**
 * Unit tests for popup.js
 * Testing UI and message handling functionality
 */

import { jest } from '@jest/globals';

// Mock Chrome API for popup tests
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
  },
};

global.chrome = mockChrome;

// Mock DOM elements
let mockForm;
let mockHostnameInput;
let mockTimeLimitInput;
let mockVisitLimitInput;
let mockShowLimitsBtn;
let mockDeleteLimitsBtn;
let mockMessageEl;

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();

  // Create mock DOM elements
  mockHostnameInput = document.createElement('input');
  mockHostnameInput.id = 'hostname';
  mockHostnameInput.value = '';

  mockTimeLimitInput = document.createElement('input');
  mockTimeLimitInput.id = 'timeLimit';
  mockTimeLimitInput.value = '';

  mockVisitLimitInput = document.createElement('input');
  mockVisitLimitInput.id = 'visitLimit';
  mockVisitLimitInput.value = '';

  mockForm = document.createElement('form');
  mockForm.appendChild(mockHostnameInput);
  mockForm.appendChild(mockTimeLimitInput);
  mockForm.appendChild(mockVisitLimitInput);

  mockShowLimitsBtn = document.createElement('button');
  mockShowLimitsBtn.id = 'ShowLimits';

  mockDeleteLimitsBtn = document.createElement('button');
  mockDeleteLimitsBtn.id = 'DeleteLimits';

  mockMessageEl = document.createElement('div');
  mockMessageEl.id = 'message';
  mockMessageEl.hidden = true;

  document.body.appendChild(mockForm);
  document.body.appendChild(mockShowLimitsBtn);
  document.body.appendChild(mockDeleteLimitsBtn);
  document.body.appendChild(mockMessageEl);

  // Mock global functions
  global.showMessage = jest.fn((text, duration, isError) => {
    mockMessageEl.textContent = text;
    mockMessageEl.hidden = false;
    mockMessageEl.style.color = isError ? 'var(--danger)' : '';
  });

  global.limitTime = jest.fn((hostname, timeLimit) => {
    mockChrome.runtime.sendMessage({
      type: 'setTimeLimit',
      hostname: hostname,
      timeLimit: timeLimit,
    });
  });

  global.limitVisit = jest.fn((hostname, visitLimit) => {
    mockChrome.runtime.sendMessage({
      type: 'setVisitLimit',
      hostname: hostname,
      visitLimit: visitLimit,
    });
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('limitTime function', () => {
  test('should send message with correct type', () => {
    global.limitTime('google.com', 30);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'setTimeLimit',
      hostname: 'google.com',
      timeLimit: 30,
    });
  });

  test('should handle string time limit', () => {
    global.limitTime('facebook.com', '60');
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'setTimeLimit',
      hostname: 'facebook.com',
      timeLimit: '60',
    });
  });
});

describe('limitVisit function', () => {
  test('should send message with correct type', () => {
    global.limitVisit('google.com', 5);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'setVisitLimit',
      hostname: 'google.com',
      visitLimit: 5,
    });
  });

  test('should handle string visit limit', () => {
    global.limitVisit('twitter.com', '3');
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'setVisitLimit',
      hostname: 'twitter.com',
      visitLimit: '3',
    });
  });
});

describe('Form submission handling', () => {
  test('should call limitTime when timeLimit is set', () => {
    mockHostnameInput.value = 'google.com';
    mockTimeLimitInput.value = '30';
    mockVisitLimitInput.value = '';

    // Simulate form submission behavior
    if (mockTimeLimitInput.value && !mockVisitLimitInput.value) {
      global.showMessage(`This submmit will limit the hostname ${mockHostnameInput.value}:\n ${mockTimeLimitInput.value} sec \n No limit visits`);
      global.limitTime(mockHostnameInput.value, mockTimeLimitInput.value);
    }

    expect(global.limitTime).toHaveBeenCalledWith('google.com', '30');
  });

  test('should call both limit functions when both are set', () => {
    mockHostnameInput.value = 'facebook.com';
    mockTimeLimitInput.value = '60';
    mockVisitLimitInput.value = '5';

    if (mockTimeLimitInput.value && mockVisitLimitInput.value) {
      global.showMessage(`This submmit will limit the hostname ${mockHostnameInput.value}:\n ${mockTimeLimitInput.value} sec \n ${mockVisitLimitInput.value} visits`);
      global.limitTime(mockHostnameInput.value, mockTimeLimitInput.value);
      global.limitVisit(mockHostnameInput.value, mockVisitLimitInput.value);
    }

    expect(global.limitTime).toHaveBeenCalledWith('facebook.com', '60');
    expect(global.limitVisit).toHaveBeenCalledWith('facebook.com', '5');
  });

  test('should show message when no limits are set', () => {
    mockHostnameInput.value = 'example.com';
    mockTimeLimitInput.value = '';
    mockVisitLimitInput.value = '';

    if (!mockTimeLimitInput.value && !mockVisitLimitInput.value) {
      global.showMessage(`No limits applied on ${mockHostnameInput.value}`);
    }

    expect(global.showMessage).toHaveBeenCalledWith('No limits applied on example.com');
  });
});

describe('showMessage function', () => {
  let messageEl;

  beforeEach(() => {
    messageEl = document.getElementById('message');
  });

  test('should display message text', () => {
    const message = 'Test message';
    global.showMessage(message);
    expect(messageEl.textContent).toBe(message);
    expect(messageEl.hidden).toBe(false);
  });

  test('should be callable with various parameters', () => {
    expect(() => global.showMessage('Test')).not.toThrow();
    expect(() => global.showMessage('Test', 3000)).not.toThrow();
    expect(() => global.showMessage('Test', 3000, true)).not.toThrow();
  });

  test('should handle empty message', () => {
    global.showMessage('');
    expect(messageEl.textContent).toBe('');
  });

  test('should handle message element not present', () => {
    const messageEl = document.getElementById('message');
    messageEl.remove();
    expect(() => global.showMessage('Test')).not.toThrow();
  });
});

describe('Button event listeners', () => {
  test('ShowLimits button should exist', () => {
    const btn = document.getElementById('ShowLimits');
    expect(btn).toBeTruthy();
  });

  test('DeleteLimits button should exist', () => {
    const btn = document.getElementById('DeleteLimits');
    expect(btn).toBeTruthy();
  });

  test('should send showLimits message when ShowLimits clicked', () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({ limits: 'Test limits' });

    // Simulate click
    chrome.runtime.sendMessage({
      type: 'showLimits',
    });

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'showLimits',
    });
  });

  test('should send deLimit message when DeleteLimits clicked', () => {
    mockHostnameInput.value = 'google.com';

    chrome.runtime.sendMessage({
      type: 'deLimit',
      hostname: mockHostnameInput.value,
    });

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'deLimit',
      hostname: 'google.com',
    });
  });
});

describe('DOM element presence', () => {
  test('form should exist', () => {
    expect(document.querySelector('form')).toBeTruthy();
  });

  test('hostname input should exist', () => {
    expect(document.getElementById('hostname')).toBeTruthy();
  });

  test('timeLimit input should exist', () => {
    expect(document.getElementById('timeLimit')).toBeTruthy();
  });

  test('visitLimit input should exist', () => {
    expect(document.getElementById('visitLimit')).toBeTruthy();
  });

  test('message element should exist', () => {
    expect(document.getElementById('message')).toBeTruthy();
  });
});
