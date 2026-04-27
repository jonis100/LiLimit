import { renderHook, act } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { useMessage } from '../src/popup/hooks/useMessage.js';
import { useTheme } from '../src/popup/hooks/useTheme.js';
import { useTips } from '../src/popup/hooks/useTips.js';

describe('useMessage', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('sets message text and isError=false by default', () => {
    const { result } = renderHook(() => useMessage());

    act(() => { result.current.showMessage('hello'); });

    expect(result.current.message).toEqual({ text: 'hello', isError: false });
  });

  it('sets isError=true when passed', () => {
    const { result } = renderHook(() => useMessage());

    act(() => { result.current.showMessage('oops', 5000, true); });

    expect(result.current.message).toEqual({ text: 'oops', isError: true });
  });

  it('clears message after the given duration', () => {
    const { result } = renderHook(() => useMessage());

    act(() => { result.current.showMessage('bye', 1000); });
    expect(result.current.message).not.toBeNull();

    act(() => { jest.advanceTimersByTime(1001); });

    expect(result.current.message).toBeNull();
  });

  it('resets timer when showMessage is called again', () => {
    const { result } = renderHook(() => useMessage());

    act(() => { result.current.showMessage('first', 1000); });
    act(() => { jest.advanceTimersByTime(500); });
    act(() => { result.current.showMessage('second', 1000); });
    act(() => { jest.advanceTimersByTime(600); });

    expect(result.current.message?.text).toBe('second');
  });
});

describe('useTheme', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults to dark theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('reads initial theme from localStorage', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme switches dark→light→dark', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('light');

    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe('dark');
  });

  it('persists theme changes to localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });

    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('sets data-theme attribute on documentElement', () => {
    const { result } = renderHook(() => useTheme());

    act(() => { result.current.toggleTheme(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('useTips', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('returns a tip with text and isFeature properties', () => {
    const { result } = renderHook(() => useTips());
    expect(result.current.tip).toHaveProperty('text');
    expect(result.current.tip).toHaveProperty('isFeature');
    expect(typeof result.current.tip.text).toBe('string');
  });

  it('starts with fading=false', () => {
    const { result } = renderHook(() => useTips());
    expect(result.current.fading).toBe(false);
  });

  it('advanceTip sets fading=true then false after 300ms', () => {
    const { result } = renderHook(() => useTips());

    act(() => { result.current.advanceTip(); });
    expect(result.current.fading).toBe(true);

    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.fading).toBe(false);
  });

  it('auto-advances tip every 10 seconds', () => {
    const { result } = renderHook(() => useTips());
    act(() => { jest.advanceTimersByTime(10000); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.fading).toBe(false);
    expect(result.current.tip).toHaveProperty('text');
  });
});
