import { test, eq, ok } from "./run.js";
import {
  createDemoState, canSee, visibleTo, whoCanSee, setShare, activeIncident,
  startIncident, respond, endIncident, tick, addLog,
  setCheckIn, clearCheckIn, checkIn, nextNightlyDue,
  setPin, pinMatches, peaceReadyIn, startPeace, peaceResult,
  addSentText, pruneTexts,
} from "../js/logic.js";

/* Local wall-clock times on a fixed day, so the tests read like the demo. */
const DAY = [2026, 8, 26];
const at = (h, m, s = 0, dayOffset = 0) =>
  new Date(DAY[0], DAY[1], DAY[2] + dayOffset, h, m, s).getTime();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const start = () => createDemoState(at(21, 10));
const ofType = (events, type, id) => events.filter((e) => e.type === type && (!id || e.id === id));

/* ---- Visibility, sharing, incidents -------------------------------- */

test("calm evening: you see yourself and whoever chose to share", () => {
  const s = start();
  const t = at(21, 10);
  eq(visibleTo(s, "ava", t), ["dad", "ava"], "Ava");
  eq(visibleTo(s, "dad", t), ["dad"], "Dad sees only himself");
  eq(visibleTo(s, "mom", t), ["mom", "dad"], "Mom");
  eq(canSee(s, "ava", "dad", t), "sharing");
  eq(canSee(s, "ava", "mom", t), null);
  eq(canSee(s, "ava", "ava", t), "self");
});

test("a timed share ends on time, says so, and logs it", () => {
  const s = start();
  eq(ofType(tick(s, at(21, 39, 59)), "share-ended").length, 0, "not before its end");
  const logBefore = s.log.length;
  const ev = tick(s, at(21, 40));
  eq(ofType(ev, "share-ended", "dad").length, 1, "event at the end time");
  eq(s.members.dad.share.kind, "off");
  eq(visibleTo(s, "ava", at(21, 40)), ["ava"]);
  ok(s.log.length > logBefore, "a log line");
});

test("setShare: timed shares end after the chosen length; emergency shares need an emergency", () => {
  const s = start();
  const t = at(21, 10);
  setShare(s, "mom", "timed", t, HOUR);
  eq(s.members.mom.share, { kind: "timed", until: t + HOUR });
  eq(setShare(s, "leo", "emergency", t), false, "no emergency running");
  eq(s.members.leo.share.kind, "off");
  setShare(s, "mom", "on", t);
  eq(s.members.mom.share, { kind: "on" });
  setShare(s, "mom", "off", t);
  eq(s.members.mom.share, { kind: "off" });
});

test("Ava's emergency: everyone sees Ava, Ava sees everyone, nobody else opens up", () => {
  const s = start();
  const t = at(21, 12);
  setShare(s, "dad", "off", t);
  startIncident(s, "ava", "button", t);
  eq(visibleTo(s, "mom", t), ["mom", "ava"], "Mom");
  eq(visibleTo(s, "ava", t), ["mom", "dad", "ava", "leo"], "Ava");
  eq(canSee(s, "mom", "leo", t), null, "Mom still cannot see Leo");
  eq(whoCanSee(s, "ava", t), [
    { id: "mom", reason: "presser" },
    { id: "dad", reason: "presser" },
    { id: "leo", reason: "presser" },
  ]);
  eq(whoCanSee(s, "leo", t), [{ id: "ava", reason: "presser-sees-all" }]);
});

test("silent alerts open location exactly like the button", () => {
  const s = start();
  const t = at(21, 12);
  setShare(s, "dad", "off", t);
  startIncident(s, "leo", "silent", t);
  eq(visibleTo(s, "mom", t), ["mom", "leo"]);
  eq(visibleTo(s, "leo", t), ["mom", "dad", "ava", "leo"]);
  eq(activeIncident(s).people[0].kind, "silent");
});

test("sharing until the emergency ends stops when it ends", () => {
  const s = start();
  const t = at(21, 12);
  const inc = startIncident(s, "ava", "button", t);
  eq(setShare(s, "leo", "emergency", t), true);
  eq(canSee(s, "mom", "leo", t), "sharing");
  endIncident(s, inc.id, "ava", "safe", t + 5 * MIN);
  eq(s.members.leo.share.kind, "off");
  eq(canSee(s, "mom", "leo", t + 5 * MIN), null);
});

