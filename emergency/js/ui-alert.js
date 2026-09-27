/* Full-screen interruptions: someone else's emergency arriving, and the
 * last call when your own check-in is due. */

import { el, text, open } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import { joinNames } from "./ui-common.js";

/* Someone in the family needs help. onOpen fires from the one button. */
export function showTakeover(host, s, inc, viewer, now, onOpen) {
  const lead = inc.people[0];
  const lm = s.members[lead.id];
  const who = joinNames(inc.people.map((p) => s.members[p.id].name));
  const me = s.members[viewer];
  let title = `${who} ${inc.people.length > 1 ? "need" : "needs"} help`;
  let eyebrow = "EMERGENCY";
  let note = "";
  if (inc.people.length === 1 && lead.kind === "silent") {
    title = `${lm.name} sent a silent alert`;
    eyebrow = "SILENT ALERT";
    note = `${lm.name} may not be able to talk. Text, don't call.`;
  } else if (inc.people.length === 1 && lead.kind === "missed") {
    title = `${lm.name} missed a check-in`;
    eyebrow = "MISSED CHECK-IN";
    note = lead.note ? `${lm.name}'s note: “${lead.note}”` : "";
  }
  const dist = lm.device !== "offline" && lm.device !== "locationOff"
    ? `${L.distanceMi(me.pos, lm.pos).toFixed(1)} mi from you`
    : "location unavailable";
  const node = el(`
    <div class="takeover" role="alertdialog" aria-modal="true" aria-labelledby="takeover-title">
      <div class="takeover__glow" aria-hidden="true"></div>
      <div class="takeover__inner">
        <span class="takeover__eyebrow">${icon("alert", 16, 2.4)} <span data-t="eyebrow"></span></span>
        <div class="takeover__av">${`<span class="av" style="--av:${lm.color};--sz:88px" aria-hidden="true">${lm.initial}</span>`}</div>
        <h2 class="takeover__title" id="takeover-title" data-t="title"></h2>
        <p class="takeover__time" data-t="time"></p>
        <p class="takeover__note" data-t="note"></p>
        <p class="takeover__vis">${icon("eye", 16, 2.2)} <span data-t="vis"></span></p>
        <button type="button" class="btn btn--light btn--big" data-open></button>
      </div>
    </div>`);
  const set = (k, v) => text(node.querySelector(`[data-t="${k}"]`), v);
  set("eyebrow", eyebrow);
  set("title", title);
  set("time", `${L.fmtClock(lead.at)} · ${dist}`);
  set("note", note);
  node.querySelector('[data-t="note"]').hidden = !note;
  set("vis", `${who}'s location is shared with the family, and ${who} can see yours until it's over.`);
  node.querySelector("[data-open]").textContent = `See where ${inc.people.length > 1 ? "they are" : `${lm.name} is`}`;
  host.appendChild(node);
  open(node);
  node.querySelector("[data-open]").focus();
  function close() {
    node.remove();
  }
  node.querySelector("[data-open]").addEventListener("click", () => {
    close();
    onOpen();
  });
  return { close };
}

/* Your own check-in is due. update(now) runs the countdown. */
export function showLastCall(host, due, onOk) {
  const node = el(`
    <div class="lastcall" role="alertdialog" aria-modal="true" aria-labelledby="lastcall-title">
      <div class="lastcall__inner">
        <span class="lastcall__eyebrow">${icon("timer", 16, 2.4)} CHECK-IN</span>
        <h2 class="lastcall__title" id="lastcall-title">Are you OK?</h2>
        <p class="lastcall__text"></p>
        <div class="lastcall__count" aria-live="polite"></div>
        <button type="button" class="btn btn--light btn--big" data-ok>I'm OK</button>
      </div>
    </div>`);
  node.querySelector(".lastcall__text").textContent =
    `Your check-in was due at ${L.fmtClock(due)}. Check in now, or your family is alerted and your location opens in`;
  const count = node.querySelector(".lastcall__count");
  host.appendChild(node);
  open(node);
  function close() {
    node.remove();
  }
  node.querySelector("[data-ok]").addEventListener("click", () => {
    close();
    onOk();
  });
  return {
    close,
    update(now) {
      text(count, L.fmtElapsed(due + L.LAST_CALL - now));
    },
  };
}
