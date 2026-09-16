(() => {
  let selected = null;
  try { selected = localStorage.getItem('somdas-theme'); } catch {}
  document.documentElement.dataset.theme = selected === 'dark' || selected === 'light'
    ? selected : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
})();
