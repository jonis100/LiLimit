import { jest, describe, test, expect, beforeEach } from '@jest/globals';

type Listener = (request: { type?: string; dark?: boolean }) => void;

let listener: Listener | undefined;
const setIcon = jest.fn(() => Promise.resolve());
const createDocument = jest.fn(() => Promise.resolve());
const getContexts = jest.fn(() => Promise.resolve([] as unknown[]));

function installChrome(withOffscreen = true): void {
  listener = undefined;
  Object.defineProperty(global, 'chrome', {
    value: {
      runtime: {
        onMessage: {
          addListener: (fn: Listener) => {
            listener = fn;
          },
        },
        getContexts,
        getURL: (path: string) => `chrome-extension://id/${path}`,
        ContextType: { OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT' },
      },
      action: { setIcon },
      offscreen: withOffscreen
        ? { createDocument, Reason: { MATCH_MEDIA: 'MATCH_MEDIA' } }
        : undefined,
    },
    writable: true,
    configurable: true,
  });
}

async function load(): Promise<typeof import('../src/background/theme-icon')> {
  return import(`../src/background/theme-icon.ts?t=${Math.random()}`);
}

describe('setupThemeIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getContexts.mockImplementation(() => Promise.resolve([]));
  });

  test('creates the offscreen document when none exists', async () => {
    installChrome();
    (await load()).setupThemeIcon();
    await new Promise((r) => setTimeout(r, 0));

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'offscreen.html', reasons: ['MATCH_MEDIA'] })
    );
  });

  test('does not recreate an existing offscreen document', async () => {
    installChrome();
    getContexts.mockImplementation(() => Promise.resolve([{}]));
    (await load()).setupThemeIcon();
    await new Promise((r) => setTimeout(r, 0));

    expect(createDocument).not.toHaveBeenCalled();
  });

  test('sets the white icon in dark mode and the black icon in light mode', async () => {
    installChrome();
    (await load()).setupThemeIcon();

    listener!({ type: 'colorSchemeChanged', dark: true });
    expect(setIcon).toHaveBeenLastCalledWith({
      path: expect.objectContaining({ 16: '/images/icons/lily-dark-16.png' }),
    });

    listener!({ type: 'colorSchemeChanged', dark: false });
    expect(setIcon).toHaveBeenLastCalledWith({
      path: expect.objectContaining({ 16: '/images/icons/lily-16.png' }),
    });
  });

  test('ignores unrelated messages', async () => {
    installChrome();
    (await load()).setupThemeIcon();

    listener!({ type: 'getStats' });
    expect(setIcon).not.toHaveBeenCalled();
  });

  test('is a no-op when the offscreen API is unavailable', async () => {
    installChrome(false);
    (await load()).setupThemeIcon();

    expect(listener).toBeUndefined();
    expect(getContexts).not.toHaveBeenCalled();
  });
});
