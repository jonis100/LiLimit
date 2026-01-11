(function (): void {
  const countdownEl = document.getElementById('countdown');
  if (!countdownEl) {
    return;
  }

  const intervalId: NodeJS.Timeout = setInterval(updateCountdown, 1000);

  function updateCountdown(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();

    if (diff <= 0) {
      if (countdownEl) {
        countdownEl.textContent = 'Limits have been reset!';
      }
      clearInterval(intervalId);
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (num: number): string => String(num).padStart(2, '0');

    if (countdownEl) {
      countdownEl.textContent = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
  }

  updateCountdown();
})();
