/* Chill's rules.
 *
 * Pure functions over one plain state object: no DOM, no timers, no
 * storage. Every time is epoch milliseconds handed in by the caller, so the
 * demo clock and the tests drive the rules the same way.
 *
 * The heart of it is canSee(): a person's location is visible only to
 * themselves, to everyone while they share on purpose, and during an
 * emergency both ways between the person in trouble and everyone else.
 * Nothing else ever opens a location.
 */

export const MEMBERS = ["mom", "dad", "ava", "leo"];

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const REMIND_BEFORE = 5 * MIN;      // check-in heads-up
export const LAST_CALL = 2 * MIN;          // ringing grace after a deadline
export const NIGHTLY_WINDOW = 3 * HOUR;    // how early a nightly check-in counts
export const PEACE_COOLDOWN = 30 * 1000;   // Peace of Mind, once every 30 s
export const TEXT_TTL = 24 * HOUR;         // Private Mode texts delete after a day
const LOG_MAX = 300;

/* The pretend family, placed around a fictional neighborhood. Ava is at the
 * middle; the others sit at the distances the designs show (Leo 0.6 mi,
 * Dad 1.2 mi, Mom 3.4 mi). */
const PEOPLE = {
  mom: { name: "Mom", initial: "M", color: "#A85A14", pos: { lat: 41.8539, lng: -87.5737 } },
  dad: { name: "Dad", initial: "D", color: "#2F6FDF", pos: { lat: 41.8923, lng: -87.6135 } },
  ava: { name: "Ava", initial: "A", color: "#C2367C", pos: { lat: 41.8800, lng: -87.6300 } },
  leo: { name: "Leo", initial: "L", color: "#1B7A50", pos: { lat: 41.8765, lng: -87.6407 } },
};

export function createDemoState(now) {
  const members = {};
  for (const id of MEMBERS) {
    const p = PEOPLE[id];
    members[id] = {
      id,
      name: p.name,
      initial: p.initial,
      color: p.color,
      home: { ...p.pos },
      pos: { ...p.pos },
      pin: null,
      share: { kind: "off" },
      nightly: { on: false, time: "23:00", since: now, lastCheckIn: null, handledFor: null, remindedFor: null, lastCallFor: null },
      checkIn: null,
      device: "ok",
    };
  }
  const s = {
    v: 1,
    viewer: null,
    members,
    incidents: [],
    log: [],
    peace: { lastRunAt: null },
    disguise: { on: false, style: "auto", preset: "jess", customName: "", customLines: "", sent: [], inbox: [] },
    sound: true,
  };
  // The demo evening: Dad is out and sharing for half an hour, Leo is
  // walking home with a check-in due, and Ava checks in every night.
  setShare(s, "dad", "timed", now, 30 * MIN);
  setCheckIn(s, "leo", now + 80 * MIN, "Walking home from practice", now);
  s.members.ava.nightly.on = true;
  return s;
}

/* ---- small helpers -------------------------------------------------- */

export function nameOf(s, id) {
  return s.members[id] ? s.members[id].name : id;
}

export function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* "23:00" to "11:00 PM". */
export function fmtHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtClock(new Date(2000, 0, 1, h, m).getTime());
}

