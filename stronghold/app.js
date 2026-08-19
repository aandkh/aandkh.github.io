/* STRONGHOLD: the client's whole conversation with the server.
 *
 * There is deliberately no game logic in the browser. Every rule lives
 * in the same Python simulation the desktop game runs, so a phone, a
 * library PC and the downloadable build are all playing the identical
 * game. The browser draws what it is told and posts what you typed.
 *
 * The one thing it must never do is hold your staged day in a form:
 * every control posts the moment it changes, and the server keeps it
 * with the campaign. Switch tabs, lock your phone, come back on another
 * machine, and the day you were building is still there.
 */
(function (global) {
  "use strict";

  // Where the game server lives. Deployed 2026-08-16 on Fly.io: one
  // machine in Chicago with a 1 GB volume holding every campaign.
  // Running it locally? `python run.py --dev` in stronghold-server and
  // this picks up 127.0.0.1 automatically.
  var API = (function () {
    var host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8787";
    }
    return "https://aandkh-stronghold.fly.dev";
  })();

  var TOKEN_KEY = "sh.token";

  function token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function call(path, body, method) {
    var opts = {
      method: method || (body ? "POST" : "GET"),
      headers: { "X-Token": token() },
      mode: "cors"
    };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(API + path, opts).then(function (r) {
      return r.json().then(function (j) {
        if (j && j.signed_out) { setToken(""); }
        return j;
      }).catch(function () {
        throw new Error("server sent something unreadable (" + r.status + ")");
      });
    });
  }

  global.SH = {
    api: API,
    getToken: token,
    setToken: setToken,
    slots: function () { return call("/api/slots"); },
    honours: function () { return call("/api/honours"); },
    health: function () { return call("/api/health"); },
    register: function (u, p, names) {
      names = names || {};
      return call("/api/register", {
        username: u, password: p,
        province: names.province || "",
        realm: names.realm || "",
        house: names.house || ""
      });
    },
    login: function (u, p) { return call("/api/login", { username: u, password: p }); },
    logout: function () { return call("/api/logout", {}); },
    // `tab` asks the server to build only the room being looked at.
    // All fifteen rooms is 43 KB; one is about 4 KB, and the client
    // only ever draws one at a time.
    state: function (tab) {
      return call("/api/state" + (tab ? "?tab=" + encodeURIComponent(tab) : ""));
    },
    order: function (key, value) { return call("/api/order", { order: key, value: value }); },
    commit: function () { return call("/api/commit", {}); },
    quit: function () { return call("/api/quit", { confirm: "END MY CAMPAIGN" }); },
    finale: function (text) { return call("/api/finale", { text: text }); }
  };
})(window);
