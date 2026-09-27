/* Press and hold, with the buzz at the moment it takes.
 *
 * Timing matches holding a message bubble in iMessage: iOS's Haptic Touch
 * "Default" duration is about 500 ms (its "Fast" setting is about 200 ms,
 * but a web page cannot read that setting, so Chill matches Default).
 * Android's own long-press timeout is 400 ms, used for the Android
 * disguise.
 */

export const HOLD_MS = 500;
export const ANDROID_HOLD_MS = 400;
const SLOP = 10;

let iosSwitch = null;
let activeCancel = null;

/* Scrolling anywhere cancels the hold in progress. One listener serves
 * every holdable element, however often they are redrawn. */
window.addEventListener("scroll", () => { if (activeCancel) activeCancel(); }, { passive: true, capture: true });

/* iPhone Safari has no vibration API. Since iOS 18, toggling an
 * <input type="checkbox" switch> plays the system tick, and clicking a
 * <label> bound to one toggles it. Whether iOS allows that from a timer
 * (not straight from a tap) is not documented; if it does not, the buzz
 * silently does nothing. */
function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(pattern = 12) {
  if (typeof navigator.vibrate === "function") {
    const ua = navigator.userActivation;
    try { if (!ua || ua.hasBeenActive) navigator.vibrate(pattern); } catch (e) { /* no vibration here */ }
    return;
  }
  try { iosTick(); } catch (e) { /* no haptics on this device */ }
}

/* Wire a press-and-hold onto el. Moving more than 10 px, scrolling, or
 * letting go early cancels. Space or Enter held down works the same. */
export function attachHold(el, { ms = HOLD_MS, onStart, onProgress, onCancel, onFire } = {}) {
  let timer = 0;
  let raf = 0;
  let t0 = 0;
  let x0 = 0;
  let y0 = 0;
  let active = false;
  let pointer = null;

  el.classList.add("holdable");

  function frame() {
    if (!active) return;
    const p = Math.min(1, (performance.now() - t0) / ms);
    if (onProgress) onProgress(p);
    raf = requestAnimationFrame(frame);
  }

  function begin(x, y, id) {
    active = true;
    pointer = id;
    x0 = x;
    y0 = y;
    t0 = performance.now();
    el.classList.add("is-holding");
    activeCancel = cancel;
    if (onStart) onStart();
    timer = setTimeout(fire, ms);
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    active = false;
    if (activeCancel === cancel) activeCancel = null;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    el.classList.remove("is-holding");
    if (onProgress) onProgress(0);
  }

  function cancel() {
    if (!active) return;
    stop();
    if (onCancel) onCancel();
  }

  function fire() {
    if (!active) return;
    stop();
    haptic();
    if (onFire) onFire();
  }

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    begin(e.clientX, e.clientY, e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (active && e.pointerId === pointer && Math.hypot(e.clientX - x0, e.clientY - y0) > SLOP) cancel();
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    el.addEventListener(type, (e) => {
      if (active && e.pointerId === pointer) cancel();
    });
  }
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && !active) {
      e.preventDefault();
      begin(0, 0, "key");
    }
  });
  el.addEventListener("keyup", (e) => {
    if ((e.key === " " || e.key === "Enter") && active) cancel();
  });

  return { cancel };
}