export function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function distanceMi(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function addLog(s, at, text) {
  s.log.push({ at, text });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

/* ---- incidents ------------------------------------------------------ */

export function activeIncident(s) {
  return s.incidents.find((i) => !i.endedAt) || null;
}

export function inTrouble(inc, id) {
  return !!inc && inc.people.some((p) => p.id === id);
}

function incidentLine(s, kind, id, note, due) {
  const n = nameOf(s, id);
  const opens = `Everyone can see ${n}, and ${n} can see everyone.`;
  if (kind === "silent") return `${n} sent a silent alert. ${opens}`;
  if (kind === "missed") return `${n} missed a check-in${due ? ` due ${fmtClock(due)}` : ""}. ${opens}`;
  return `${n} pressed Emergency. ${opens}`;
}

/* Start an emergency, or add this person to the one already running. A
 * second press is never ignored: two people can be in trouble at once. */
export function startIncident(s, presserId, kind, now, note = "", due = null) {
  let inc = activeIncident(s);
  if (inc) {
    if (inTrouble(inc, presserId)) return inc;
    inc.people.push({ id: presserId, kind, at: now, note, due });
    delete inc.responses[presserId];
    if (s.members[presserId].share.kind === "emergency") s.members[presserId].share = { kind: "off" };
    addLog(s, now, `${incidentLine(s, kind, presserId, note, due)} (${nameOf(s, presserId)} joined the emergency already running.)`);
    return inc;
  }
  inc = {
    id: `inc-${now}-${presserId}`,
    startedAt: now,
    endedAt: null,
    endedBy: null,
    endReason: null,
    people: [{ id: presserId, kind, at: now, note, due }],
    responses: {},
  };
  for (const id of MEMBERS) {
    if (id !== presserId) inc.responses[id] = { state: "unseen", at: null, eta: null };
  }
  s.incidents.push(inc);
  addLog(s, now, incidentLine(s, kind, presserId, note, due));
  return inc;
}

export function respond(s, incidentId, memberId, what, now, etaMin = null) {
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc || inc.endedAt) return;
  const r = inc.responses[memberId];
  if (!r) return;
  const who = inc.people.map((p) => nameOf(s, p.id)).join(" and ");
  if (what === "seen" && r.state === "unseen") {
    r.state = "seen";
    r.at = now;
    addLog(s, now, `${nameOf(s, memberId)} saw the alert.`);
  } else if (what === "onway" && r.state !== "onway") {
    r.state = "onway";
    r.at = now;
    r.eta = etaMin;
    addLog(s, now, `${nameOf(s, memberId)} is on the way to ${who}${etaMin ? ` (about ${etaMin} min)` : ""}.`);
  }
}

/* reason: "safe" or "accident" from a person in trouble (ends their part),
 * "resolved" from anyone else (ends the whole emergency). */
export function endIncident(s, incidentId, byId, reason, now) {
  const inc = s.incidents.find((i) => i.id === incidentId);
  if (!inc || inc.endedAt) return;
  const by = nameOf(s, byId);
  if (reason === "resolved") {
    addLog(s, now, `${by} marked the emergency resolved.`);
    inc.people = [];
  } else if (inTrouble(inc, byId)) {
    inc.people = inc.people.filter((p) => p.id !== byId);
    addLog(s, now, reason === "accident" ? `${by}'s alert was an accident.` : `${by} is safe.`);
    if (inc.people.length) addLog(s, now, `${by}'s location is private again.`);
  } else {
    return;
  }
  if (inc.people.length) return;
  inc.endedAt = now;
  inc.endedBy = byId;
  inc.endReason = reason;
  for (const id of MEMBERS) {
    if (s.members[id].share.kind === "emergency") s.members[id].share = { kind: "off" };
  }
  addLog(s, now, "The emergency is over. Everyone's location is private again.");
}

/* ---- sharing -------------------------------------------------------- */

export function isSharing(s, id, now) {
  const sh = s.members[id].share;
  if (sh.kind === "on") return true;
  if (sh.kind === "timed") return now < sh.until;
  if (sh.kind === "emergency") {
    const inc = activeIncident(s);
    return !!inc && inc.id === sh.incidentId;
  }
  return false;
}

export function setShare(s, id, kind, now, ms = 0) {
  const m = s.members[id];
  const n = m.name;
  if (kind === "off") {
    const was = isSharing(s, id, now);
    m.share = { kind: "off" };
    if (was) addLog(s, now, `${n} stopped sharing location.`);
    return true;
  }
  if (kind === "on") {
    m.share = { kind: "on" };
    addLog(s, now, `${n} started sharing location until turning it off.`);
    return true;
  }
  if (kind === "timed") {
    m.share = { kind: "timed", until: now + ms };
    addLog(s, now, `${n} started sharing location until ${fmtClock(now + ms)}.`);
    return true;
  }
  if (kind === "emergency") {
    const inc = activeIncident(s);
    if (!inc || inTrouble(inc, id)) return false;
    m.share = { kind: "emergency", incidentId: inc.id };
    addLog(s, now, `${n} is sharing location with everyone until the emergency ends.`);
    return true;
  }
  return false;
}

/* ---- visibility ----------------------------------------------------- */

/* Why viewer can see target right now, or null if they cannot. */
export function canSee(s, viewerId, targetId, now) {
  if (viewerId === targetId) return "self";
  const inc = activeIncident(s);
  if (inTrouble(inc, targetId)) return "presser";
  if (isSharing(s, targetId, now)) return "sharing";
  if (inTrouble(inc, viewerId)) return "presser-sees-all";
  return null;
}

export function visibleTo(s, viewerId, now) {
  return MEMBERS.filter((id) => canSee(s, viewerId, id, now));
}

/* Everyone (other than the target) who can see the target, and why. */
export function whoCanSee(s, targetId, now) {
  return MEMBERS.filter((id) => id !== targetId)
    .map((id) => ({ id, reason: canSee(s, id, targetId, now) }))
    .filter((x) => x.reason);
}

/* ---- check-ins ------------------------------------------------------ */

export function setCheckIn(s, id, dueAt, note, now) {
  s.members[id].checkIn = { due: dueAt, note: note || "", setAt: now, reminded: false, lastCalled: false };
  addLog(s, now, `${nameOf(s, id)} set a check-in for ${fmtClock(dueAt)}.`);
}

export function clearCheckIn(s, id) {
  s.members[id].checkIn = null;
}

function deadlineOn(now, time, dayOffset) {
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, hh, mm, 0, 0).getTime();
}

function nightlyHandled(n, due) {
  if (n.handledFor === due) return true;
  return n.lastCheckIn !== null && n.lastCheckIn >= due - NIGHTLY_WINDOW && n.lastCheckIn <= due + LAST_CALL;
}

