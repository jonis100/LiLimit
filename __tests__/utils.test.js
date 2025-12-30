/**
 * Unit tests for utils.js
 * Testing utility functions of the LiLimit Chrome extension
 */

import { extractHostname, limits_to_string } from '../extension/utils.js';

describe('extractHostname function', () => {
  test('should extract hostname from full URL', () => {
    expect(extractHostname('https://www.google.com')).toBe('google.com');
  });

  test('should extract hostname from URL without www', () => {
    expect(extractHostname('https://github.com')).toBe('github.com');
  });

  test('should handle plain hostname input', () => {
    expect(extractHostname('example.com')).toBe('example.com');
  });

  test('should remove www prefix', () => {
    expect(extractHostname('www.example.com')).toBe('example.com');
  });

  test('should handle subdomains correctly', () => {
    expect(extractHostname('https://mail.google.com')).toBe('mail.google.com');
  });

  test('should handle URLs with paths', () => {
    expect(extractHostname('https://example.com/path/to/page')).toBe('example.com');
  });

  test('should handle invalid URLs gracefully', () => {
    expect(extractHostname('not a url')).toBe('not a url');
  });

  test('should handle localhost', () => {
    expect(extractHostname('http://localhost:3000')).toBe('localhost');
  });
});

describe('limits_to_string function', () => {
  test('should format single host with both limits', () => {
    const hosts = ['example.com'];
    const timeLimits = { 'example.com': 30 };
    const visitLimits = { 'example.com': 5 };

    const result = limits_to_string(hosts, timeLimits, visitLimits);

    expect(result).toContain('example.com');
    expect(result).toContain('Time limit per visit: 30 minutes');
    expect(result).toContain('Visits per day: 5 times');
  });

  test('should format host with only time limit', () => {
    const hosts = ['github.com'];
    const timeLimits = { 'github.com': 60 };
    const visitLimits = {};

    const result = limits_to_string(hosts, timeLimits, visitLimits);

    expect(result).toContain('github.com');
    expect(result).toContain('Time limit per visit: 60 minutes');
    expect(result).toContain('Visits per day: No limit');
  });

  test('should format host with only visit limit', () => {
    const hosts = ['reddit.com'];
    const timeLimits = {};
    const visitLimits = { 'reddit.com': 10 };

    const result = limits_to_string(hosts, timeLimits, visitLimits);

    expect(result).toContain('reddit.com');
    expect(result).toContain('Time limit per visit: No limit');
    expect(result).toContain('Visits per day: 10 times');
  });

  test('should format multiple hosts', () => {
    const hosts = ['example.com', 'github.com'];
    const timeLimits = { 'example.com': 30, 'github.com': 60 };
    const visitLimits = { 'example.com': 5, 'github.com': 10 };

    const result = limits_to_string(hosts, timeLimits, visitLimits);

    expect(result).toContain('example.com');
    expect(result).toContain('github.com');
    expect(result).toContain('Time limit per visit: 30 minutes');
    expect(result).toContain('Time limit per visit: 60 minutes');
    expect(result).toContain('Visits per day: 5 times');
    expect(result).toContain('Visits per day: 10 times');
  });

  test('should handle empty hosts array', () => {
    const hosts = [];
    const timeLimits = {};
    const visitLimits = {};

    const result = limits_to_string(hosts, timeLimits, visitLimits);

    expect(result).toBe('');
  });

  test('should handle host with no limits', () => {
    const hosts = ['example.com'];
    const timeLimits = {};
    const visitLimits = {};

    const result = limits_to_string(hosts, timeLimits, visitLimits);

    expect(result).toContain('example.com');
    expect(result).toContain('Time limit per visit: No limit');
    expect(result).toContain('Visits per day: No limit');
  });
});
