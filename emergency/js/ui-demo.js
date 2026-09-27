/* The demo panel: pretend controls that are not part of Chill itself. */

import { el, refs, text } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import * as sim from "./sim.js";
import { openSheet, toast, avatar } from "./ui-common.js";

const DEVICES = [
  ["ok", "OK"],
  ["offline", "Off"],
  ["locationOff", "No GPS"],
  ["alertsOff", "Alerts off"],
];

export function openDemo(ctx) {
  const body = el(`
    <div class="demo">
      <p class="sheet__lede">Pretend controls for trying Chill. They aren't part of the app.</p>

      <h3 class="demo__h">You are</h3>
      <div class="demo-who" data-ref="who"></div>

      <h3 class="demo__h">Make someone else</h3>
      <div class="demo-pick" data-ref="pick" role="radiogroup" aria-label="Who"></div>
      <div class="demo-acts">
        <button type="button" class="btn btn--red btn--small" data-sim="press">${icon("alert", 16, 2.2)} Press Emergency</button>
        <button type="button" class="btn btn--dark btn--small" data-sim="silent">${icon("bellOff", 16, 2.2)} Send a silent alert</button>
        <button type="button" class="btn btn--dark btn--small" data-sim="miss">${icon("timer", 16, 2.2)} Miss a check-in</button>
      </div>

      <h3 class="demo__h">Their phones</h3>
      <p class="demo__note">For Peace of Mind: a phone that is off never answers, and a phone with alerts off never sees an emergency.</p>
      <div class="demo-phones" data-ref="phones"></div>

      <h3 class="demo__h">Demo clock <span class="demo__clock" data-ref="clock"></span></h3>
      <div class="demo-acts">
        <button type="button" class="btn btn--dark btn--small" data-skip="5">+5 min</button>
        <button type="button" class="btn btn--dark btn--small" data-skip="30">+30 min</button>
        <button type="button" class="btn btn--dark btn--small" data-skip="120">+2 hours</button>
      </div>
    </div>`);
  const r = refs(body);
  let target = null;

  function render() {
    const s = ctx.store.get();
    const viewer = ctx.viewer();
    r.who.innerHTML = L.MEMBERS.map((id) => {
      const m = s.members[id];
      return `<button type="button" class="demo-person ${id === viewer ? "is-on" : ""}" data-be="${id}" aria-pressed="${id === viewer}">
        ${avatar(m, 44)}<span>${m.name}</span></button>`;
    }).join("");
    const others = L.MEMBERS.filter((id) => id !== viewer);
    if (!others.includes(target)) target = others[0];
    r.pick.innerHTML = others.map((id) => `<button type="button" role="radio" class="demo-chip" aria-checked="${id === target}" data-target="${id}">${s.members[id].name}</button>`).join("");
    r.phones.innerHTML = others.map((id) => {
      const m = s.members[id];
      return `<div class="demo-phone">
        <span class="demo-phone__who">${avatar(m, 28)}${m.name}</span>
        <span class="seg seg--small" role="radiogroup" aria-label="${m.name}'s phone">
          ${DEVICES.map(([v, label]) => `<button type="button" role="radio" aria-checked="${m.device === v}" data-dev="${id}:${v}">${label}</button>`).join("")}
        </span>
      </div>`;
    }).join("");
    text(r.clock, L.fmtClock(ctx.store.now()));
  }

  const sheet = openSheet({ title: "Demo controls", body, cls: "sheet-wrap--demo", onClose: () => stop() });
  const stop = ctx.watch(() => text(r.clock, L.fmtClock(ctx.store.now())));

  body.addEventListener("click", (e) => {
    const be = e.target.closest("[data-be]");
    if (be) {
      sheet.close();
      ctx.becomePerson(be.dataset.be);
      return;
    }
    const pick = e.target.closest("[data-target]");
    if (pick) {
      target = pick.dataset.target;
      render();
      return;
    }
    const act = e.target.closest("[data-sim]");
    if (act) {
      const what = act.dataset.sim;
      ctx.store.update((s, now) => sim.simulate(s, what, target, now));
      sheet.close();
      return;
    }
    const dev = e.target.closest("[data-dev]");
    if (dev) {
      const [id, v] = dev.dataset.dev.split(":");
      ctx.store.update((s) => { s.members[id].device = v; });
      render();
      return;
    }
    const skip = e.target.closest("[data-skip]");
    if (skip) {
      ctx.store.skip(Number(skip.dataset.skip) * L.MIN);
      toast(`It's now ${L.fmtClock(ctx.store.now())}.`, { key: "clock", ms: 2000 });
    }
  });

  render();
}
