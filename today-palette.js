/* St. Louis midnight returns the release-day theme to the normal session picker. */
(() => {
 'use strict';
 const root = document.documentElement;
 const start = Date.parse('2026-11-18T00:00:00-06:00');
 const end = Date.parse('2026-11-19T00:00:00-06:00');
 if (!root || root.dataset.todayPalette || Date.now() < start) return;

 let timer;
 function sync() {
  clearTimeout(timer);
  const remaining = end - Date.now();
  if (remaining > 0) {
   root.dataset.todayPalette = 'vice-sunset';
   timer = setTimeout(sync, remaining);
   return;
  }
  root.dataset.todayPalette = 'session-glow';
  document.removeEventListener('visibilitychange', sync);
  window.removeEventListener('pageshow', sync);
 }

 if (Date.now() < end) {
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pageshow', sync);
 }
 sync();
})();
