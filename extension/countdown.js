(function () {
  const countdownEl = document.getElementById('countdown');
  if (!countdownEl) {
    return;
  }

  const intervalId = setInterval(updateCountdown, 1000);

  function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);

    const diff = tomorrow - now;

    if (diff <= 0) {
      countdownEl.textContent = 'Limits have been reset!';
      clearInterval(intervalId);
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (num) => String(num).padStart(2, '0');

    countdownEl.textContent = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  updateCountdown();
})();
