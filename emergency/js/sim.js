/* The pretend family and their pretend phones.
 *
 * This file stands in for everything a real backend would do: other
 * people seeing an alert, heading over, and their phones answering a Peace
 * of Mind check. Nothing here is real, and the UI says so where it matters.
 */

import * as L from "./logic.js";

/* Seconds after an alert, per person: when they see it, and when (if
 * ever) they head over. The viewer answers for themselves. */
const SCRIPT = {
  mom: { seen: 2, go: null },
  dad: { seen: 4, go: 6 },
  ava: { seen: 3, go: 9 },
  leo: { seen: 20, go: null },
};

/* What each person's check-in note says when the demo makes them miss one. */
const NOTES = {
  mom: "Driving back from the store",
  dad: "Out for a run by the river",
  ava: "At Maddie's, walking home after",
  leo: "Walking home from practice",
};

export function etaMinutes(from, to) {
  return Math.max(2, Math.round(L.distanceMi(from, to) * 2.8 + 0.6));
}

/* Did the alert reach this phone at all? */
export function reachable(m) {
  return m.device !== "offline" && m.device !== "alertsOff";
}

function lerp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/* Someone heads to the first person in trouble; their pin drives there. */
export function headOver(s, id, now) {
  const inc = L.activeIncident(s);
  if (!inc || L.inTrouble(inc, id) || !inc.people.length) return null;
  const target = inc.people[0].id;
  const m = s.members[id];
  const eta = etaMinutes(m.pos, s.members[target].pos);
  L.respond(s, inc.id, id, "onway", now, eta);
  m.trip = { from: { ...m.pos }, to: target, start: now, eta };
  return eta;
}

/* Pretend people check in on time, unless their phone is off. Runs before
 * the rules tick, so skipping time ahead never makes them miss one by
 * accident. Missing one on purpose is a demo-panel button. */
export function autoCheckIns(s, now) {
  for (const id of L.MEMBERS) {
    const m = s.members[id];
    if (id === s.viewer || m.device === "offline") continue;
    const nightly = L.nextNightlyDue(m, now);
    if ((m.checkIn && now >= m.checkIn.due - 9 * L.MIN) || (nightly !== null && now >= nightly - 10 * L.MIN)) {
      L.checkIn(s, id, now);
    }
  }
}

/* Advance the pretend family to `now`. Returns events for the UI. */
export function step(s, now) {
  const events = [];
  const inc = L.activeIncident(s);
  if (inc) {
    const since = (now - inc.startedAt) / 1000;
    for (const id of Object.keys(inc.responses)) {
      if (id === s.viewer) continue;
      const m = s.members[id];
      if (!reachable(m)) continue;
      const r = inc.responses[id];
      const sc = SCRIPT[id];
      if (r.state === "unseen" && since >= sc.seen) L.respond(s, inc.id, id, "seen", now);
      if (sc.go !== null && r.state !== "onway" && since >= sc.go && !m.trip) headOver(s, id, now);
    }
  }
  for (const id of L.MEMBERS) {
    const m = s.members[id];
    if (!m.trip) continue;
    if (!inc || !L.inTrouble(inc, m.trip.to)) {
      m.trip = null;
      continue;
    }
    const dest = s.members[m.trip.to].pos;
    const p = Math.min(1, (now - m.trip.start) / (m.trip.eta * L.MIN));
    m.pos = lerp(m.trip.from, dest, ease(p));
    if (p >= 1) {
      const to = m.trip.to;
      m.trip = null;
      if (inc.responses[id]) inc.responses[id].state = "arrived";
      L.addLog(s, now, `${m.name} reached ${L.nameOf(s, to)}.`);
      events.push({ type: "arrived", id, to });
    }
  }
  return events;
}

/* Demo panel: make someone else press, send a silent alert, or miss a
 * check-in. */
export function simulate(s, what, id, now) {
  if (what === "press") return L.startIncident(s, id, "button", now);
  if (what === "silent") return L.startIncident(s, id, "silent", now);
  if (what === "miss") {
    s.members[id].checkIn = null;
    return L.startIncident(s, id, "missed", now, NOTES[id], now - L.LAST_CALL);
  }
  return null;
}

/* Peace of Mind, played out in real seconds. Each row goes Phone: pinging
 * then On (or No answer after a timeout), then GPS: locating then Located
 * (or Off). onUpdate(rows) fires on every change; returns a cancel fn. */
export function peaceRun(s, viewerId, onUpdate) {
  const rows = L.MEMBERS.filter((id) => id !== viewerId).map((id) => ({
    id, phone: "pinging", gps: "waiting", alertsOff: false, done: false,
  }));
  const timers = [];
  rows.forEach((row, i) => {
    const res = L.peaceResult(s.members[row.id].device);
    const reach = 700 + i * 550;
    if (res.phone === "no-answer") {
      timers.push(setTimeout(() => {
        row.phone = "no-answer";
        row.gps = null;
        row.done = true;
        onUpdate(rows);
      }, reach + 5200));
      return;
    }
    timers.push(setTimeout(() => {
      row.phone = "on";
      row.gps = "locating";
      onUpdate(rows);
    }, reach));
    timers.push(setTimeout(() => {
      row.gps = res.gps;
      row.alertsOff = res.alertsOff;
      row.done = true;
      onUpdate(rows);
    }, reach + 1100 + i * 300));
  });
  onUpdate(rows);
  return () => timers.forEach(clearTimeout);
}
