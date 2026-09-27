/* Pieces every screen uses: avatars, toasts, bottom sheets, sounds. */

import { el, esc, open } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";

export function avatar(m, size = 36, cls = "") {
  return `<span class="av ${cls}" style="--av:${m.color};--sz:${size}px" aria-hidden="true">${esc(m.initial)}</span>`;
}

/* "Mom", "Mom and Dad", "Mom, Dad and Leo". */
export function joinNames(list) {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/* "until 9:40 PM" and friends, for someone who is sharing on purpose. */
export function shareUntil(m) {
  const sh = m.share;
  if (sh.kind === "timed") return `until ${L.fmtClock(sh.until)}`;
  if (sh.kind === "on") return "until turned off";
  if (sh.kind === "emergency") return "until the emergency ends";
  return "";
}

/* A phone with location off, or no answer at all, has no fresh position:
 * even when someone is allowed to see it, there is nothing to show. */
export function hasFix(m) {
  return m.device !== "offline" && m.device !== "locationOff";
}

/* ---- toasts --------------------------------------------------------- */

let toastHost = null;
let toastsMuted = false;

export function setToastHost(node) {
  toastHost = node;
}

/* Nothing pops up over the Private Mode disguise. */
export function setToastsMuted(muted) {
  toastsMuted = muted;
}

const MAX_TOASTS = 3;

/* key: a toast with the same key replaces the one before it. */
export function toast(message, { action = null, ms = 3600, tone = "", key = "" } = {}) {
  if (!toastHost || toastsMuted) return;
  if (key) toastHost.querySelectorAll(`[data-key="${key}"]`).forEach((n) => n.remove());
  while (toastHost.children.length >= MAX_TOASTS) toastHost.firstElementChild.remove();
  const node = el(`<div class="toast ${tone ? `toast--${tone}` : ""}" role="status"><span class="toast__msg"></span></div>`);
  if (key) node.dataset.key = key;
  node.firstElementChild.textContent = message;
  if (action) {
    const btn = el(`<button type="button" class="toast__act"></button>`);
    btn.textContent = action.label;
    btn.addEventListener("click", () => { action.fn(); dismiss(); });
    node.appendChild(btn);
  }
  toastHost.appendChild(node);
  open(node, "is-in");
  const timer = setTimeout(dismiss, ms);
  function dismiss() {
    clearTimeout(timer);
    node.classList.remove("is-in");
    setTimeout(() => node.remove(), 260);
  }
  return dismiss;
}

/* Full-screen alerts clear the small stuff off the top of the screen. */
export function clearToasts() {
  if (toastHost) toastHost.innerHTML = "";
}

/* ---- bottom sheets -------------------------------------------------- */

let overlayHost = null;

export function setOverlayHost(node) {
  overlayHost = node;
}

/* A modal bottom sheet. body is an element; returns { close, node }. */
export function openSheet({ title = "", body, onClose = null, cls = "" }) {
  const wrap = el(`
    <div class="sheet-wrap ${cls}">
      <div class="sheet-scrim" data-close></div>
      <section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet__grab"></div>
        <header class="sheet__head">
          <h2 class="sheet__title"></h2>
          <button type="button" class="icon-btn icon-btn--small" data-close aria-label="Close">${icon("x", 18)}</button>
        </header>
        <div class="sheet__body"></div>
      </section>
    </div>`);
  wrap.querySelector(".sheet__title").textContent = title;
  wrap.querySelector(".sheet__body").appendChild(body);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    wrap.classList.remove("is-open");
    setTimeout(() => wrap.remove(), 280);
    if (onClose) onClose();
  }
  wrap.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });
  overlayHost.appendChild(wrap);
  open(wrap);
  return { close, node: wrap };
}

/* Two-button question. Resolves true for yes. */
export function confirmSheet({ title, message, yes, no = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const body = el(`
      <div class="confirm">
        <p class="confirm__msg"></p>
        <div class="confirm__btns">
          <button type="button" class="btn ${danger ? "btn--red" : "btn--light"}" data-yes></button>
          <button type="button" class="btn btn--dark" data-no></button>
        </div>
      </div>`);
    body.querySelector(".confirm__msg").textContent = message;
    body.querySelector("[data-yes]").textContent = yes;
    body.querySelector("[data-no]").textContent = no;
    let answer = false;
    const sheet = openSheet({ title, body, onClose: () => resolve(answer) });
    body.querySelector("[data-yes]").addEventListener("click", () => { answer = true; sheet.close(); });
    body.querySelector("[data-no]").addEventListener("click", () => sheet.close());
  });
}

/* ---- sound and vibration -------------------------------------------- */

let audio = null;

/* Browsers only allow sound after a tap; call this from the first one. */
export function unlockAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (e) { audio = null; }
}

function tone(freq, start, dur, gain = 0.2, type = "sine") {
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audio.currentTime + start);
  g.gain.setValueAtTime(0.0001, audio.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, audio.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + dur);
  o.connect(g).connect(audio.destination);
  o.start(audio.currentTime + start);
  o.stop(audio.currentTime + start + dur + 0.05);
}

/* The incoming-emergency alarm: two rising pairs, about 1.6 seconds. */
export function alarm(state) {
  buzz([220, 120, 220, 120, 420]);
  if (!state.sound || !audio) return;
  for (let i = 0; i < 4; i += 1) {
    tone(880, i * 0.4, 0.18, 0.22, "square");
    tone(1175, i * 0.4 + 0.19, 0.18, 0.22, "square");
  }
}

/* A soft two-note chime for reminders. */
export function chime(state) {
  buzz(40);
  if (!state.sound || !audio) return;
  tone(988, 0, 0.35, 0.16);
  tone(1319, 0.16, 0.5, 0.14);
}

/* Browsers refuse to vibrate before the first tap on the page; skip it
 * quietly rather than trip their console warning. */
function canBuzz() {
  const ua = navigator.userActivation;
  return typeof navigator.vibrate === "function" && (!ua || ua.hasBeenActive);
}

export function buzz(pattern) {
  try { if (canBuzz()) navigator.vibrate(pattern); } catch (e) { /* no vibration here */ }
}
