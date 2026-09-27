/* The sign-in gate.
 *
 * This is a speed bump, not a lock: the site's repository is public, so
 * anyone determined can read this file. It keeps the page away from
 * passers-by and keeps the words themselves out of the source (only a
 * SHA-256 digest of "user:pass" lives here). Real sign-in belongs on a
 * server once there is real data behind it.
 */

const DIGEST = "8f8ee664a04a58294a17167a26257adab6d056406b1d06b40625faac13187860";
const KEY = "chill.signedIn";

async function sha256Hex(textValue) {
  const bytes = new TextEncoder().encode(textValue);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isSignedIn() {
  try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
}

export async function signIn(user, pass) {
  if (!window.crypto || !crypto.subtle) return false;
  const digest = await sha256Hex(`${String(user).trim().toLowerCase()}:${String(pass).trim()}`);
  if (digest !== DIGEST) return false;
  try { localStorage.setItem(KEY, "1"); } catch (e) { /* private window: stay signed in for this visit */ }
  return true;
}

export function signOut() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ }
}
