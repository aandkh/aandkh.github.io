/* Private Mode: Chill disguised as a text conversation.
 *
 * iMessage on iPhone, Google Messages on Android (or whichever settings
 * force). Holding any bubble sends a silent alert; one second later the
 * contact starts typing for 20 seconds, then stops. Holding the message
 * box opens settings; holding send (or the microphone that sits there
 * when the box is empty) opens the map. Typed texts look delivered, go
 * nowhere, and delete themselves after 24 hours.
 */

import { el, esc, open } from "./dom.js";
import * as L from "./logic.js";
import { attachHold, HOLD_MS, ANDROID_HOLD_MS } from "./hold.js";
import { PRESETS, customMessages, CODED } from "./presets.js";

const TYPING_DELAY = 1000;
const TYPING_FOR = 20000;
const GROUP_GAP = 45 * L.MIN;

/* Glyphs drawn for the disguise only: these mimic each platform's own
 * icon style, which the rest of Chill does not use. */
const G = {
  imBack: '<svg width="13" height="21" viewBox="0 0 13 21" aria-hidden="true"><path d="M11 2 2.5 10.5 11 19" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  imVideo: '<svg width="27" height="18" viewBox="0 0 27 18" aria-hidden="true"><rect x="1" y="2" width="17" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M19.5 7.2 25 3.8v10.4l-5.5-3.4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  imChevron: '<svg width="7" height="11" viewBox="0 0 7 11" aria-hidden="true"><path d="M1.5 1.5 5.5 5.5 1.5 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  imPlus: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  imMic: '<svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true"><rect x="3.5" y="1" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M1 9.5a6 6 0 0 0 12 0M7 15.5V19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  imUp: '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 14.5V2M1.5 7.2 7 1.7l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gmBack: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5m6-7-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gmPhone: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h2.8l1.5 4-1.9 1.3a11 11 0 0 0 6.2 6.2l1.3-1.9 4 1.5v2.8a2 2 0 0 1-2 2A15.6 15.6 0 0 1 4.6 5.5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gmVideo: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12.5" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 10.2 5.5-3.2v10l-5.5-3.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gmMore: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="18.5" r="1.8" fill="currentColor"/></svg>',
  gmAdd: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5v9M7.5 12h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  gmEmoji: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/><path d="M8.3 14.2a4.5 4.5 0 0 0 7.4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  gmImage: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="m5 18 4.8-5 3.6 3.4 2.2-2.2L20 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gmMic: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  gmSend: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" fill="currentColor"/></svg>',
  gmClose: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gmReply: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 8V4.5L3.5 11 10 17.5V14c4.6 0 7.8 1.4 10.5 5-1.1-5.1-4.2-10-10.5-11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  gmCopy: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  gmTrash: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

const TAPBACKS = [
  '<svg width="22" height="20" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21S2 14.6 2 7.6A5.3 5.3 0 0 1 12 5a5.3 5.3 0 0 1 10 2.6C22 14.6 12 21 12 21z" fill="currentColor"/></svg>',
  "👍", "👎",
  '<span class="im-haha">HA<br>HA</span>',
  '<span class="im-bang">!!</span>',
  '<span class="im-q">?</span>',
];

export function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function standalone() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function lookFor(d) {
  if (d.style === "imessage" || d.style === "android") return d.style;
  return isAndroid() ? "android" : "imessage";
}

/* On an iPhone Home Screen install the status bar text is always white,
 * so the iMessage look goes dark there; elsewhere it follows the phone. */
function darkFor(look) {
  if (look === "imessage" && isIOS() && standalone()) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function dayStart(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function atOf(now, day, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(dayStart(now) + day * 24 * L.HOUR);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
}

function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function stampText(look, ms, now) {
  const days = Math.round((dayStart(now) - dayStart(ms)) / (24 * L.HOUR));
  const d = new Date(ms);
  let day;
  if (days === 0) day = "Today";
  else if (days === 1) day = "Yesterday";
  else if (days < 7) day = d.toLocaleDateString([], { weekday: "long" });
  else day = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  if (look === "android") return `${day} • ${clock(ms)}`;
  return `<b>${day}</b> ${clock(ms)}`;
}

/* Everything in the thread, oldest first. */
function thread(s, now) {
  const d = s.disguise;
  const preset = PRESETS.find((p) => p.id === d.preset);
  const base = d.preset === "custom" ? customMessages(d.customLines) : preset ? preset.messages : PRESETS[0].messages;
  const list = base
    .map((m, i) => ({ id: `p${i}`, from: m.from, text: m.text, at: atOf(now, m.day, m.time) }))
    .filter((m) => m.at <= now);
  for (const m of d.inbox || []) if (now - m.at < L.TEXT_TTL) list.push({ id: m.id, from: "them", text: m.text, at: m.at });
  for (const m of d.sent) list.push({ id: m.id, from: "me", text: m.text, at: m.at, typed: true });
  return list.sort((a, b) => a.at - b.at);
}

export function contactOf(d) {
  if (d.preset === "custom") {
    const name = d.customName || "Jordan";
    return { name, initial: name.trim().charAt(0).toUpperCase() || "J", color: "#8E8E93" };
  }
  return PRESETS.find((p) => p.id === d.preset) || PRESETS[0];
}

export function mountDisguise(container, ctx) {
  const root = el('<div class="dz" hidden></div>');
  container.appendChild(root);

  let look = "";
  let dark = null;
  let builtFor = "";
  let threadKey = "";
  let typingOn = false;
  let t1 = 0;
  let t2 = 0;
  let pinnedToBottom = true;
  let heldSend = false;
  let parts = null;

  function build(s) {
    const d = s.disguise;
    const c = contactOf(d);
    look = lookFor(d);
    dark = darkFor(look);
    root.className = `dz dz--${look} ${dark ? "dz--dark" : "dz--light"}`;
    const initials = esc(c.initial);
    if (look === "imessage") {
      root.innerHTML = `
        <header class="im-head">
          <button type="button" class="im-back" aria-label="Back">${G.imBack}<span class="im-back__n">4</span></button>
          <button type="button" class="im-contact" aria-label="${esc(c.name)}">
            <span class="im-avatar">${initials}</span>
            <span class="im-name">${esc(c.name)} ${G.imChevron}</span>
          </button>
          <button type="button" class="im-video" aria-label="FaceTime">${G.imVideo}</button>
        </header>
        <div class="im-scroll"><div class="im-thread"></div></div>
        <footer class="im-compose">
          <button type="button" class="im-plus" aria-label="More">${G.imPlus}</button>
          <div class="im-field">
            <textarea class="im-input" rows="1" placeholder="iMessage" aria-label="Message"></textarea>
            <button type="button" class="im-mic" aria-label="Dictate">${G.imMic}</button>
            <button type="button" class="im-send" aria-label="Send" hidden>${G.imUp}</button>
          </div>
        </footer>`;
    } else {
      root.innerHTML = `
        <header class="gm-head">
          <div class="gm-bar">
            <button type="button" class="gm-icon" aria-label="Back">${G.gmBack}</button>
            <span class="gm-avatar" style="--gm-av:${c.color}">${initials}</span>
            <span class="gm-name">${esc(c.name)}</span>
            <span class="gm-actions">
              <button type="button" class="gm-icon" aria-label="Call">${G.gmPhone}</button>
              <button type="button" class="gm-icon" aria-label="Video call">${G.gmVideo}</button>
              <button type="button" class="gm-icon" aria-label="More options">${G.gmMore}</button>
            </span>
          </div>
          <div class="gm-bar gm-bar--select" hidden>
            <button type="button" class="gm-icon gm-unselect" aria-label="Cancel">${G.gmClose}</button>
            <span class="gm-count">1</span>
            <span class="gm-actions">
              <button type="button" class="gm-icon" aria-label="Reply">${G.gmReply}</button>
              <button type="button" class="gm-icon" aria-label="Copy">${G.gmCopy}</button>
              <button type="button" class="gm-icon" aria-label="Delete">${G.gmTrash}</button>
              <button type="button" class="gm-icon" aria-label="More options">${G.gmMore}</button>
            </span>
          </div>
        </header>
        <div class="gm-scroll"><div class="gm-thread"></div></div>
        <footer class="gm-compose">
          <button type="button" class="gm-icon gm-add" aria-label="Attach">${G.gmAdd}</button>
          <div class="gm-field">
            <button type="button" class="gm-icon gm-small" aria-label="Emoji">${G.gmEmoji}</button>
            <textarea class="gm-input" rows="1" placeholder="RCS message" aria-label="Message"></textarea>
            <button type="button" class="gm-icon gm-small" aria-label="Gallery">${G.gmImage}</button>
          </div>
          <button type="button" class="gm-go" aria-label="Voice message">${G.gmMic}</button>
        </footer>`;
    }
    const q = (sel) => root.querySelector(sel);
    parts = look === "imessage"
      ? { scroll: q(".im-scroll"), thread: q(".im-thread"), input: q(".im-input"), field: q(".im-field"), mic: q(".im-mic"), send: q(".im-send") }
      : { scroll: q(".gm-scroll"), thread: q(".gm-thread"), input: q(".gm-input"), field: q(".gm-field"), mic: q(".gm-go"), send: q(".gm-go") };
    wire();
    threadKey = "";
    builtFor = `${look}|${dark}|${d.preset}|${d.customName}|${d.customLines}`;
  }

  /* ---- gestures ----------------------------------------------------- */

  function wire() {
    const ms = look === "android" ? ANDROID_HOLD_MS : HOLD_MS;
    const input = parts.input;

    parts.scroll.addEventListener("scroll", () => {
      const sc = parts.scroll;
      pinnedToBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 40;
    }, { passive: true });

    // Hold the message box: settings.
    attachHold(parts.field, {
      ms,
      onFire: () => {
        input.blur();
        ctx.openSettings();
      },
    });

    // Hold send (or the microphone in the same spot): the map.
    const holdTargets = look === "imessage" ? [parts.mic, parts.send] : [parts.send];
    for (const btn of holdTargets) {
      attachHold(btn, {
        ms,
        onFire: () => {
          heldSend = true;
          input.blur();
          ctx.showMapFromDisguise();
        },
      });
      btn.addEventListener("click", () => {
        if (heldSend) {
          heldSend = false;
          return;
        }
        if (input.value.trim()) send();
      });
    }

    input.addEventListener("input", () => {
      autoGrow();
      const has = input.value.trim().length > 0;
      if (look === "imessage") {
        parts.mic.hidden = has;
        parts.send.hidden = !has;
      } else {
        parts.send.innerHTML = has ? G.gmSend : G.gmMic;
        parts.send.setAttribute("aria-label", has ? "Send" : "Voice message");
        parts.send.classList.toggle("is-send", has);
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.value.trim()) send();
      }
    });

    if (look === "android") {
      root.querySelector(".gm-unselect").addEventListener("click", clearSelection);
    }
  }

  function autoGrow() {
    const input = parts.input;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function send() {
    const input = parts.input;
    const value = input.value.trim();
    input.value = "";
    input.dispatchEvent(new Event("input"));
    pinnedToBottom = true;
    ctx.sendDisguisedText(value);
    setTimeout(() => ctx.refresh(), 950);
    setTimeout(() => ctx.refresh(), 1500);
  }

  function holdBubble(bubble) {
    if (look === "imessage") showTapbacks(bubble);
    else selectBubble(bubble);
    ctx.silentFromDisguise();
    showTyping();
  }

  /* iMessage: the reaction bar and menu, exactly where a real one opens. */
  function showTapbacks(bubble) {
    const rect = bubble.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    const mine = bubble.closest(".im-msg--me") !== null;
    const overlay = el(`
      <div class="im-overlay">
        <div class="im-overlay__scrim"></div>
        <div class="im-tapbacks">${TAPBACKS.map((t) => `<button type="button" class="im-tb">${t}</button>`).join("")}</div>
        <div class="im-lift"></div>
        <div class="im-ctx">
          <button type="button">Reply <span>↩︎</span></button>
          <button type="button">Copy <span>⧉</span></button>
          <button type="button">Translate <span>A</span></button>
          <button type="button">More… <span>⋯</span></button>
        </div>
      </div>`);
    const lift = overlay.querySelector(".im-lift");
    lift.appendChild(bubble.cloneNode(true));
    const top = rect.top - host.top;
    const side = mine ? { right: `${host.right - rect.right}px` } : { left: `${rect.left - host.left}px` };
    Object.assign(lift.style, { top: `${top}px`, ...side });
    const tb = overlay.querySelector(".im-tapbacks");
    Object.assign(tb.style, { top: `${Math.max(8, top - 58)}px`, ...side });
    const menu = overlay.querySelector(".im-ctx");
    const below = top + rect.height + 10;
    const fitsBelow = below + 180 < host.height;
    Object.assign(menu.style, { top: `${fitsBelow ? below : Math.max(70, top - 240)}px`, ...side });
    overlay.addEventListener("click", () => {
      overlay.classList.remove("is-open");
      setTimeout(() => overlay.remove(), 200);
    });
    root.appendChild(overlay);
    open(overlay);
  }

  /* Google Messages: the bubble selects and the contextual bar appears. */
  function selectBubble(bubble) {
    clearSelection();
    bubble.classList.add("is-selected");
    root.querySelector(".gm-bar").hidden = true;
    root.querySelector(".gm-bar--select").hidden = false;
  }

  function clearSelection() {
    if (look !== "android") return;
    root.querySelectorAll(".gm-bubble.is-selected").forEach((b) => b.classList.remove("is-selected"));
    root.querySelector(".gm-bar").hidden = false;
    root.querySelector(".gm-bar--select").hidden = true;
  }

  function showTyping() {
    clearTimeout(t1);
    clearTimeout(t2);
    t1 = setTimeout(() => {
      typingOn = true;
      pinnedToBottom = true;
      ctx.refresh();
      t2 = setTimeout(() => {
        typingOn = false;
        ctx.refresh();
      }, TYPING_FOR);
    }, TYPING_DELAY);
  }

  /* ---- drawing the thread ------------------------------------------ */

  function renderThread(s, now) {
    const msgs = thread(s, now);
    const c = contactOf(s.disguise);
    const lastMine = msgs.length && msgs[msgs.length - 1].from === "me" ? msgs[msgs.length - 1] : null;
    const age = lastMine ? now - lastMine.at : Infinity;
    const status = !lastMine ? "" : look === "android" ? (age < 1200 ? "Sending…" : "Delivered") : age < 900 ? "" : "Delivered";
    const key = `${msgs.map((m) => m.id).join(",")}|${status}|${typingOn}`;
    if (key === threadKey) return;
    threadKey = key;

    const out = [];
    let prev = null;
    msgs.forEach((m, i) => {
      const next = msgs[i + 1];
      if (!prev || m.at - prev.at > GROUP_GAP) out.push(`<div class="${look === "imessage" ? "im" : "gm"}-stamp">${stampText(look, m.at, now)}</div>`);
      const lastOfRun = !next || next.from !== m.from || next.at - m.at > GROUP_GAP;
      const firstOfRun = !prev || prev.from !== m.from || m.at - prev.at > GROUP_GAP;
      const who = m.from === "me" ? "me" : "them";
      const body = esc(m.text).replace(/\n/g, "<br>");
      if (look === "imessage") {
        out.push(`<div class="im-msg im-msg--${who}${lastOfRun ? " im-msg--tail" : ""}${firstOfRun ? " im-msg--first" : ""}"><div class="im-bubble" data-hold>${body}</div></div>`);
      } else {
        const av = who === "them" && lastOfRun ? `<span class="gm-av" style="--gm-av:${c.color}">${esc(c.initial)}</span>` : who === "them" ? '<span class="gm-av gm-av--blank"></span>' : "";
        out.push(`<div class="gm-msg gm-msg--${who}${lastOfRun ? " gm-msg--last" : ""}${firstOfRun ? " gm-msg--first" : ""}">${av}<div class="gm-bubble" data-hold>${body}</div></div>`);
      }
      prev = m;
    });
    if (status) out.push(`<div class="${look === "imessage" ? "im" : "gm"}-status">${status}</div>`);
    if (typingOn) {
      out.push(look === "imessage"
        ? '<div class="im-msg im-msg--them im-msg--tail im-typing" aria-label="typing"><div class="im-bubble"><i></i><i></i><i></i></div></div>'
        : `<div class="gm-msg gm-msg--them gm-typing" aria-label="typing"><span class="gm-av" style="--gm-av:${c.color}">${esc(c.initial)}</span><div class="gm-bubble"><i></i><i></i><i></i></div></div>`);
    }
    parts.thread.innerHTML = out.join("");
    const ms = look === "android" ? ANDROID_HOLD_MS : HOLD_MS;
    parts.thread.querySelectorAll("[data-hold]").forEach((b) => {
      attachHold(b, { ms, onProgress: (p) => b.style.setProperty("--press", p.toFixed(3)), onFire: () => holdBubble(b) });
    });
    if (pinnedToBottom) parts.scroll.scrollTop = parts.scroll.scrollHeight;
  }

  function update(s, now, visible) {
    root.hidden = !visible;
    if (!visible) return;
    const d = s.disguise;
    const want = `${lookFor(d)}|${darkFor(lookFor(d))}|${d.preset}|${d.customName}|${d.customLines}`;
    if (want !== builtFor) build(s);
    renderThread(s, now);
  }

  return {
    root,
    update,
    look: () => look,
    headerColor: () => (look === "imessage" ? (dark ? "#000000" : "#F6F6F6") : dark ? "#1B1C1F" : "#F8FAFD"),
  };
}

/* The coded texts that replace loud alerts while disguised. */
export function codedAlert(seed) {
  return CODED.alert[seed % CODED.alert.length];
}
export { CODED };
