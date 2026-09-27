/* The map, and everything drawn over it.
 *
 * Calm: the Map tab shows you and anyone sharing on purpose, and names
 * who is private. Emergency: the Atlas look, with a red banner and a
 * sheet whose contents depend on whether you are the one in trouble or
 * one of the people alerted.
 */

import { el, refs, text, show, onAct } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import { createMap } from "./map.js";
import { avatar, shareUntil, hasFix, toast, confirmSheet, joinNames } from "./ui-common.js";
import { shareSheet } from "./ui-sheets.js";

export function etaLeft(s, id, now) {
  const m = s.members[id];
  if (!m.trip) return null;
  return Math.max(1, Math.ceil(m.trip.eta - (now - m.trip.start) / L.MIN));
}

function chip(s, id, r, now) {
  if (r.state === "arrived") return `<span class="chip chip--good">${icon("check", 13, 2.6)} Arrived</span>`;
  if (r.state === "onway") {
    const left = etaLeft(s, id, now);
    return `<span class="chip chip--good">${icon("nav", 13, 2.4)} On the way${left ? ` · ${left} min` : ""}</span>`;
  }
  if (r.state === "seen") return `<span class="chip chip--seen">${icon("eye", 13, 2.4)} Seen</span>`;
  return `<span class="chip chip--wait">${icon("clock", 13, 2.4)} Not seen yet</span>`;
}

