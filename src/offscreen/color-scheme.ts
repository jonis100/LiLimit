// Service workers have no window.matchMedia, so this offscreen document reports the
// browser color scheme to the background, which swaps the toolbar icon.
(function (): void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');

  function report(): void {
    chrome.runtime.sendMessage({ type: 'colorSchemeChanged', dark: query.matches }).catch(() => {});
  }

  query.addEventListener('change', report);
  report();
})();
