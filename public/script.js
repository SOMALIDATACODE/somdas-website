const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  nav.classList.toggle('open', open);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  if (document.querySelector('.programs')) document.querySelector('.programs').open = false;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open navigation');
}));
document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => { window.location.href = '/contact'; }));
document.addEventListener('click', event => { const programs = document.querySelector('.programs'); if (programs && !programs.contains(event.target)) programs.open = false; });
document.addEventListener('keydown', event => { if(event.key === 'Escape') if (document.querySelector('.programs')) document.querySelector('.programs').open = false; });

const themeButton = document.querySelector('.theme-toggle');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('somdas-theme', theme); } catch {}
  updateThemeButton();
});
systemTheme.addEventListener('change', event => {
  let saved = null;
  try { saved = localStorage.getItem('somdas-theme'); } catch {}
  if (saved !== 'light' && saved !== 'dark') {
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
    updateThemeButton();
  }
});
updateThemeButton();
document.querySelectorAll('[data-history-back]').forEach(link => link.addEventListener('click', event => {
  try {
    const previous = document.referrer && new URL(document.referrer);
    if (previous && previous.origin === location.origin && history.length > 1) {
      event.preventDefault();
      history.back();
    }
  } catch {}
}));
const scene = document.querySelector('.sodi-scene');
const motionButton = document.querySelector('.motion-toggle');
if (scene && motionButton) {
let motionPaused = false;
let sceneVisible = false;
try { motionPaused = localStorage.getItem('somdas-motion') === 'paused'; } catch {}
function updateMotion() {
  scene.classList.toggle('is-paused', motionPaused || !sceneVisible);
  motionButton.setAttribute('aria-pressed', String(motionPaused));
  motionButton.textContent = motionPaused ? 'Play animation' : 'Pause animation';
}
motionButton.addEventListener('click', () => {
  motionPaused = !motionPaused;
  try { localStorage.setItem('somdas-motion', motionPaused ? 'paused' : 'playing'); } catch {}
  updateMotion();
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => { sceneVisible = entries[0].isIntersecting; updateMotion(); }, { threshold: 0.1 }).observe(scene);
} else { sceneVisible = true; }
updateMotion();

}
