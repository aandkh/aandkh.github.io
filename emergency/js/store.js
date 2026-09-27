/* State, saving, and the demo clock.
 *
 * The demo evening starts at 9:10 PM. The clock only runs while Chill is
 * open: close it and come back tomorrow and it resumes at the minute you
 * left, so nobody opens the page to a pile of missed check-ins.
 */

import * as L from "./logic.js";
import * as sim from "./sim.js";

const KEY = "chill.state.v1";
const START = { h: 21, m: 10 };

let state = null;
let offset = 0;
let timer = 0;
const changeFns = [];
const eventFns = [];

export function now() {
  return Date.now() + offset;
}

function eveningOffset() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), START.h, START.m, 0, 0).getTime();
  return start - Date.now();
}

export function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
  if (saved && saved.state && saved.state.v === 1 && typeof saved.demoNow === "number") {
    state = saved.state;
    offset = saved.demoNow - Date.now();
  } else {
    offset = eveningOffset();
    state = L.createDemoState(now());
  }
  save();
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ state, demoNow: now() })); } catch (e) { /* private window: this visit only */ }
}

export function get() {
  return state;
}

/* Change state, save, and redraw. fn gets (state, now). */
export function update(fn) {
  const result = fn(state, now());
  save();
  changed();
  return result;
}

export function onChange(fn) { changeFns.push(fn); }
export function onEvent(fn) { eventFns.push(fn); }

function changed() {
  for (const fn of changeFns) fn(state);
}

function emit(events) {
  for (const ev of events) for (const fn of eventFns) fn(ev);
}

function step() {
  const t = now();
  sim.autoCheckIns(state, t);
  const events = L.tick(state, t);
  events.push(...sim.step(state, t));
  L.pruneTexts(state, t);
  save();
  changed();
  emit(events);
}

export function start() {
  if (!timer) timer = setInterval(step, 1000);
  step();
}

/* Jump the demo clock ahead (demo panel). */
export function skip(ms) {
  offset += ms;
  step();
}

/* A fresh evening. Who you are, PINs, sound and Private Mode settings stay. */
export function reset() {
  const keep = state;
  offset = eveningOffset();
  state = L.createDemoState(now());
  if (keep) {
    state.viewer = keep.viewer;
    state.sound = keep.sound;
    for (const id of L.MEMBERS) state.members[id].pin = keep.members[id].pin;
    state.disguise = { ...keep.disguise, sent: [], inbox: [] };
  }
  save();
  changed();
}

/* Forget everything, sign-in excepted (settings, first run). */
export function wipe() {
  offset = eveningOffset();
  state = L.createDemoState(now());
  save();
  changed();
}
