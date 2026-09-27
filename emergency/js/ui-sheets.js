/* The bottom sheets Home opens: sharing, check-ins, nightly, family. */

import { el } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import { openSheet, toast, avatar, shareUntil, hasFix } from "./ui-common.js";

function option(label, sub, act, ic) {
  return `<button type="button" class="opt" data-opt="${act}">
    <span class="opt__ic">${icon(ic, 20)}</span>
    <span class="opt__text"><span class="opt__label">${label}</span>${sub ? `<span class="opt__sub">${sub}</span>` : ""}</span>
    <span class="opt__go">${icon("chevron", 18)}</span>
  </button>`;
}

export function shareSheet(ctx) {
  const s = ctx.store.get();
  const inc = L.activeIncident(s);
  const canTieToEmergency = inc && !L.inTrouble(inc, ctx.viewer());
  const body = el(`
    <div class="opts">
      <p class="sheet__lede">Everyone in your family will see where you are, and you'll see a reminder at the top of Home the whole time.</p>
      ${option("For 1 hour", "", "1h", "clock")}
      ${option("For 4 hours", "", "4h", "clock")}
      ${option("Until I turn it off", "You can stop any time", "on", "broadcast")}
      ${canTieToEmergency ? option("Until this emergency ends", "Stops by itself when it's over", "emergency", "alert") : ""}
    </div>`);
  const sheet = openSheet({ title: "Share your location", body });
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-opt]");
    if (!b) return;
    const choice = b.dataset.opt;
    ctx.store.update((st, now) => {
      if (choice === "1h") L.setShare(st, ctx.viewer(), "timed", now, L.HOUR);
      else if (choice === "4h") L.setShare(st, ctx.viewer(), "timed", now, 4 * L.HOUR);
      else L.setShare(st, ctx.viewer(), choice, now);
    });
    sheet.close();
    const me = ctx.store.get().members[ctx.viewer()];
    toast(`Your family can see you ${shareUntil(me)}.`);
  });
}

export function checkInSheet(ctx) {
  const s = ctx.store.get();
  const me = s.members[ctx.viewer()];
  const body = el(`
    <div class="opts">
      <p class="sheet__lede">If you don't check in by then, your phone rings for 2 minutes. Then your family is alerted and your location opens, just like the button.</p>
      ${option("In 30 minutes", "", "30", "timer")}
      ${option("In 1 hour", "", "60", "timer")}
      ${option("In 2 hours", "", "120", "timer")}
      <label class="field">
        <span class="field__label">Or pick a time</span>
        <span class="field__row">
          <input class="field__input" type="time" data-time>
          <button type="button" class="btn btn--light btn--small" data-set-time>Set</button>
        </span>
      </label>
      <label class="field">
        <span class="field__label">Note, sealed unless you miss it</span>
        <input class="field__input" type="text" maxlength="80" placeholder="Walking home from Sam's" data-note>
      </label>
      ${me.checkIn ? `<button type="button" class="btn btn--dark" data-cancel-checkin>Cancel my check-in</button>` : ""}
    </div>`);
  const sheet = openSheet({ title: "Check-in timer", body });
  const note = body.querySelector("[data-note]");
  if (me.checkIn) note.value = me.checkIn.note;

  function start(dueAt) {
    ctx.store.update((st, now) => L.setCheckIn(st, ctx.viewer(), dueAt, note.value.trim(), now));
    sheet.close();
    toast(`Check in by ${L.fmtClock(dueAt)}.`);
  }
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-opt]");
    if (b) start(ctx.store.now() + Number(b.dataset.opt) * L.MIN);
    if (e.target.closest("[data-set-time]")) {
      const v = body.querySelector("[data-time]").value;
      if (!v) return;
      const [hh, mm] = v.split(":").map(Number);
      const d = new Date(ctx.store.now());
      let due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
      if (due <= ctx.store.now()) due += 24 * L.HOUR;
      start(due);
    }
    if (e.target.closest("[data-cancel-checkin]")) {
      ctx.store.update((st, now) => {
        L.clearCheckIn(st, ctx.viewer());
        L.addLog(st, now, `${me.name} cancelled a check-in.`);
      });
      sheet.close();
    }
  });
}

export function nightlySheet(ctx) {
  const me = ctx.store.get().members[ctx.viewer()];
  const body = el(`
    <div class="opts">
      <p class="sheet__lede">Check in any time in the 3 hours before. Miss it, and it works like a missed check-in timer.</p>
      <label class="field">
        <span class="field__label">Every night by</span>
        <input class="field__input" type="time" data-time>
      </label>
      <button type="button" class="btn btn--light" data-save>Save</button>
    </div>`);
  body.querySelector("[data-time]").value = me.nightly.time;
  const sheet = openSheet({ title: "Nightly check-in", body });
  body.querySelector("[data-save]").addEventListener("click", () => {
    const v = body.querySelector("[data-time]").value || me.nightly.time;
    ctx.store.update((st, now) => {
      const n = st.members[ctx.viewer()].nightly;
      n.time = v;
      n.on = true;
      n.since = now;
      L.addLog(st, now, `${me.name}'s nightly check-in is now ${L.fmtHHMM(v)}.`);
    });
    sheet.close();
  });
}

export function familySheet(ctx) {
  const s = ctx.store.get();
  const now = ctx.store.now();
  const viewer = ctx.viewer();
  const me = s.members[viewer];
  const rows = L.MEMBERS.filter((id) => id !== viewer).map((id) => {
    const m = s.members[id];
    const why = L.canSee(s, viewer, id, now);
    let status = "Private";
    let tone = "";
    if (why === "sharing") {
      status = `Sharing ${shareUntil(m)}`;
      if (hasFix(m)) status += ` · ${L.distanceMi(me.pos, m.pos).toFixed(1)} mi`;
      tone = "share";
    } else if (why === "presser") {
      status = "Needs help";
      tone = "red";
    }
    const extras = [];
    if (m.checkIn) extras.push(`check-in by ${L.fmtClock(m.checkIn.due)}`);
    if (m.nightly.on) extras.push(`checks in nightly by ${L.fmtHHMM(m.nightly.time)}`);
    return `<div class="fam-row">
      ${avatar(m, 40)}
      <span class="fam-row__text">
        <span class="fam-row__name">${m.name}</span>
        <span class="fam-row__status ${tone ? `is-${tone}` : ""}">${status}${extras.length ? ` · ${extras.join(" · ")}` : ""}</span>
      </span>
    </div>`;
  }).join("");
  const body = el(`<div class="fam">
    ${rows}
    <p class="sheet__foot">${icon("lock", 14)} Locations stay private unless someone shares or an emergency is on. Everything that opens a location is in the activity log.</p>
  </div>`);
  openSheet({ title: "Family", body });
}
