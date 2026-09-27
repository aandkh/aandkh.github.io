/* Chill: start-up, the shell, and the glue between screens. */

import { el, refs } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import * as store from "./store.js";
import * as sim from "./sim.js";
import * as gate from "./gate.js";
import { askPin } from "./ui-pin.js";
import { setToastHost, setOverlayHost, setToastsMuted, toast, clearToasts, unlockAudio, alarm, chime, openSheet } from "./ui-common.js";
import { mountHome } from "./ui-home.js";
import { mountMapView } from "./ui-mapview.js";
import { showTakeover, showLastCall } from "./ui-alert.js";
import { openSettings } from "./ui-settings.js";
import { openPeace } from "./ui-peace.js";
import { openDemo } from "./ui-demo.js";
import { renderGate, chooseViewer } from "./ui-start.js";
import { mountDisguise, codedAlert, CODED } from "./ui-disguise.js";

const root = document.getElementById("root");
document.addEventListener("pointerdown", unlockAudio, { passive: true });

const ui = {
  tab: "home",
  disguiseAway: false,   // the map is open from Private Mode
  settingsOpen: false,
  ack: null,             // { id, count }: the emergency this viewer was already alerted to
  takeover: null,
  lastCall: null,
};
const watchers = new Set();
let r = null;
let home = null;
let mapView = null;
let disguise = null;
let safeTop = 0;

async function start() {
  const s = store.load();
  if (!s.viewer || !s.members[s.viewer]) {
    const id = await chooseViewer(root, s);
    store.update((st) => { st.viewer = id; });
  }
  await ensurePin(root, store.get().viewer);
  mountShell();
  store.start();
}

async function ensurePin(host, id) {
  const s = store.get();
  if (s.members[id].pin) return;
  const pin = await askPin(host, {
    title: `Set ${s.members[id].name}'s PIN`,
    sub: "4 digits. You'll need it to turn off an alert, so nobody who grabs your phone can.",
    mode: "setup",
    canCancel: false,
  });
  store.update((st) => L.setPin(st, id, pin));
}

/* ---- the shell ------------------------------------------------------ */

function mountShell() {
  const shell = el(`
    <div class="phone">
      <div class="layer layer--map" data-ref="mapLayer"></div>
      <div class="layer layer--home" data-ref="homeLayer"></div>
      <nav class="dock" data-ref="dock" aria-label="Main">
        <button type="button" class="dock__btn" data-tab="home">${icon("home", 19)} Home</button>
        <button type="button" class="dock__btn" data-tab="map">${icon("map", 19)} Map</button>
      </nav>
      <button type="button" class="back-chat" data-ref="backChat" hidden>${icon("back", 18)} Back</button>
      <div class="layer layer--disguise" data-ref="disguiseLayer"></div>
      <div class="layer layer--overlays" data-ref="overlays"></div>
      <div class="toasts" data-ref="toasts" aria-live="polite"></div>
      <button type="button" class="demo-tab" data-ref="demoTab" aria-label="Demo controls">DEMO</button>
      <span class="safe-probe" data-ref="probe" aria-hidden="true"></span>
    </div>`);
  root.innerHTML = "";
  root.appendChild(shell);
  r = refs(shell);
  safeTop = r.probe.offsetHeight;
  setToastHost(r.toasts);
  setOverlayHost(r.overlays);

  home = mountHome(r.homeLayer, ctx);
  mapView = mountMapView(r.mapLayer, ctx);
  disguise = mountDisguise(r.disguiseLayer, ctx);

  r.dock.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) ctx.go(b.dataset.tab);
  });
  r.demoTab.addEventListener("click", () => openDemo(ctx));
  r.backChat.addEventListener("click", () => {
    ui.disguiseAway = false;
    ui.tab = "home";
    render();
  });

  // Reopening Chill mid-emergency should not sound the alarm again for
  // one this person has already seen.
  const s = store.get();
  const inc = L.activeIncident(s);
  if (inc && inc.responses[s.viewer] && inc.responses[s.viewer].state !== "unseen") {
    ui.ack = { id: inc.id, count: inc.people.length };
  }

  store.onChange(() => render());
  store.onEvent(onEvent);
  render();
}

