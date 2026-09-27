/* Peace of Mind: the side panel.
 *
 * Two lines per person, Phone: On and GPS: Located, each with a green
 * check when it passes. Failures are said plainly. No position is shown,
 * and in this mock every result is labeled as simulated.
 */

import { el, refs, text, open } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import * as sim from "./sim.js";
import { avatar } from "./ui-common.js";

const SPIN = '<span class="spin" aria-hidden="true"></span>';

function line(label, state) {
  // state: [kind, words] where kind is ok | bad | wait | skip
  const [kind, words] = state;
  const mark = kind === "ok" ? `<span class="pm-mark pm-mark--ok">${icon("check", 14, 3)}</span>`
    : kind === "bad" ? `<span class="pm-mark pm-mark--bad">${icon("x", 13, 3)}</span>`
    : kind === "skip" ? '<span class="pm-mark pm-mark--skip"></span>'
    : SPIN;
  return `<div class="pm-line pm-line--${kind}">${mark}<span>${label}: <b>${words}</b></span></div>`;
}

function phoneState(row) {
  if (row.phone === "on") return ["ok", "On"];
  if (row.phone === "no-answer") return ["bad", "No answer"];
  return ["wait", "Pinging…"];
}

function gpsState(row) {
  if (row.gps === "located") return ["ok", "Located"];
  if (row.gps === "off") return ["bad", "Off"];
  if (row.gps === "locating") return ["wait", "Locating…"];
  if (row.gps === null) return ["skip", "Not checked"];
  return ["skip", "Waiting"];
}

export function openPeace(host, ctx) {
  const s0 = ctx.store.get();
  const node = el(`
    <div class="side-wrap">
      <div class="side-scrim" data-close></div>
      <aside class="side" role="dialog" aria-modal="true" aria-labelledby="peace-title">
        <header class="side__head">
          <span class="side__ic">${icon("shield", 22)}</span>
          <span class="side__titles">
            <h2 class="side__title" id="peace-title">Peace of Mind</h2>
            <span class="badge badge--demo">Demo: simulated results</span>
          </span>
          <button type="button" class="icon-btn icon-btn--small" data-close aria-label="Close">${icon("x", 18)}</button>
        </header>
        <p class="side__lede">Pinging every phone in the family and asking its GPS for a fresh fix. Nobody's location is shown, only whether it worked.</p>
        <div class="pm-list" data-ref="list"></div>
        <footer class="side__foot" data-ref="foot" aria-live="polite">Checking…</footer>
      </aside>
    </div>`);
  const r = refs(node);
  host.appendChild(node);
  open(node);

  let cancel = null;
  function close() {
    if (cancel) cancel();
    node.classList.remove("is-open");
    setTimeout(() => node.remove(), 300);
  }
  node.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });

  const viewer = ctx.viewer();
  const cards = new Map();
  let logged = false;

  cancel = sim.peaceRun(s0, viewer, (rows) => {
    for (const row of rows) {
      const m = s0.members[row.id];
      let card = cards.get(row.id);
      if (!card) {
        card = el(`<div class="pm-row">
          <div class="pm-row__who">${avatar(m, 36)}<span class="pm-row__name">${m.name}</span><span class="pm-row__time" data-ref="time"></span></div>
          <div class="pm-row__lines" data-ref="lines"></div>
          <p class="pm-row__note" data-ref="note" hidden></p>
        </div>`);
        r.list.appendChild(card);
        cards.set(row.id, card);
      }
      const cr = refs(card);
      const html = line("Phone", phoneState(row)) + line("GPS", gpsState(row));
      if (cr.lines.innerHTML !== html) cr.lines.innerHTML = html;
      card.classList.toggle("is-done", row.done);
      if (row.done && !cr.time.textContent) {
        const t = new Date(ctx.store.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
        text(cr.time, t);
      }
      cr.note.hidden = !row.alertsOff;
      if (row.alertsOff) text(cr.note, `Alerts are turned off on ${m.name}'s phone, so ${m.name} wouldn't hear an emergency.`);
    }
    if (rows.every((x) => x.done) && !logged) {
      logged = true;
      const ready = rows.filter((x) => x.phone === "on" && x.gps === "located" && !x.alertsOff);
      const problems = rows.filter((x) => !ready.includes(x)).map((x) => {
        const n = s0.members[x.id].name;
        if (x.phone === "no-answer") return `${n}'s phone didn't answer`;
        if (x.gps === "off") return `${n}'s GPS is off`;
        return `${n}'s alerts are off`;
      });
      const at = new Date(ctx.store.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
      text(r.foot, problems.length
        ? `Checked at ${at}. ${ready.length} of ${rows.length} ready. ${problems.join(". ")}.`
        : `Checked at ${at}. All ${rows.length} phones answered and found their GPS.`);
      r.foot.classList.toggle("is-good", !problems.length);
      ctx.store.update((s, now) => {
        const who = s.members[viewer].name;
        L.addLog(s, now, `${who} ran Peace of Mind: ${ready.length} of ${rows.length} phones ready${problems.length ? ` (${problems.join("; ")})` : ""}. No locations were shown.`);
      });
    }
  });
  return { close };
}
