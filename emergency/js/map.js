/* The mock map.
 *
 * A drawn neighborhood in the Atlas night style with people pinned by
 * latitude and longitude. The rest of Chill only calls createMap(),
 * setPins(), setRoute() and fit(), so the real map API can replace this
 * one file later without touching anything else.
 */

const CENTER = { lat: 41.88, lng: -87.63 };
const UNITS_PER_MILE = 100;
const MILES_PER_DEG = 69.17;
const COS = Math.cos((CENTER.lat * Math.PI) / 180);

let uid = 0;

/* Latitude and longitude to map units (100 per mile, y grows south). */
export function project(p) {
  return {
    x: (p.lng - CENTER.lng) * MILES_PER_DEG * COS * UNITS_PER_MILE,
    y: (CENTER.lat - p.lat) * MILES_PER_DEG * UNITS_PER_MILE,
  };
}

function drawing(id, mini) {
  const labels = mini ? "" : `
      <text x="-178" y="43" class="m-label">MAIN ST</text>
      <text x="88" y="-150" class="m-label">OAK ST</text>
      <text x="98" y="-121" class="m-label m-label--park">OAK ST PARK</text>
      <text x="-236" y="-238" class="m-label m-label--park">LINCOLN PARK</text>
      <text x="-250" y="167" class="m-label m-label--water">MILL RIVER</text>`;
  return `
    <svg class="m-svg" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="blk${id}" width="28" height="24" patternUnits="userSpaceOnUse">
          <rect class="m-block" x="1.6" y="1.6" width="24.8" height="20.8" rx="3.2"></rect>
        </pattern>
      </defs>
      <rect class="m-street" x="-4000" y="-4000" width="8000" height="8000"></rect>
      <rect x="-4000" y="-4000" width="8000" height="8000" fill="url(#blk${id})"></rect>
      <rect class="m-park" x="52" y="-134" width="92" height="68" rx="8"></rect>
      <rect class="m-park" x="-262" y="-262" width="124" height="92" rx="10"></rect>
      <rect class="m-park" x="332" y="218" width="80" height="60" rx="8"></rect>
      <ellipse class="m-water-fill" cx="124" cy="-114" rx="13" ry="8"></ellipse>
      <path class="m-river" d="M-1400 160 C -700 110, -300 210, 20 156 S 460 76, 1400 118"></path>
      <path class="m-road" d="M-4000 48 H4000 M-4000 -168 H4000 M-4000 264 H4000 M84 -4000 V4000 M-196 -4000 V4000 M364 -4000 V4000"></path>
      <path class="m-road" d="M-1100 -520 C -560 -380, -150 -150, 84 48"></path>
      ${labels}
      <path class="m-route" d=""></path>
    </svg>
    <div class="m-pins"></div>`;
}

/* pins: [{ id, lat, lng, color, initial, label, kind: "you" | "member" | "presser" }] */
export function createMap(container, { mini = false, minSpan = mini ? 70 : 150 } = {}) {
  const id = ++uid;
  const frame = document.createElement("div");
  frame.className = `m ${mini ? "m--mini" : "m--full"}`;
  frame.innerHTML = drawing(id, mini);
  container.appendChild(frame);
  const svg = frame.querySelector(".m-svg");
  const route = frame.querySelector(".m-route");
  const layer = frame.querySelector(".m-pins");
  const nodes = new Map();
  let pins = [];
  let view = { x0: -200, y0: -200, k: 1 };
  let lastFit = { ids: null, insets: {} };

  function size() {
    return { w: frame.clientWidth || 1, h: frame.clientHeight || 1 };
  }

  /* Pins glide only when a person moves. When the view itself changes
   * (reframing, resizing, first draw) they jump with the streets. */
  function apply(glide = false) {
    if (!glide) {
      layer.classList.add("is-jump");
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.remove("is-jump")));
    }
    const { w, h } = size();
    svg.setAttribute("viewBox", `${view.x0} ${view.y0} ${w * view.k} ${h * view.k}`);
    for (const p of pins) {
      const node = nodes.get(p.id);
      if (!node) continue;
      const u = project(p);
      node.style.transform = `translate(${(u.x - view.x0) / view.k}px, ${(u.y - view.y0) / view.k}px)`;
    }
  }

  function setPins(next) {
    const glide = next.every((p) => nodes.has(p.id));
    pins = next;
    const keep = new Set(next.map((p) => p.id));
    for (const [pid, node] of nodes) {
      if (!keep.has(pid)) {
        node.remove();
        nodes.delete(pid);
      }
    }
    for (const p of next) {
      let node = nodes.get(p.id);
      if (!node) {
        node = document.createElement("div");
        node.innerHTML = '<span class="pin__halo"></span><span class="pin__dot"></span><span class="pin__label"></span>';
        layer.appendChild(node);
        nodes.set(p.id, node);
      }
      node.className = `pin pin--${p.kind}`;
      node.style.setProperty("--pin", p.color || "#EEF0F4");
      const dot = node.children[1];
      const label = node.children[2];
      const initial = p.kind === "you" ? "" : p.initial || "";
      if (dot.textContent !== initial) dot.textContent = initial;
      label.hidden = !p.label || mini;
      if (label.textContent !== (p.label || "")) label.textContent = p.label || "";
    }
    apply(glide);
  }

  /* points: [{lat,lng}, ...] or null */
  function setRoute(points) {
    if (!points || points.length < 2) {
      route.setAttribute("d", "");
      return;
    }
    route.setAttribute("d", points.map((p, i) => {
      const u = project(p);
      return `${i ? "L" : "M"}${u.x.toFixed(1)} ${u.y.toFixed(1)}`;
    }).join(" "));
  }

  /* Frame the given pins (all when ids is null), keeping clear of UI
   * drawn over the map: insets are screen pixels. */
  function fit(ids = null, insets = {}) {
    lastFit = { ids, insets };
    const { w, h } = size();
    const pad = mini ? 18 : 56;
    const top = (insets.top || 0) + pad;
    const bottom = (insets.bottom || 0) + pad;
    const left = (insets.left || 0) + pad;
    const right = (insets.right || 0) + pad;
    const availW = Math.max(40, w - left - right);
    const availH = Math.max(40, h - top - bottom);
    const chosen = pins.filter((p) => !ids || ids.includes(p.id)).map(project);
    if (!chosen.length) chosen.push({ x: 0, y: 0 });
    const xs = chosen.map((u) => u.x);
    const ys = chosen.map((u) => u.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const k = Math.max((maxX - minX) / availW, (maxY - minY) / availH, minSpan / Math.min(availW, availH));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    view = { k, x0: cx - (left + availW / 2) * k, y0: cy - (top + availH / 2) * k };
    apply();
  }

  const ro = new ResizeObserver(() => fit(lastFit.ids, lastFit.insets));
  ro.observe(frame);

  return {
    setPins,
    setRoute,
    fit,
    destroy() {
      ro.disconnect();
      frame.remove();
    },
  };
}