function render() {
  const s = store.get();
  const now = store.now();
  const viewer = s.viewer;
  const inc = L.activeIncident(s);
  const mine = inc && inc.people.find((p) => p.id === viewer);
  const emergencyHome = !!inc && !(mine && mine.kind === "silent");
  const disguised = s.disguise.on && !ui.disguiseAway;

  noticeIncoming(s, inc, viewer, now, disguised);

  const tilesShown = ui.tab === "home" && !emergencyHome;
  r.homeLayer.hidden = !tilesShown;
  if (tilesShown) home.update(s, now);
  mapView.update(s, now, { visible: !tilesShown, expand: ui.tab === "home" });

  r.dock.querySelectorAll("[data-tab]").forEach((b) => {
    if (b.dataset.tab === ui.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  r.dock.classList.toggle("is-emergency", !!inc && !(mine && mine.kind === "silent"));

  disguise.update(s, now, disguised);
  r.backChat.hidden = !(s.disguise.on && ui.disguiseAway);
  r.demoTab.hidden = disguised;
  setToastsMuted(disguised);
  setThemeColor(disguised ? disguise.headerColor() : "#0B0D12");

  if (ui.lastCall) {
    const c = s.members[viewer].checkIn;
    if (!c || now < c.due) closeLastCall();
    else ui.lastCall.update(now);
  }
  for (const fn of watchers) fn(s);
}

function setThemeColor(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && meta.content !== color) meta.content = color;
}

/* Someone else's emergency reaching this phone. */
function noticeIncoming(s, inc, viewer, now, disguised) {
  if (!inc) {
    ui.ack = null;
    if (ui.takeover) { ui.takeover.close(); ui.takeover = null; }
    return;
  }
  if (L.inTrouble(inc, viewer)) {
    ui.ack = { id: inc.id, count: inc.people.length };
    if (ui.takeover) { ui.takeover.close(); ui.takeover = null; }
    return;
  }
  const count = inc.people.length;
  if (ui.ack && ui.ack.id === inc.id && ui.ack.count >= count) return;
  ui.ack = { id: inc.id, count };
  if (disguised) {
    receiveCoded(codedAlert(count + inc.startedAt));
    return;
  }
  alarm(s);
  clearToasts();
  ui.tab = "home";
  if (ui.takeover) ui.takeover.close();
  ui.takeover = showTakeover(r.overlays, s, inc, viewer, now, () => {
    ui.takeover = null;
    store.update((st, t) => {
      const live = L.activeIncident(st);
      if (live) L.respond(st, live.id, viewer, "seen", t);
    });
  });
}

function receiveCoded(text) {
  store.update((st, now) => {
    st.disguise.inbox.push({ id: `in-${now}`, text, at: now });
  });
}

function closeLastCall() {
  if (ui.lastCall) {
    ui.lastCall.close();
    ui.lastCall = null;
  }
}

function onEvent(ev) {
  const s = store.get();
  const viewer = s.viewer;
  const disguised = s.disguise.on && !ui.disguiseAway;
  if (ev.id === viewer) {
    if (ev.type === "checkin-reminder") {
      if (disguised) receiveCoded(CODED.reminder);
      else {
        chime(s);
        toast(`Check in by ${L.fmtClock(ev.due)}. 5 minutes left.`, { action: { label: "I'm OK", fn: () => ctx.checkInNow() }, ms: 8000 });
      }
    } else if (ev.type === "checkin-lastcall") {
      if (disguised) receiveCoded(CODED.lastcall);
      else if (!ev.nightly || s.members[viewer].nightly.on) {
        alarm(s);
        closeLastCall();
        clearToasts();
        ui.lastCall = showLastCall(r.overlays, ev.due, () => {
          ui.lastCall = null;
          ctx.checkInNow();
        });
        ui.lastCall.update(store.now());
      }
    } else if (ev.type === "checkin-missed") {
      closeLastCall();
      if (!disguised) ui.tab = "home";
    } else if (ev.type === "share-ended") {
      toast("Your location sharing ended. You're private again.");
    }
  } else if (ev.type === "arrived" && ev.to === viewer) {
    toast(`${L.nameOf(s, ev.id)} is here.`);
  } else if (ev.type === "share-ended") {
    toast(`${L.nameOf(s, ev.id)} stopped sharing.`);
  }
  render();
}

/* ---- what screens can ask for ---------------------------------------- */

function pickReason() {
  return new Promise((resolve) => {
    const body = el(`
      <div class="opts">
        <p class="sheet__lede">Either way your family is told, and everyone's location goes private again. You'll need your PIN.</p>
        <button type="button" class="opt" data-why="safe">
          <span class="opt__ic opt__ic--good">${icon("check", 20, 2.4)}</span>
          <span class="opt__text"><span class="opt__label">I'm safe</span><span class="opt__sub">Tells everyone you're OK</span></span>
          <span class="opt__go">${icon("chevron", 18)}</span>
        </button>
        <button type="button" class="opt" data-why="accident">
          <span class="opt__ic">${icon("x", 20, 2.4)}</span>
          <span class="opt__text"><span class="opt__label">It was an accident</span><span class="opt__sub">Cancels a false alarm</span></span>
          <span class="opt__go">${icon("chevron", 18)}</span>
        </button>
      </div>`);
    let answer = null;
    const sheet = openSheet({ title: "End the alert", body, onClose: () => resolve(answer) });
    body.addEventListener("click", (e) => {
      const b = e.target.closest("[data-why]");
      if (!b) return;
      answer = b.dataset.why;
      sheet.close();
    });
  });
}

const ctx = {
  store,
  viewer: () => store.get().viewer,
  tab: () => ui.tab,
  safeTop: () => safeTop,
  refresh: () => render(),
  watch(fn) {
    watchers.add(fn);
    return () => watchers.delete(fn);
  },
  go(tab) {
    ui.tab = tab;
    render();
  },

  trigger(kind) {
    const s = store.get();
    const viewer = s.viewer;
    const inc = L.activeIncident(s);
    const mine = inc && inc.people.find((p) => p.id === viewer);
    if (mine && mine.kind === "silent" && kind === "button") {
      store.update((st, now) => {
        const p = L.activeIncident(st).people.find((x) => x.id === viewer);
        p.kind = "button";
        L.addLog(st, now, `${L.nameOf(st, viewer)} turned the silent alert into a full alert.`);
      });
    } else if (!mine) {
      store.update((st, now) => L.startIncident(st, viewer, kind, now));
    }
    if (kind === "button") ui.tab = "home";
    render();
  },

  async endMine() {
    const viewer = store.get().viewer;
    const inc = L.activeIncident(store.get());
    if (!inc || !L.inTrouble(inc, viewer)) return;
    const reason = await pickReason();
    if (!reason) return;
    const pin = await askPin(r.overlays, {
      title: "Enter your PIN",
      sub: reason === "safe" ? "Tells your family you're safe." : "Cancels the alert.",
      check: (p) => L.pinMatches(store.get(), viewer, p),
    });
    if (!pin) return;
    store.update((st, now) => {
      const live = L.activeIncident(st);
      if (live) L.endIncident(st, live.id, viewer, reason, now);
    });
    toast(reason === "safe" ? "Your family knows you're safe. You're private again." : "Alert cancelled. You're private again.");
  },

  checkInNow() {
    const viewer = store.get().viewer;
    const counted = store.update((st, now) => L.checkIn(st, viewer, now));
    closeLastCall();
    toast(counted ? "Checked in. Thanks." : "Nothing is due yet, but thanks.");
  },

  headOver() {
    const viewer = store.get().viewer;
    store.update((st, now) => {
      const inc = L.activeIncident(st);
      if (!inc) return;
      L.respond(st, inc.id, viewer, "seen", now);
      sim.headOver(st, viewer, now);
    });
  },

  openSettings() {
    if (ui.settingsOpen) return;
    ui.settingsOpen = true;
    openSettings(r.overlays, ctx, () => { ui.settingsOpen = false; });
  },
  openPeace() {
    // Once every 30 seconds, enforced here and shown on the button.
    const started = store.update((st, now) => L.startPeace(st, now));
    if (!started) {
      toast(`Peace of Mind is ready again in ${Math.ceil(L.peaceReadyIn(store.get(), store.now()) / 1000)} seconds.`);
      return;
    }
    openPeace(r.overlays, ctx);
  },
  openDemo: () => openDemo(ctx),

  async changePin() {
    const viewer = store.get().viewer;
    const current = await askPin(r.overlays, { title: "Enter your current PIN", check: (p) => L.pinMatches(store.get(), viewer, p) });
    if (!current) return;
    const next = await askPin(r.overlays, { title: "Choose a new PIN", sub: "4 digits.", mode: "setup" });
    if (!next) return;
    store.update((st) => L.setPin(st, viewer, next));
    toast("PIN changed.");
  },

  async becomePerson(id) {
    store.update((st) => { st.viewer = id; });
    const s = store.get();
    const inc = L.activeIncident(s);
    ui.ack = inc && inc.responses[id] && inc.responses[id].state !== "unseen" ? { id: inc.id, count: inc.people.length } : null;
    ui.tab = "home";
    await ensurePin(r.overlays, id);
    render();
    toast(`You're ${s.members[id].name} now.`);
  },

  enterDisguise() {
    r.overlays.querySelectorAll(".page").forEach((n) => n.remove());
    ui.settingsOpen = false;
    ui.disguiseAway = false;
    render();
  },
  showMapFromDisguise() {
    ui.disguiseAway = true;
    ui.tab = "map";
    render();
  },
  silentFromDisguise() {
    const s = store.get();
    const inc = L.activeIncident(s);
    if (!inc || !L.inTrouble(inc, s.viewer)) store.update((st, now) => L.startIncident(st, st.viewer, "silent", now));
  },
  sendDisguisedText(value) {
    store.update((st, now) => {
      L.addSentText(st, value, now);
      const me = st.members[st.viewer];
      const nightly = L.nextNightlyDue(me, now);
      const due = (me.checkIn && now >= me.checkIn.due - L.REMIND_BEFORE)
        || (nightly !== null && now >= nightly - L.NIGHTLY_WINDOW);
      if (due) L.checkIn(st, st.viewer, now);
    });
  },

  signOut() {
    gate.signOut();
    location.reload();
  },
};

/* Start last, once everything above exists. */
if (gate.isSignedIn()) start();
else renderGate(root, start);
