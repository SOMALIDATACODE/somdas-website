const revealItems = document.querySelectorAll('.reveal, .impact-steps');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach(item => revealObserver.observe(item));
}
document.querySelector('.copy-note').addEventListener('click', async () => {
  const note = document.querySelector('#contact-note');
  const status = document.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(note.value);
    status.textContent = 'Introduction copied. No message has been sent.';
  } catch {
    note.focus();
    note.select();
    status.textContent = 'Your introduction is selected. Use Copy on your device.';
  }
});

const connectedSystem = document.querySelector('.connected-system');
if (connectedSystem && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const mobileSystem = matchMedia('(max-width: 800px)').matches;
  const systemObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add(mobileSystem ? 'mobile-entering' : 'system-entering');
        systemObserver.unobserve(entry.target);
      }
    });
  }, { threshold: mobileSystem ? 0.35 : 0.15 });
  if (mobileSystem) connectedSystem.querySelectorAll('.system-item').forEach(item => systemObserver.observe(item));
  else systemObserver.observe(connectedSystem);
}
