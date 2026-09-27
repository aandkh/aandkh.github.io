/* Home: the Tiles screen in the dark theme.
 *
 * Built once, then updated in place every second, so a press-and-hold on
 * the SOS tile is never interrupted by the clock.
 */

import { el, refs, text, show, onAct } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import { attachHold } from "./hold.js";
import { createMap } from "./map.js";
import { avatar, shareUntil, hasFix, toast } from "./ui-common.js";
import { shareSheet, checkInSheet, nightlySheet, familySheet } from "./ui-sheets.js";

export function mountHome(container, ctx) {
  const root = el(`
    <div class="home">
      <header class="home__head">
        <div class="home__hello">
          <span class="brand">${icon("wave", 18, 2.2)} CHILL</span>
          <h1 class="home__hi">Hi, <span data-ref="name"></span></h1>
        </div>
        <button type="button" class="icon-btn" data-act="settings" aria-label="Settings">${icon("sliders", 20)}</button>
      </header>

      <button type="button" class="vis-banner" data-ref="visBanner" data-act="share-stop" hidden>
        <span class="vis-banner__dot"></span>
        <span class="vis-banner__text" data-ref="visText"></span>
        <span class="vis-banner__act">Stop</span>
      </button>

      <div class="silent-line" data-ref="silentLine" hidden>
        <span data-ref="silentText">Silent alert on. Your family can see where you are.</span>
        <button type="button" class="silent-line__end" data-act="silent-end">End</button>
      </div>

      <div class="grid">
        <button type="button" class="tile tile--sos span-2" data-ref="sos" aria-label="Emergency. Press and hold.">
          <span class="sos__ring sos__ring--a" aria-hidden="true"></span>
          <span class="sos__ring sos__ring--b" aria-hidden="true"></span>
          <span class="sos__fill" aria-hidden="true"></span>
          <span class="chip chip--glass">SOS</span>
          <span class="sos__text">
            <span class="sos__title">Hold for help</span>
            <span class="sos__sub">Press and hold. Alerts everyone and shares where you are.</span>
          </span>
        </button>

        <div class="tile tile--loc" data-ref="loc">
          <div class="tile__top">
            <span>Your location</span>
            <span data-ref="locIcon">${icon("lock", 16, 2.2)}</span>
          </div>
          <div class="tile__mid">
            <span class="tile__big" data-ref="locState">Private</span>
            <span class="tile__sub" data-ref="locSub"></span>
          </div>
          <button type="button" class="pill-btn" data-ref="locBtn" data-act="share-open">Share</button>
        </div>

        <button type="button" class="tile tile--silent" data-ref="silent" aria-label="Silent alert. Press and hold.">
          <span class="silent__fill" aria-hidden="true"></span>
          <span class="tile__chip">${icon("bellOff", 20)}</span>
          <span class="tile__stack">
            <span class="tile__title">Silent alert</span>
            <span class="tile__sub tile__sub--silent">Press and hold to send quietly</span>
          </span>
        </button>

        <div class="span-2 visible-list" data-ref="visible"></div>

        <div class="tile tile--check" data-ref="check">
          <div class="tile__top">
            <span data-ref="checkLabel">Check-in timer</span>
            ${icon("timer", 18)}
          </div>
          <div class="tile__mid">
            <span class="tile__big" data-ref="checkBig">Off</span>
            <span class="tile__sub" data-ref="checkSub"></span>
          </div>
          <div class="tile__btns">
            <button type="button" class="pill-btn pill-btn--check" data-ref="checkBtn" data-act="checkin-open">Set</button>
            <button type="button" class="link-btn" data-ref="checkEdit" data-act="checkin-open" hidden>Change</button>
          </div>
        </div>

        <div class="tile tile--night" data-ref="night">
          <div class="tile__top">
            <span>Nightly check-in</span>
            <button type="button" class="switch" role="switch" data-ref="nightSwitch" data-act="night-toggle" aria-label="Nightly check-in"><span></span></button>
          </div>
          <button type="button" class="tile__mid tile__mid--btn" data-act="night-open" aria-label="Change the nightly check-in time">
            <span class="tile__big" data-ref="nightBig">11:00 PM</span>
            <span class="tile__sub" data-ref="nightSub"></span>
          </button>
          <button type="button" class="pill-btn pill-btn--night" data-ref="nightBtn" data-act="night-checkin" hidden>I'm OK</button>
        </div>

        <button type="button" class="tile tile--family span-2" data-act="family" aria-label="Family">
          <span class="family__avs" data-ref="famAvs"></span>
          <span class="tile__stack">
            <span class="tile__title">Family</span>
            <span class="tile__sub" data-ref="famSub"></span>
          </span>
          <span class="family__go">${icon("chevron", 20)}</span>
        </button>
      </div>
    </div>`);
  container.appendChild(root);
  const r = refs(root);

  const holdFill = (node) => (p) => node.style.setProperty("--hold", p.toFixed(3));
  attachHold(r.sos, { onProgress: holdFill(r.sos), onFire: () => ctx.trigger("button") });
  attachHold(r.silent, { onProgress: holdFill(r.silent), onFire: () => ctx.trigger("silent") });

  onAct(root, {
    settings: () => ctx.openSettings(),
    "share-open": () => shareSheet(ctx),
    "share-stop": () => {
      ctx.store.update((s, now) => L.setShare(s, ctx.viewer(), "off", now));
      toast("You're private again.");
    },
    "silent-end": () => ctx.endMine(),
    "checkin-open": () => checkInSheet(ctx),
    "checkin-now": () => ctx.checkInNow(),
    "night-open": () => nightlySheet(ctx),
    "night-toggle": () => ctx.store.update((s, now) => {
      const n = s.members[ctx.viewer()].nightly;
      n.on = !n.on;
      n.since = now;
      L.addLog(s, now, `${s.members[ctx.viewer()].name} turned the nightly check-in ${n.on ? "on" : "off"}.`);
    }),
    "night-checkin": () => ctx.checkInNow(),
    family: () => familySheet(ctx),
  });

  /* Wide tiles for people you can see because they chose to share. */
  let visibleKey = "";
  const minis = new Map();

  function renderVisible(s, now, ids) {
    const key = ids.join(",");
    if (key !== visibleKey) {
      visibleKey = key;
      for (const m of minis.values()) m.map.destroy();
      minis.clear();
      r.visible.innerHTML = "";
      if (!ids.length) {
        r.visible.appendChild(el(`
          <div class="tile tile--quiet">
            <span class="tile__chip tile__chip--quiet">${icon("lock", 18)}</span>
            <span class="tile__stack">
              <span class="tile__title">Nobody is sharing right now</span>
              <span class="tile__sub">Everyone's private. Locations open only in an emergency or when someone chooses to share.</span>
            </span>
          </div>`));
      }
      for (const id of ids) {
        const m = s.members[id];
        const tile = el(`
          <div class="tile tile--share">
            <div class="share__text">
              <div class="share__who">${avatar(m, 34)}<span class="tile__title" data-ref="title"></span></div>
              <div class="share__lines">
                <span class="tile__sub tile__sub--share" data-ref="until"></span>
                <span class="share__dist" data-ref="dist"></span>
              </div>
            </div>
            <div class="share__map" data-ref="map"></div>
          </div>`);
        r.visible.appendChild(tile);
        const tr = refs(tile);
        minis.set(id, { refs: tr, map: createMap(tr.map, { mini: true }) });
      }
    }
    const me = s.members[ctx.viewer()];
    for (const [id, mini] of minis) {
      const m = s.members[id];
      text(mini.refs.title, `${m.name} is sharing`);
      text(mini.refs.until, shareUntil(m).replace(/^./, (c) => c.toUpperCase()));
      if (hasFix(m)) {
        text(mini.refs.dist, `${L.distanceMi(me.pos, m.pos).toFixed(1)} mi away`);
        mini.map.setPins([{ id, lat: m.pos.lat, lng: m.pos.lng, color: m.color, initial: m.initial, kind: "member" }]);
      } else {
        text(mini.refs.dist, "Location unavailable right now");
        mini.map.setPins([]);
      }
      mini.map.fit([id]);
    }
  }

  function update(s, now) {
    const viewer = ctx.viewer();
    const me = s.members[viewer];
    const inc = L.activeIncident(s);
    text(r.name, me.name);

    // Banner: anyone who can see you because you chose to share.
    const sharing = L.isSharing(s, viewer, now);
    show(r.visBanner, sharing);
    if (sharing) text(r.visText, `Everyone can see you ${shareUntil(me)}`);

    // A silent alert keeps Home calm-looking; one gray line says it is on.
    const mine = inc && inc.people.find((p) => p.id === viewer);
    show(r.silentLine, !!mine && mine.kind === "silent");

    // Your location tile.
    r.loc.classList.toggle("is-sharing", sharing);
    text(r.locState, sharing ? "Sharing" : "Private");
    text(r.locSub, sharing ? shareUntil(me) : "Nobody can see you");
    text(r.locBtn, sharing ? "Stop" : "Share");
    r.locBtn.dataset.act = sharing ? "share-stop" : "share-open";
    r.locIcon.innerHTML = icon(sharing ? "broadcast" : "lock", 16, 2.2);

    // People you can see because they chose to share.
    renderVisible(s, now, L.MEMBERS.filter((id) => id !== viewer && L.canSee(s, viewer, id, now) === "sharing"));

    // Check-in timer.
    const c = me.checkIn;
    r.check.classList.toggle("is-urgent", !!c && now >= c.due);
    r.check.classList.toggle("is-on", !!c);
    show(r.checkEdit, !!c && now < c.due);
    if (!c) {
      text(r.checkLabel, "Check-in timer");
      text(r.checkBig, "Off");
      text(r.checkSub, "Set one before you head out");
      text(r.checkBtn, "Set");
      r.checkBtn.dataset.act = "checkin-open";
    } else if (now < c.due) {
      text(r.checkLabel, "Check in by");
      text(r.checkBig, L.fmtClock(c.due));
      text(r.checkSub, `in ${L.fmtElapsed(c.due - now)}`);
      text(r.checkBtn, "I'm OK");
      r.checkBtn.dataset.act = "checkin-now";
    } else {
      text(r.checkLabel, "Check in now");
      text(r.checkBig, L.fmtElapsed(c.due + L.LAST_CALL - now));
      text(r.checkSub, "before your family is alerted");
      text(r.checkBtn, "I'm OK");
      r.checkBtn.dataset.act = "checkin-now";
    }

    // Nightly check-in.
    const n = me.nightly;
    r.nightSwitch.setAttribute("aria-checked", String(n.on));
    r.night.classList.toggle("is-off", !n.on);
    text(r.nightBig, n.on ? L.fmtHHMM(n.time) : "Off");
    const due = L.nextNightlyDue(me, now);
    let nightSub = "Tap to set a time";
    let canCheck = false;
    if (n.on && due !== null) {
      const tonightDone = n.handledFor !== null && due - n.handledFor >= 20 * L.HOUR;
      if (now >= due) {
        nightSub = "Check in now";
        canCheck = true;
      } else if (now >= due - L.NIGHTLY_WINDOW) {
        nightSub = tonightDone ? "Checked in for tonight" : `Due in ${L.fmtElapsed(due - now)}`;
        canCheck = !tonightDone;
      } else {
        nightSub = tonightDone ? "Checked in for tonight" : "Every night";
      }
    }
    text(r.nightSub, nightSub);
    show(r.nightBtn, canCheck);

    // Family summary.
    const others = L.MEMBERS.filter((id) => id !== viewer);
    const sharingCount = others.filter((id) => L.canSee(s, viewer, id, now) === "sharing").length;
    const avs = others.map((id) => avatar(s.members[id], 32, "av--stack")).join("");
    if (r.famAvs.dataset.key !== others.join()) {
      r.famAvs.innerHTML = avs;
      r.famAvs.dataset.key = others.join();
    }
    text(r.famSub, `${sharingCount} sharing · ${others.length - sharingCount} private`);
  }

  return { update, root };
}
