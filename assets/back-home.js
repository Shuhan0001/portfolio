(() => {
  const button = document.querySelector('.back-home-btn');
  const overlay = document.getElementById('page-exit');
  if (!button || !overlay) return;

  let pendingNavigation = null;

  button.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = button.getAttribute('href');
    if (!href) return;

    event.preventDefault();
    if (pendingNavigation !== null) return;
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    pendingNavigation = setTimeout(() => { window.location.href = href; }, 650);
  });

  // Clear the exit overlay when a detail page is restored from browser history.
  window.addEventListener('pageshow', () => {
    clearTimeout(pendingNavigation);
    pendingNavigation = null;
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
  });
})();
