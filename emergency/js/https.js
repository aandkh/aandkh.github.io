// Keep the local demo and deployed page usable without inline executable code.
(function () {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol === "http:" && !local) location.replace("https:" + location.href.slice(5));
})();
