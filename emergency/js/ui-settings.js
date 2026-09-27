/* Settings, plus its two sub-pages: Private Mode and the activity log. */

import { el, refs, text, onAct, open } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import { avatar, toast, confirmSheet } from "./ui-common.js";
import { PRESETS } from "./presets.js";
import { checkInSheet, nightlySheet } from "./ui-sheets.js";

function page(title, bodyHtml) {
  return el(`
    <div class="page" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="page__head">
        <button type="button" class="icon-btn" data-act="back" aria-label="Back">${icon("back", 20)}</button>
        <h2 class="page__title">${title}</h2>
        <span class="page__spacer"></span>
      </header>
      <div class="page__body">${bodyHtml}</div>
    </div>`);
}

function slideIn(host, node) {
  host.appendChild(node);
  open(node);
}

function slideOut(node) {
  node.classList.remove("is-open");
  setTimeout(() => node.remove(), 280);
}

function row(act, ic, label, value = "", chevron = true, extra = "") {
  return `<button type="button" class="row ${extra}" data-act="${act}">
    <span class="row__ic">${icon(ic, 19)}</span>
    <span class="row__label">${label}</span>
    <span class="row__value" data-ref="${act}Value">${value}</span>
    ${chevron ? `<span class="row__go">${icon("chevron", 18)}</span>` : ""}
  </button>`;
}

export function openSettings(host, ctx, onClose = () => {}) {
  const node = page("Settings", `
    <section class="card card--me">
      <span data-ref="meAv"></span>
      <span class="card--me__text">
        <span class="card--me__name">You're <span data-ref="meName"></span></span>
        <span class="card--me__sub">in this demo family</span>
      </span>
      <button type="button" class="pill-btn pill-btn--dark" data-act="pin">Change PIN</button>
    </section>

    <h3 class="group-title">Peace of Mind</h3>
    <section class="card card--peace">
      <div class="peace-hero">
        <span class="peace-hero__ic">${icon("shield", 22)}</span>
        <span class="peace-hero__text">
          <span class="peace-hero__title">Is everyone's phone ready?</span>
          <span class="peace-hero__sub">Pings every phone in the family and checks that its GPS can find it. Nobody's location is shown.</span>
        </span>
      </div>
      <button type="button" class="btn btn--peace" data-act="peace" data-ref="peaceBtn">Check everyone now</button>
    </section>

    <h3 class="group-title">Safety</h3>
    <section class="card list">
      ${row("nightly", "moon", "Nightly check-in")}
      ${row("checkin", "timer", "Check-in timer")}
    </section>

    <h3 class="group-title">Private Mode</h3>
    <section class="card list">
      ${row("private", "message", "Private Mode")}
    </section>

    <h3 class="group-title">Activity</h3>
    <section class="card list">
      ${row("log", "list", "Activity log")}
    </section>

    <h3 class="group-title">Demo</h3>
    <section class="card list">
      ${row("demo", "flask", "Demo controls")}
      ${row("sound", "sound", "Sound", "", false)}
      ${row("reset", "refresh", "Start the evening over", "", false)}
      ${row("signout", "logout", "Sign out", "", false, "row--danger")}
    </section>

    <p class="page__foot">Chill is a mock. Nothing here is real: no locations, no messages, no calls.</p>
  `);
  const r = refs(node);

  function refresh() {
    const s = ctx.store.get();
    const now = ctx.store.now();
    const me = s.members[ctx.viewer()];
    r.meAv.innerHTML = avatar(me, 52);
    text(r.meName, me.name);
    text(r.nightlyValue, me.nightly.on ? L.fmtHHMM(me.nightly.time) : "Off");
    text(r.checkinValue, me.checkIn ? `By ${L.fmtClock(me.checkIn.due)}` : "Off");
    text(r.privateValue, s.disguise.on ? "On" : "Off");
    text(r.logValue, `${s.log.length}`);
    text(r.soundValue, s.sound ? "On" : "Off");
    const wait = L.peaceReadyIn(s, now);
    r.peaceBtn.disabled = wait > 0;
    text(r.peaceBtn, wait > 0 ? `Ready again in ${Math.ceil(wait / 1000)} s` : "Check everyone now");
  }

  const stopWatching = ctx.watch(refresh);
  function close() {
    stopWatching();
    slideOut(node);
    onClose();
  }

  onAct(node, {
    back: close,
    pin: () => ctx.changePin(),
    peace: () => ctx.openPeace(),
    nightly: () => nightlySheet(ctx),
    checkin: () => checkInSheet(ctx),
    private: () => openPrivateMode(host, ctx),
    log: () => openLog(host, ctx),
    demo: () => ctx.openDemo(),
    sound: () => ctx.store.update((s) => { s.sound = !s.sound; }),
    reset: async () => {
      const yes = await confirmSheet({
        title: "Start the evening over?",
        message: "The demo clock goes back to 9:10 PM and every alert, share and check-in resets. Your PINs and settings stay.",
        yes: "Start over",
      });
      if (yes) {
        ctx.store.reset();
        toast("A fresh evening. It's 9:10 PM.");
      }
    },
    signout: async () => {
      const yes = await confirmSheet({ title: "Sign out?", message: "You'll need the username and password to come back.", yes: "Sign out", danger: true });
      if (yes) ctx.signOut();
    },
  });

  refresh();
  slideIn(host, node);
  return { close };
}

/* ---- Private Mode ---------------------------------------------------- */

