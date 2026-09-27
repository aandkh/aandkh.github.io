/* The two screens before Chill: the sign-in gate, and picking who you are. */

import { el, refs } from "./dom.js";
import { icon } from "./icons.js";
import * as L from "./logic.js";
import * as gate from "./gate.js";
import { avatar } from "./ui-common.js";

const AGES = { ava: "16", leo: "13" };

export function renderGate(host, onDone) {
  const node = el(`
    <form class="gate" autocomplete="off" novalidate>
      <div class="gate__mark">${icon("wave", 44, 1.8)}</div>
      <h1 class="gate__name">Chill</h1>
      <p class="gate__tag">Private until it matters.</p>
      <label class="field">
        <span class="field__label">Username</span>
        <input class="field__input" name="u" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" required>
      </label>
      <label class="field">
        <span class="field__label">Password</span>
        <input class="field__input" name="p" type="password" autocomplete="off" required>
      </label>
      <p class="gate__err" data-ref="err" aria-live="assertive"></p>
      <button type="submit" class="btn btn--light btn--big" data-ref="go">Sign in</button>
    </form>`);
  const r = refs(node);
  host.appendChild(node);
  node.querySelector("input").focus();
  node.addEventListener("submit", async (e) => {
    e.preventDefault();
    r.err.textContent = "";
    r.go.disabled = true;
    const ok = await gate.signIn(node.u.value, node.p.value);
    r.go.disabled = false;
    if (ok) {
      node.remove();
      onDone();
      return;
    }
    r.err.textContent = window.crypto && crypto.subtle ? "That's not it." : "Open this page over https to sign in.";
    node.classList.remove("is-shaking");
    void node.offsetWidth;
    node.classList.add("is-shaking");
    node.p.value = "";
    node.p.focus();
  });
}

/* Resolves the member id picked. */
export function chooseViewer(host, s) {
  return new Promise((resolve) => {
    const node = el(`
      <div class="first">
        <span class="brand">${icon("wave", 18, 2.2)} CHILL</span>
        <h1 class="first__title">Who are you tonight?</h1>
        <p class="first__sub">Chill is a mock with a pretend family and a pretend evening. Pick who to be. You can switch any time from the Demo button.</p>
        <div class="first__grid">
          ${L.MEMBERS.map((id) => {
            const m = s.members[id];
            return `<button type="button" class="first__card" data-id="${id}">
              ${avatar(m, 64)}
              <span class="first__name">${m.name}</span>
              <span class="first__age">${AGES[id] ? `${AGES[id]} years old` : "Parent"}</span>
            </button>`;
          }).join("")}
        </div>
      </div>`);
    host.appendChild(node);
    node.addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;
      node.remove();
      resolve(card.dataset.id);
    });
  });
}
