// Local preview diagnostics only. No user data, network reporting or app-control API.
const enabled = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  && new URLSearchParams(location.search).get('qa') === 'performance';
const round = value => Math.round(value * 100) / 100;
function report(name, phase, ms, started) {
  console.info('[Andymap performance] ' + JSON.stringify({name, phase, ms: round(ms), started: round(started), viewport: `${innerWidth}x${innerHeight}`}));
}
export function startMeasurement(name, phase = 'processing') {
  if (!enabled) return () => {};
  const started = performance.now();
  return () => report(name, phase, performance.now() - started, started);
}
export function measureUI(name, work) {
  const finish = startMeasurement(name);
  try { return work(); } finally { finish(); }
}
if (enabled && typeof PerformanceObserver !== 'undefined') {
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) report('main-thread task', 'longtask', entry.duration, entry.startTime);
    }).observe({type: 'longtask', buffered: true});
  }
  if (PerformanceObserver.supportedEntryTypes.includes('event')) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        report(entry.name, 'event-processing', entry.processingEnd - entry.processingStart, entry.startTime);
      }
    }).observe({type: 'event', durationThreshold: 16});
  }
}
