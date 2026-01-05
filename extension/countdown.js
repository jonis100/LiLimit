(function () {
  function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);

    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const countdownEl = document.getElementById('countdown');
    if (countdownEl) {
      countdownEl.textContent = hours + 'h ' + minutes + 'm ' + seconds + 's';
    }
  }

  updateCountdown();

  setInterval(updateCountdown, 1000);
})();
