const OFFSCREEN_PATH = 'offscreen.html';
const ICON_SIZES = [16, 32, 48, 128];

function iconPaths(dark: boolean): Record<string, string> {
  const variant = dark ? 'lily-dark' : 'lily';
  return Object.fromEntries(
    ICON_SIZES.map((size) => [size, `/images/icons/${variant}-${size}.png`])
  );
}

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
  });
  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [chrome.offscreen.Reason.MATCH_MEDIA],
    justification: 'Match the toolbar icon to the browser light/dark color scheme',
  });
}

/**
 * Keeps the toolbar icon in sync with the browser color scheme. The offscreen document
 * outlives service worker restarts and re-reports on load and on every scheme change.
 * Must be called synchronously at startup so a report that wakes the worker isn't missed.
 */
export function setupThemeIcon(): void {
  if (!chrome.offscreen) return;

  chrome.runtime.onMessage.addListener((request: { type?: string; dark?: boolean }) => {
    if (request?.type !== 'colorSchemeChanged') return;
    chrome.action
      .setIcon({ path: iconPaths(Boolean(request.dark)) })
      .catch((error: unknown) => console.error("Can't set theme icon:", error));
  });

  ensureOffscreenDocument().catch((error: unknown) =>
    console.error("Can't create offscreen document:", error)
  );
}