export function mountMapView(container, ctx) {
  const root = el(`
    <div class="mv">
      <div class="mv__map" data-ref="map"></div>

      <div class="mv-top" data-ref="calmTop">
        <div class="mv-pill">
          <span class="mv-pill__ic" data-ref="pillIcon"></span>
          <span data-ref="pillMain"></span>
          <span class="mv-pill__sep"></span>
          <span class="mv-pill__sub" data-ref="pillSub"></span>
        </div>
        <button type="button" class="icon-btn icon-btn--float" data-act="recenter" aria-label="Show everyone on the map">${icon("nav", 19)}</button>
      </div>
      <div class="mv-card" data-ref="privateCard" hidden>
        <span class="mv-card__avs" data-ref="privAvs"></span>
        <span class="mv-card__text">
          <span class="mv-card__title" data-ref="privTitle"></span>
          <span class="mv-card__sub">No pin means private until they share or someone needs help.</span>
        </span>
      </div>

      <div class="em-banner" data-ref="banner" hidden>
        <div class="em-banner__row">
          <span class="em-banner__title"><span class="em-dot"></span><span data-ref="bannerTitle"></span></span>
          <span class="em-banner__time" data-ref="bannerTime"></span>
        </div>
        <div class="em-banner__sub" data-ref="bannerSub"></div>
      </div>

      <section class="em-sheet" data-ref="sheet" hidden aria-label="Emergency">
        <button type="button" class="em-sheet__grab" data-act="toggle-sheet" aria-label="Expand or collapse"></button>
        <div class="em-sheet__body">
          <h2 class="em-sheet__title" data-ref="title"></h2>
          <p class="em-sheet__sub" data-ref="sub"></p>
          <p class="em-note" data-ref="note" hidden></p>
          <div class="em-actions" data-ref="actions"></div>
          <div class="em-rows" data-ref="rows"></div>
        </div>
      </section>
    </div>`);
  container.appendChild(root);
  const r = refs(root);
  const map = createMap(r.map);

  let expanded = true;
  let lastFitKey = "";
  let actionsKey = "";
  let rowsKey = "";

  function fitNow() {
    lastFitKey = "";
  }

  onAct(root, {
    recenter: () => fitNow(),
    "toggle-sheet": () => ctx.go(ctx.tab() === "home" ? "map" : "home"),
    call911: () => toast("This is a mock, so nothing was dialed. In the real app this button calls 911.", { ms: 5200 }),
    "end-mine": () => ctx.endMine(),
    onway: () => ctx.headOver(),
    "call-person": (btn) => toast(`This is a mock. In the real app this calls ${btn.dataset.name}.`, { ms: 4200 }),
    "share-all": () => {
      ctx.store.update((s, now) => L.setShare(s, ctx.viewer(), "emergency", now));
      toast("Everyone in the family can see you until the emergency ends.");
    },
    "share-more": () => shareSheet(ctx),
    "share-stop": () => ctx.store.update((s, now) => L.setShare(s, ctx.viewer(), "off", now)),
    resolve: async () => {
      const s = ctx.store.get();
      const inc = L.activeIncident(s);
      if (!inc) return;
      const who = joinNames(inc.people.map((p) => s.members[p.id].name));
      const yes = await confirmSheet({
        title: "Mark resolved?",
        message: `Only do this once you've reached ${who} or talked to them. Everyone is told you ended it, and locations go private again.`,
        yes: "Mark resolved",
        danger: true,
      });
      if (!yes) return;
      ctx.store.update((st, now) => {
        const live = L.activeIncident(st);
        if (live) L.endIncident(st, live.id, ctx.viewer(), "resolved", now);
      });
    },
  });

  function renderActions(s, inc, viewer, now) {
    const mine = L.inTrouble(inc, viewer);
    const first = s.members[inc.people[0].id];
    const r0 = inc.responses[viewer];
    const myShare = s.members[viewer].share.kind;
    const key = [mine, first.id, r0 && r0.state, myShare].join("|");
    if (key === actionsKey) return;
    actionsKey = key;
    if (mine) {
      r.actions.innerHTML = `
        <button type="button" class="btn btn--red" data-act="call911">${icon("phone", 20, 2.2)} Call 911</button>
        <button type="button" class="btn btn--dark" data-act="end-mine">${icon("key", 17, 2.2)} I'm safe or it was an accident</button>`;
      return;
    }
    const onway = r0 && (r0.state === "onway" || r0.state === "arrived");
    r.actions.innerHTML = `
      ${onway
        ? `<div class="btn btn--good-quiet" aria-live="polite">${icon("nav", 17, 2.4)} <span data-ref="myEta">You're on the way</span></div>`
        : `<button type="button" class="btn btn--good" data-act="onway">${icon("nav", 18, 2.4)} I'm on my way</button>`}
      <div class="em-actions__row">
        <button type="button" class="btn btn--dark" data-act="call-person" data-name="${first.name}">${icon("phone", 17, 2.2)} Call ${first.name}</button>
        <button type="button" class="btn btn--dark" data-act="call911">${icon("phone", 17, 2.2)} Call 911</button>
      </div>
      ${myShare === "emergency"
        ? `<button type="button" class="btn btn--dark" data-act="share-stop">${icon("broadcast", 17, 2.2)} Sharing with everyone · Stop</button>`
        : `<button type="button" class="btn btn--dark" data-act="share-all">${icon("broadcast", 17, 2.2)} Share my location with everyone</button>`}
      <button type="button" class="btn btn--ghost" data-act="resolve">Mark resolved</button>`;
  }

  function renderRows(s, inc, viewer, now) {
    const mine = L.inTrouble(inc, viewer);
    const me = s.members[viewer];
    const ids = Object.keys(inc.responses).filter((id) => mine || id !== viewer);
    const html = ids.map((id) => {
      const m = s.members[id];
      const see = L.canSee(s, viewer, id, now);
      const dist = see && hasFix(m) && hasFix(me) ? `${L.distanceMi(me.pos, m.pos).toFixed(1)} mi` : "";
      return `<div class="em-row">
        ${avatar(m, 36)}
        <span class="em-row__name">${m.name}</span>
        ${chip(s, id, inc.responses[id], now)}
        ${dist ? `<span class="em-row__dist">${dist}</span>` : ""}
      </div>`;
    }).join("");
    const head = mine ? "" : `<h3 class="em-rows__head">Who's responding</h3>`;
    const next = head + html;
    if (next !== rowsKey) {
      rowsKey = next;
      r.rows.innerHTML = next;
    }
  }

  function summary(s, inc, now) {
    const on = [];
    const seen = [];
    const unseen = [];
    for (const [id, resp] of Object.entries(inc.responses)) {
      const n = s.members[id].name;
      if (resp.state === "onway") on.push(`${n} is ${etaLeft(s, id, now) || 1} min away`);
      else if (resp.state === "arrived") on.push(`${n} is with you`);
      else if (resp.state === "seen") seen.push(n);
      else unseen.push(n);
    }
    const parts = [...on];
    if (seen.length) parts.push(`${joinNames(seen)} ${seen.length > 1 ? "have" : "has"} seen your alert`);
    if (!on.length && unseen.length) parts.push(`${joinNames(unseen)} ${unseen.length > 1 ? "haven't" : "hasn't"} seen it yet`);
    return {
      title: on.length ? "Help is on the way" : seen.length ? "Your family has seen it" : "Your family has been alerted",
      sub: parts.length ? `${parts.join(". ")}.` : "",
    };
  }

  function update(s, now, { visible, expand }) {
    root.hidden = !visible;
    if (!visible) return;
    const viewer = ctx.viewer();
    const me = s.members[viewer];
    const inc = L.activeIncident(s);
    const mineP = inc && inc.people.find((p) => p.id === viewer);
    expanded = expand;

    // Pins: only people this viewer may see, and only with a fresh fix.
    const seeIds = L.visibleTo(s, viewer, now).filter((id) => hasFix(s.members[id]));
    const pins = seeIds.map((id) => {
      const m = s.members[id];
      const trouble = L.inTrouble(inc, id);
      const isMe = id === viewer;
      let label = isMe ? "You" : m.name;
      if (!isMe && inc && L.inTrouble(inc, viewer)) {
        const left = inc.responses[id] && inc.responses[id].state === "onway" ? etaLeft(s, id, now) : null;
        label = left ? `${m.name} · ${left} min` : `${m.name} · ${L.distanceMi(me.pos, m.pos).toFixed(1)} mi`;
      } else if (!isMe && trouble) {
        label = `${m.name} · ${L.distanceMi(me.pos, m.pos).toFixed(1)} mi`;
      } else if (!isMe && !inc) {
        label = `${m.name} · ${shareUntil(m)}`;
      }
      return {
        id, lat: m.pos.lat, lng: m.pos.lng, color: m.color, initial: m.initial, label,
        kind: trouble ? "presser" : isMe ? "you" : "member",
      };
    });
    map.setPins(pins);

    const traveler = L.MEMBERS.find((id) => s.members[id].trip && seeIds.includes(id) && seeIds.includes(s.members[id].trip.to));
    map.setRoute(traveler ? [s.members[traveler].pos, s.members[s.members[traveler].trip.to].pos] : null);

    // Calm overlays.
    show(r.calmTop, true);
    const calm = !inc;
    root.classList.toggle("is-emergency", !calm);
    show(r.banner, !calm);
    show(r.sheet, !calm);
    const mySharing = L.isSharing(s, viewer, now);
    r.pillIcon.innerHTML = icon(mySharing ? "broadcast" : "lock", 14, 2.4);
    text(r.pillMain, mySharing ? "You're sharing" : "You're private");
    const othersSharing = L.MEMBERS.filter((id) => id !== viewer && L.canSee(s, viewer, id, now) === "sharing").length;
    text(r.pillSub, `${othersSharing} sharing`);
    r.calmTop.classList.toggle("is-hidden", !calm);

    const hidden = L.MEMBERS.filter((id) => id !== viewer && !L.canSee(s, viewer, id, now));
    show(r.privateCard, calm && hidden.length > 0);
    if (calm && hidden.length) {
      const key = hidden.join();
      if (r.privAvs.dataset.key !== key) {
        r.privAvs.innerHTML = hidden.map((id) => avatar(s.members[id], 34, "av--hollow av--stack")).join("");
        r.privAvs.dataset.key = key;
      }
      const hn = hidden.map((id) => s.members[id].name);
      text(r.privTitle, hidden.length === L.MEMBERS.length - 1 ? "Everyone else is private" : `${joinNames(hn)} ${hn.length > 1 ? "are" : "is"} private`);
    }

    // Emergency overlays.
    if (!calm) {
      const troubled = inc.people.map((p) => s.members[p.id]);
      const who = joinNames(troubled.map((m) => m.name));
      const silentMine = mineP && mineP.kind === "silent";
      root.classList.toggle("is-silent-mine", !!silentMine);
      text(r.bannerTime, L.fmtElapsed(now - inc.startedAt));
      if (mineP) {
        text(r.bannerTitle, silentMine ? "Silent alert on" : "Emergency active");
        text(r.bannerSub, silentMine ? "Your family can see where you are." : "Everyone can see you. You can see everyone.");
        const sum = summary(s, inc, now);
        text(r.title, silentMine ? "Silent alert on" : sum.title);
        text(r.sub, silentMine ? `Nothing on your screen gives it away. ${sum.sub}` : sum.sub);
        show(r.note, false);
      } else {
        const lead = inc.people[0];
        const lm = s.members[lead.id];
        text(r.bannerTitle, `Emergency · ${who}`);
        const sharingAll = s.members[viewer].share.kind === "emergency";
        text(r.bannerSub, `${who} can see your location until it's over.${sharingAll ? " So can everyone else." : ""}`);
        const verb = inc.people.length > 1 ? "need help" : lead.kind === "silent" ? "sent a silent alert" : lead.kind === "missed" ? "missed a check-in" : "needs help";
        text(r.title, `${who} ${verb}`);
        const dist = hasFix(lm) && hasFix(me) ? ` · ${L.distanceMi(me.pos, lm.pos).toFixed(1)} mi from you` : " · location unavailable";
        text(r.sub, `${lead.kind === "missed" && lead.due ? `Check-in was due ${L.fmtClock(lead.due)}` : `Alert at ${L.fmtClock(lead.at)}`}${dist}.`);
        let note = "";
        if (lead.kind === "silent") note = `${lm.name} may not be able to talk. Text, don't call.`;
        else if (lead.kind === "missed" && lead.note) note = `${lm.name}'s note: “${lead.note}”`;
        show(r.note, !!note);
        text(r.note, note);
      }
      renderActions(s, inc, viewer, now);
      renderRows(s, inc, viewer, now);
      const eta = r.actions.querySelector("[data-ref='myEta']");
      if (eta) {
        const left = etaLeft(s, viewer, now);
        const st = inc.responses[viewer] && inc.responses[viewer].state;
        text(eta, st === "arrived" ? `You're with ${who}` : `You're on the way${left ? ` · ${left} min` : ""}`);
      }
    }
    root.classList.toggle("is-expanded", !calm && expanded);

    // Reframe when what is on the map, or what covers it, changes.
    const bottom = calm ? (hidden.length ? 190 : 100) : r.sheet.offsetHeight + 12;
    const top = calm ? 70 : r.banner.offsetHeight + 16;
    const fitKey = `${seeIds.join()}|${calm}|${expanded}|${Math.round(bottom / 20)}`;
    if (fitKey !== lastFitKey) {
      lastFitKey = fitKey;
      map.fit(null, { top: top + ctx.safeTop(), bottom });
    }
  }

  return { update, root };
}