test("a second press joins the running emergency instead of being ignored", () => {
  const s = start();
  const t = at(21, 12);
  setShare(s, "dad", "off", t);
  const first = startIncident(s, "ava", "button", t);
  const second = startIncident(s, "leo", "silent", t + 1000);
  eq(second.id, first.id);
  eq(s.incidents.length, 1);
  eq(first.people.map((p) => p.id), ["ava", "leo"]);
  eq(first.people[1].kind, "silent");
  eq(Object.keys(first.responses), ["mom", "dad"], "Leo is in trouble, not a responder");
  eq(visibleTo(s, "mom", t + 1000), ["mom", "ava", "leo"]);
  eq(visibleTo(s, "leo", t + 1000), ["mom", "dad", "ava", "leo"]);
  eq(startIncident(s, "ava", "button", t + 2000).people.length, 2, "pressing again changes nothing");
});

test("each person in trouble ends their own part; the emergency ends with the last one", () => {
  const s = start();
  const t = at(21, 12);
  const inc = startIncident(s, "ava", "button", t);
  startIncident(s, "leo", "button", t + 1000);
  endIncident(s, inc.id, "ava", "safe", t + MIN);
  ok(activeIncident(s), "Leo still needs help");
  eq(inc.people.map((p) => p.id), ["leo"]);
  eq(canSee(s, "mom", "ava", t + MIN), null, "Ava is private again");
  endIncident(s, inc.id, "leo", "safe", t + 2 * MIN);
  eq(activeIncident(s), null);
  eq(inc.endReason, "safe");
});

test("Mark resolved by someone else ends the whole emergency", () => {
  const s = start();
  const t = at(21, 12);
  const inc = startIncident(s, "ava", "button", t);
  startIncident(s, "leo", "button", t + 1000);
  endIncident(s, inc.id, "mom", "resolved", t + MIN);
  eq(activeIncident(s), null);
  eq(inc.endedBy, "mom");
  eq(inc.endReason, "resolved");
});

test("responses start unseen and record seen and on-the-way with an ETA", () => {
  const s = start();
  const t = at(21, 12);
  const inc = startIncident(s, "ava", "button", t);
  eq(Object.keys(inc.responses), ["mom", "dad", "leo"], "everyone but the presser");
  eq(inc.responses.mom.state, "unseen");
  respond(s, inc.id, "mom", "seen", t + 2000);
  respond(s, inc.id, "dad", "onway", t + 6000, 4);
  eq(inc.responses.mom.state, "seen");
  eq(inc.responses.dad.state, "onway");
  eq(inc.responses.dad.eta, 4);
  eq(inc.responses.dad.at, t + 6000);
});

test("ending an emergency records who and why, and privacy comes back", () => {
  const s = start();
  const t = at(21, 12);
  setShare(s, "dad", "off", t);
  const inc = startIncident(s, "ava", "button", t);
  const logBefore = s.log.length;
  endIncident(s, inc.id, "ava", "accident", t + MIN);
  eq(inc.endedAt, t + MIN);
  eq(inc.endedBy, "ava");
  eq(inc.endReason, "accident");
  eq(activeIncident(s), null);
  eq(visibleTo(s, "ava", t + MIN), ["ava"]);
  ok(s.log.length > logBefore, "a log line");
});

test("the log keeps entries in order and stays bounded", () => {
  const s = start();
  s.log = [];
  for (let i = 0; i < 400; i += 1) addLog(s, i, `entry ${i}`);
  eq(s.log.length, 300);
  eq(s.log[0].text, "entry 100");
  eq(s.log[299].text, "entry 399");
});

/* ---- Check-ins ----------------------------------------------------- */

test("one-time check-in: reminder, last call, then a missed-check-in emergency with the note", () => {
  const s = start();
  eq(s.members.leo.checkIn.due, at(22, 30), "Leo's demo check-in");
  eq(ofType(tick(s, at(22, 24)), "checkin-reminder", "leo").length, 0);
  eq(ofType(tick(s, at(22, 25)), "checkin-reminder", "leo").length, 1, "reminder 5 min before");
  eq(ofType(tick(s, at(22, 26)), "checkin-reminder", "leo").length, 0, "only once");
  eq(ofType(tick(s, at(22, 30)), "checkin-lastcall", "leo").length, 1, "last call at the deadline");
  eq(ofType(tick(s, at(22, 31)), "checkin-missed", "leo").length, 0, "2 minutes of grace");
  const ev = ofType(tick(s, at(22, 32)), "checkin-missed", "leo");
  eq(ev.length, 1, "missed after the grace");
  const inc = activeIncident(s);
  eq(inc.people[0].id, "leo");
  eq(inc.people[0].kind, "missed");
  eq(inc.people[0].note, "Walking home from practice");
  eq(ev[0].incidentId, inc.id);
  eq(s.members.leo.checkIn, null);
});

