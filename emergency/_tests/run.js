/* A tiny test runner for the browser. No dependencies, no build.
 * Open /emergency/_tests/ from a local server; the page title ends up
 * PASS or FAIL and window.__results holds the details. */

const cases = [];

export function test(name, fn) {
  cases.push({ name, fn });
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg ? msg + ": " : ""}expected ${b}, got ${a}`);
}

export function ok(value, msg) {
  if (!value) throw new Error(msg || "expected a truthy value");
}

export async function runAll() {
  const list = document.getElementById("results");
  let passed = 0;
  const failures = [];
  for (const c of cases) {
    const li = document.createElement("li");
    try {
      await c.fn();
      passed += 1;
      li.className = "pass";
      li.textContent = `PASS  ${c.name}`;
    } catch (err) {
      failures.push({ name: c.name, error: String(err && err.message ? err.message : err) });
      li.className = "fail";
      li.textContent = `FAIL  ${c.name}\n      ${err && err.message ? err.message : err}`;
    }
    list.appendChild(li);
  }
  const summary = document.getElementById("summary");
  summary.textContent = `${passed} passed, ${failures.length} failed`;
  summary.className = failures.length ? "fail" : "pass";
  document.title = failures.length ? "FAIL" : "PASS";
  window.__results = { passed, failed: failures.length, failures };
}
