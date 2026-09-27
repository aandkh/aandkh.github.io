/* Tiny DOM helpers.
 *
 * Chill builds each screen once from a template and then updates it in
 * place. Nothing under a finger is ever thrown away and rebuilt, which is
 * what keeps a press-and-hold alive while the clock ticks every second.
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESC[c]);
}

/* One element from an HTML string (the string must have a single root). */
export function el(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

/* Every [data-ref] under root, keyed by its value. */
export function refs(root) {
  const out = {};
  root.querySelectorAll("[data-ref]").forEach((node) => { out[node.dataset.ref] = node; });
  if (root.dataset && root.dataset.ref) out[root.dataset.ref] = root;
  return out;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Set text only when it changed, so a screen reader is not re-announced
 * the same words every second. */
export function text(node, value) {
  const v = String(value);
  if (node && node.textContent !== v) node.textContent = v;
}

export function show(node, visible) {
  if (node) node.hidden = !visible;
}

/* Delegated clicks: <button data-act="share-open"> calls handlers["share-open"]. */
export function onAct(root, handlers) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || !root.contains(btn)) return;
    const fn = handlers[btn.dataset.act];
    if (fn) fn(btn, e);
  });
}

/* Add .is-open after the element's first style is in place, so its CSS
 * transition runs. A forced layout does this without waiting for a frame,
 * which never comes while a page is in the background. */
export function open(node, cls = "is-open") {
  void node.offsetWidth;
  node.classList.add(cls);
}
