/* Vice sunset presentation theme: vivid today, 40% softer permanently tomorrow.
 * No storage, tracking, or map data changes. Midnight is America/Chicago (CST). */
(() => {
 'use strict';
 const root = document.documentElement;
 const start = Date.parse('2026-11-18T00:00:00-06:00');
 const softenAt = Date.parse('2026-11-19T00:00:00-06:00');
 if (!root || root.dataset.todayPalette) return;
 let timer;
 function sync() {
  clearTimeout(timer);
  const now = Date.now();
  if (now >= start) {
   root.dataset.todayPalette = 'vice-sunset';
   root.dataset.viceIntensity = now < softenAt ? 'vivid' : 'soft';
  }
  if (now >= start && now < softenAt) {
   timer = setTimeout(sync, softenAt - now);
  } else {
   document.removeEventListener('visibilitychange', sync);
   window.removeEventListener('pageshow', sync);
  }
 }
 document.addEventListener('visibilitychange', sync);
 window.addEventListener('pageshow', sync);
 sync();
})();
