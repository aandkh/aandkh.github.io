/* The PIN pad.
 *
 * mode "verify": check(pin) decides. mode "setup": type it twice.
 * Resolves the PIN, or null when cancelled.
 */

import { el, open } from "./dom.js";
import { icon } from "./icons.js";
import { buzz } from "./ui-common.js";

export function askPin(host, { title, sub = "", mode = "verify", check = () => true, canCancel = true }) {
  return new Promise((resolve) => {
    const node = el(`
      <div class="pinpad-wrap" role="dialog" aria-modal="true" aria-labelledby="pinpad-title">
        <div class="pinpad">
          <div class="pinpad__icon">${icon("key", 24)}</div>
          <h2 class="pinpad__title" id="pinpad-title"></h2>
          <p class="pinpad__sub"></p>
          <div class="pinpad__dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
          <p class="pinpad__err" aria-live="assertive"></p>
          <div class="pinpad__keys">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="pinpad__key" data-d="${n}">${n}</button>`).join("")}
            <button type="button" class="pinpad__key pinpad__key--text" data-cancel>${canCancel ? "Cancel" : ""}</button>
            <button type="button" class="pinpad__key" data-d="0">0</button>
            <button type="button" class="pinpad__key pinpad__key--text" data-del aria-label="Delete">${icon("back", 22)}</button>
          </div>
        </div>
      </div>`);
    const titleEl = node.querySelector(".pinpad__title");
    const err = node.querySelector(".pinpad__err");
    const dots = Array.from(node.querySelectorAll(".pinpad__dots span"));
    const box = node.querySelector(".pinpad");
    titleEl.textContent = title;
    node.querySelector(".pinpad__sub").textContent = sub;
    if (!canCancel) node.querySelector("[data-cancel]").disabled = true;

    let entry = "";
    let first = null;
    let busy = false;

    function paint() {
      dots.forEach((d, i) => d.classList.toggle("is-on", i < entry.length));
    }

    function fail(message) {
      err.textContent = message;
      buzz([30, 40, 30]);
      box.classList.remove("is-shaking");
      void box.offsetWidth;
      box.classList.add("is-shaking");
      entry = "";
      paint();
    }

    function finish(value) {
      document.removeEventListener("keydown", onKey, true);
      node.classList.remove("is-open");
      setTimeout(() => node.remove(), 220);
      resolve(value);
    }

    function submit() {
      busy = false;
      if (mode === "setup") {
        if (first === null) {
          first = entry;
          entry = "";
          titleEl.textContent = "Type it once more";
          err.textContent = "";
          paint();
          return;
        }
        if (entry !== first) {
          first = null;
          titleEl.textContent = title;
          fail("Those didn't match. Try again.");
          return;
        }
        finish(entry);
        return;
      }
      if (check(entry)) finish(entry);
      else fail("That's not the PIN.");
    }

    function press(d) {
      if (busy || entry.length >= 4) return;
      err.textContent = "";
      entry += d;
      paint();
      if (entry.length === 4) {
        busy = true;
        setTimeout(submit, 140);
      }
    }

    function del() {
      if (busy) return;
      entry = entry.slice(0, -1);
      paint();
    }

    function onKey(e) {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); del(); }
      else if (e.key === "Escape" && canCancel) { e.preventDefault(); finish(null); }
    }

    node.addEventListener("click", (e) => {
      const key = e.target.closest("button");
      if (!key) return;
      if (key.dataset.d !== undefined) press(key.dataset.d);
      else if (key.hasAttribute("data-del")) del();
      else if (key.hasAttribute("data-cancel") && canCancel) finish(null);
    });
    document.addEventListener("keydown", onKey, true);
    host.appendChild(node);
    open(node);
  });
}