test("checking in before the deadline clears it", () => {
  const s = start();
  checkIn(s, "leo", at(22, 0));
  eq(s.members.leo.checkIn, null);
  const ev = tick(s, at(22, 35));
  eq(ev.filter((e) => e.id === "leo").length, 0);
  eq(activeIncident(s), null);
});

test("setCheckIn and clearCheckIn", () => {
  const s = start();
  setCheckIn(s, "mom", at(23, 0), "At the movies", at(21, 10));
  eq(s.members.mom.checkIn.due, at(23, 0));
  eq(s.members.mom.checkIn.note, "At the movies");
  clearCheckIn(s, "mom");
  eq(s.members.mom.checkIn, null);
});

test("nightly check-in: next deadline, the 3-hour window, and tomorrow after a check-in", () => {
  const s = start();
  const ava = s.members.ava;
  eq(ava.nightly.on, true);
  eq(ava.nightly.time, "23:00");
  eq(nextNightlyDue(ava, at(21, 0)), at(23, 0));
  checkIn(s, "ava", at(19, 0));
  eq(nextNightlyDue(ava, at(19, 1)), at(23, 0), "more than 3 hours early does not count");
  checkIn(s, "ava", at(21, 30));
  eq(nextNightlyDue(ava, at(21, 31)), at(23, 0, 0, 1), "covered tonight, so tomorrow");
});

test("nightly check-in: reminder, last call, missed", () => {
  const s = start();
  eq(ofType(tick(s, at(22, 55)), "checkin-reminder", "ava").length, 1);
  eq(ofType(tick(s, at(23, 0)), "checkin-lastcall", "ava").length, 1);
  const missed = ofType(tick(s, at(23, 2)), "checkin-missed", "ava");
  eq(missed.length, 1);
  eq(activeIncident(s).people.map((p) => p.id), ["leo", "ava"], "Ava joins Leo's running emergency");
});

test("nightly miss starts its own emergency when none is running", () => {
  const s = start();
  checkIn(s, "leo", at(22, 0));
  tick(s, at(22, 55));
  tick(s, at(23, 0));
  tick(s, at(23, 2));
  const inc = activeIncident(s);
  eq(inc.people[0].id, "ava");
  eq(inc.people[0].kind, "missed");
  eq(nextNightlyDue(s.members.ava, at(23, 3)), at(23, 0, 0, 1));
});

/* ---- PIN, Peace of Mind, disguise texts ----------------------------- */

test("PIN: four digits only, and it has to match", () => {
  const s = start();
  eq(pinMatches(s, "ava", "1234"), false, "no PIN yet");
  eq(setPin(s, "ava", "12a4"), false);
  eq(setPin(s, "ava", "123"), false);
  eq(setPin(s, "ava", "1234"), true);
  eq(pinMatches(s, "ava", "1234"), true);
  eq(pinMatches(s, "ava", "4321"), false);
});

test("Peace of Mind: once every 30 seconds", () => {
  const s = start();
  const t = at(21, 12);
  eq(peaceReadyIn(s, t), 0);
  eq(startPeace(s, t), true);
  eq(peaceReadyIn(s, t + 1000), 29000);
  eq(startPeace(s, t + 1000), false);
  eq(peaceReadyIn(s, t + 30000), 0);
  eq(startPeace(s, t + 30000), true);
});

test("Peace of Mind: two honest lines per phone", () => {
  eq(peaceResult("ok"), { phone: "on", gps: "located", alertsOff: false });
  eq(peaceResult("offline"), { phone: "no-answer", gps: null, alertsOff: false });
  eq(peaceResult("locationOff"), { phone: "on", gps: "off", alertsOff: false });
  eq(peaceResult("alertsOff"), { phone: "on", gps: "located", alertsOff: true });
});

test("texts typed in Private Mode delete themselves after 24 hours", () => {
  const s = start();
  const t0 = at(9, 0);
  addSentText(s, "first", t0);
  addSentText(s, "second", t0 + HOUR);
  eq(pruneTexts(s, t0 + 24 * HOUR - 1), 0, "not a moment early");
  eq(pruneTexts(s, t0 + 24 * HOUR), 1);
  eq(s.disguise.sent.map((m) => m.text), ["second"]);
});