/* The nightly deadline this person is working toward, or null if off. */
export function nextNightlyDue(m, now) {
  const n = m.nightly;
  if (!n.on) return null;
  for (let off = -1; off <= 2; off += 1) {
    const due = deadlineOn(now, n.time, off);
    if (due + LAST_CALL <= now) continue;
    if (due < n.since) continue;
    if (nightlyHandled(n, due)) continue;
    return due;
  }
  return null;
}

/* "I'm OK": clears a one-time check-in and counts toward tonight's. */
export function checkIn(s, id, now) {
  const m = s.members[id];
  let counted = false;
  if (m.checkIn) {
    m.checkIn = null;
    counted = true;
  }
  if (m.nightly.on) {
    const due = nextNightlyDue(m, now);
    m.nightly.lastCheckIn = now;
    if (due !== null && now >= due - NIGHTLY_WINDOW) {
      m.nightly.handledFor = due;
      counted = true;
    }
  }
  if (counted) addLog(s, now, `${m.name} checked in.`);
  return counted;
}

/* ---- the clock ------------------------------------------------------ */

/* Advance the rules to `now`. Returns what happened, for the UI to show. */
export function tick(s, now) {
  const events = [];
  for (const id of MEMBERS) {
    const m = s.members[id];

    if (m.share.kind === "timed" && now >= m.share.until) {
      m.share = { kind: "off" };
      events.push({ type: "share-ended", id });
      addLog(s, now, `${m.name}'s location sharing ended (time was up).`);
    }

    const c = m.checkIn;
    if (c) {
      if (now >= c.due + LAST_CALL) {
        m.checkIn = null;
        const inc = startIncident(s, id, "missed", now, c.note, c.due);
        events.push({ type: "checkin-missed", id, due: c.due, incidentId: inc.id });
      } else if (now >= c.due) {
        if (!c.lastCalled) {
          c.lastCalled = true;
          c.reminded = true;
          events.push({ type: "checkin-lastcall", id, due: c.due });
        }
      } else if (now >= c.due - REMIND_BEFORE && !c.reminded) {
        c.reminded = true;
        events.push({ type: "checkin-reminder", id, due: c.due });
      }
    }

    if (m.nightly.on) {
      const n = m.nightly;
      for (let off = -1; off <= 1; off += 1) {
        const due = deadlineOn(now, n.time, off);
        if (due < n.since || nightlyHandled(n, due)) continue;
        if (now >= due + LAST_CALL) {
          n.handledFor = due;
          const inc = startIncident(s, id, "missed", now, "", due);
          events.push({ type: "checkin-missed", id, due, incidentId: inc.id, nightly: true });
        } else if (now >= due) {
          if (n.lastCallFor !== due) {
            n.lastCallFor = due;
            n.remindedFor = due;
            events.push({ type: "checkin-lastcall", id, due, nightly: true });
          }
        } else if (now >= due - REMIND_BEFORE && n.remindedFor !== due) {
          n.remindedFor = due;
          events.push({ type: "checkin-reminder", id, due, nightly: true });
        }
      }
    }
  }
  return events;
}

/* ---- PIN ------------------------------------------------------------ */

export function setPin(s, id, pin) {
  if (!/^\d{4}$/.test(String(pin))) return false;
  s.members[id].pin = String(pin);
  return true;
}

export function pinMatches(s, id, pin) {
  const p = s.members[id].pin;
  return p !== null && p === String(pin);
}

/* ---- Peace of Mind -------------------------------------------------- */

export function peaceReadyIn(s, now) {
  if (s.peace.lastRunAt === null) return 0;
  return Math.max(0, s.peace.lastRunAt + PEACE_COOLDOWN - now);
}

export function startPeace(s, now) {
  if (peaceReadyIn(s, now) > 0) return false;
  s.peace.lastRunAt = now;
  return true;
}

/* What a phone in this condition can truthfully report. A phone that does
 * not answer reports nothing at all, so its GPS is unknown, not "off". */
export function peaceResult(device) {
  if (device === "offline") return { phone: "no-answer", gps: null, alertsOff: false };
  if (device === "locationOff") return { phone: "on", gps: "off", alertsOff: false };
  if (device === "alertsOff") return { phone: "on", gps: "located", alertsOff: true };
  return { phone: "on", gps: "located", alertsOff: false };
}

/* ---- Private Mode texts --------------------------------------------- */

export function addSentText(s, text, now) {
  const msg = { id: `t-${now}-${s.disguise.sent.length}`, text: String(text), at: now };
  s.disguise.sent.push(msg);
  return msg;
}

export function pruneTexts(s, now) {
  const before = s.disguise.sent.length;
  s.disguise.sent = s.disguise.sent.filter((m) => now - m.at < TEXT_TTL);
  s.disguise.inbox = (s.disguise.inbox || []).filter((m) => now - m.at < TEXT_TTL);
  return before - s.disguise.sent.length;
}
