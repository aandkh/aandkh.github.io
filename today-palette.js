/* One-day, presentation-only palette. No storage, tracking, or map data changes. */
(() => {
 'use strict';
 const root = document.documentElement;
 const start = Date.parse('2026-11-18T00:00:00-06:00');
 const end = Date.parse('2026-11-19T00:00:00-06:00');
 if (!root || root.dataset.todayPalette) return;
 let timer;
 function sync() {
  clearTimeout(timer);
  const now = Date.now();
  if (now >= start && now < end) {
   root.dataset.todayPalette = 'vice-sunset';
   timer = setTimeout(sync, end - now);
  } else {
   delete root.dataset.todayPalette;
   document.removeEventListener('visibilitychange', sync);
   window.removeEventListener('pageshow', sync);
  }
 }
 document.addEventListener('visibilitychange', sync);
 window.addEventListener('pageshow', sync);
 sync();
})();
