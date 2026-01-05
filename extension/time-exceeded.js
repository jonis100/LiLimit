(function () {
  const img = document.querySelector('img[alt="Take a break"]');
  if (img) {
    img.addEventListener('error', function () {
      this.parentElement.innerHTML = `<div style='padding: 80px; color: #6ee7b7; font-size: 5em;'>☕</div>`;
    });
  }
})();