function openPrivateMode(host, ctx) {
  const node = page("Private Mode", `
    <section class="card">
      <div class="row row--static">
        <span class="row__ic">${icon("message", 19)}</span>
        <span class="row__label">Private Mode</span>
        <button type="button" class="switch" role="switch" data-act="pm-toggle" data-ref="pmSwitch" aria-label="Private Mode"><span></span></button>
      </div>
      <p class="card__text">Chill opens as an ordinary text conversation instead. Nobody glancing at your phone sees a safety app.</p>
    </section>

    <h3 class="group-title">Looks like</h3>
    <div class="seg" role="radiogroup" aria-label="Looks like" data-ref="seg">
      <button type="button" role="radio" data-style="auto">Auto</button>
      <button type="button" role="radio" data-style="imessage">iMessage</button>
      <button type="button" role="radio" data-style="android">Android</button>
    </div>
    <p class="hint">Auto matches this phone: iMessage on iPhone, Google Messages on Android.</p>

    <h3 class="group-title">Conversation</h3>
    <section class="card list" data-ref="presets">
      ${PRESETS.map((p) => `<button type="button" class="row" role="radio" data-preset="${p.id}">
        <span class="av" style="--av:${p.color};--sz:34px" aria-hidden="true">${p.initial}</span>
        <span class="row__stack"><span class="row__label">${p.name}</span><span class="row__sub">${p.blurb}</span></span>
        <span class="row__tick">${icon("check", 18, 2.6)}</span>
      </button>`).join("")}
      <button type="button" class="row" role="radio" data-preset="custom">
        <span class="row__ic">${icon("plus", 19)}</span>
        <span class="row__stack"><span class="row__label">Your own</span><span class="row__sub">Pick the name and write the messages</span></span>
        <span class="row__tick">${icon("check", 18, 2.6)}</span>
      </button>
    </section>
    <section class="card custom" data-ref="custom" hidden>
      <label class="field"><span class="field__label">Their name</span><input class="field__input" type="text" maxlength="30" data-ref="customName" placeholder="Jordan"></label>
      <label class="field"><span class="field__label">Messages, one per line. Start yours with “me:”</span>
        <textarea class="field__input field__input--area" rows="7" data-ref="customLines" placeholder="hey are you coming saturday&#10;me: yeah I think so&#10;ok cool, 7?"></textarea>
      </label>
      <button type="button" class="btn btn--light" data-act="custom-save">Save conversation</button>
    </section>

    <h3 class="group-title">How it works</h3>
    <section class="card how">
      <p><b>Hold any message.</b> Sends a silent alert. A second later they start typing for 20 seconds, then stop. That's your sign it went out.</p>
      <p><b>Hold the message box.</b> Opens settings.</p>
      <p><b>Hold send</b>, or the microphone that sits there when the box is empty. Opens the map.</p>
      <p><b>Type and send.</b> Your texts look delivered and delete themselves after 24 hours.</p>
    </section>
    <p class="warn">${icon("alert", 16, 2.2)} Texts you type in Private Mode go nowhere, even though they say Delivered. To get help, hold any message.</p>
    <p class="hint">Add Chill to your Home Screen so there's no browser bar. On iPhone: Share, then Add to Home Screen.</p>
  `);
  const r = refs(node);

  function refresh() {
    const d = ctx.store.get().disguise;
    r.pmSwitch.setAttribute("aria-checked", String(d.on));
    r.seg.querySelectorAll("[data-style]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.style === d.style)));
    r.presets.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.preset === d.preset)));
    r.custom.hidden = d.preset !== "custom";
  }
  const d0 = ctx.store.get().disguise;
  r.customName.value = d0.customName;
  r.customLines.value = d0.customLines;

  const stopWatching = ctx.watch(refresh);
  function close() {
    stopWatching();
    slideOut(node);
  }

  onAct(node, {
    back: close,
    "pm-toggle": () => {
      const turningOn = !ctx.store.get().disguise.on;
      ctx.store.update((s, now) => {
        s.disguise.on = turningOn;
        L.addLog(s, now, `${s.members[ctx.viewer()].name} turned Private Mode ${turningOn ? "on" : "off"}.`);
      });
      if (turningOn) ctx.enterDisguise();
    },
    "custom-save": () => {
      ctx.store.update((s) => {
        s.disguise.customName = r.customName.value.trim() || "Jordan";
        s.disguise.customLines = r.customLines.value;
        s.disguise.preset = "custom";
      });
      toast("Conversation saved.");
    },
  });
  r.seg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-style]");
    if (b) ctx.store.update((s) => { s.disguise.style = b.dataset.style; });
  });
  r.presets.addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]");
    if (b) ctx.store.update((s) => { s.disguise.preset = b.dataset.preset; });
  });

  refresh();
  slideIn(host, node);
}

/* ---- the shared activity log ----------------------------------------- */

function openLog(host, ctx) {
  const node = page("Activity log", `
    <p class="hint hint--top">${icon("eye", 15)} Everyone in the family sees this same log. Anything that opens a location is written here, so nobody can look quietly.</p>
    <ol class="log" data-ref="list"></ol>
  `);
  const r = refs(node);
  let shown = -1;
  function refresh() {
    const log = ctx.store.get().log;
    if (log.length === shown) return;
    shown = log.length;
    r.list.innerHTML = "";
    for (const entry of log.slice().reverse()) {
      const li = el(`<li class="log__item"><span class="log__time"></span><span class="log__text"></span></li>`);
      li.firstElementChild.textContent = L.fmtClock(entry.at);
      li.lastElementChild.textContent = entry.text;
      r.list.appendChild(li);
    }
  }
  const stopWatching = ctx.watch(refresh);
  onAct(node, {
    back: () => {
      stopWatching();
      slideOut(node);
    },
  });
  refresh();
  slideIn(host, node);
}
