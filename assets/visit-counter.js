/* Shared visitor counter: Home may increment; all other pages only read. */
(function () {
  "use strict";

  const card = document.getElementById("visit-card");
  const todayNode = document.getElementById("visits-today");
  const totalNode = document.getElementById("visits-total");
  if (!card || !todayNode || !totalNode) return;

  const countOnThisPage =
    document.currentScript &&
    document.currentScript.getAttribute("data-count-visit") === "true";

  const api = "https://countapi.mileshilliard.com/api/v1";
  // Preserve the existing keys so the published visit totals do not reset.
  const totalKey = "jiten-kumbhakar-academic-site-total-2026-v3";
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => dateParts.find(entry => entry.type === type).value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const todayKey = `jiten-kumbhakar-academic-site-${date}-v3`;

  const readSession = key => {
    try { return sessionStorage.getItem(key) === "1"; }
    catch (_) { return false; }
  };
  const markSession = key => {
    try { sessionStorage.setItem(key, "1"); }
    catch (_) { /* Storage may be unavailable in privacy modes. */ }
  };
  const readCache = key => {
    try {
      const value = localStorage.getItem("jk-counter-cache-" + key);
      return value !== null && Number.isSafeInteger(Number(value)) ? Number(value) : null;
    } catch (_) { return null; }
  };
  const writeCache = (key, value) => {
    try { localStorage.setItem("jk-counter-cache-" + key, String(value)); }
    catch (_) { /* The counter still works without a local cache. */ }
  };

  const request = async (action, key) => {
    const response = await fetch(`${api}/${action}/${encodeURIComponent(key)}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Counter request failed");
    const data = await response.json();
    const value = Number(data && data.value);
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Counter returned an invalid value");
    return value;
  };

  const legacyCounted = readSession("jk-academic-site-visit-v3");
  let failed = false;

  const show = async (key, node, sessionKey) => {
    // Only Home increments, and each key is attempted at most once in this tab.
    const shouldIncrement = countOnThisPage && !legacyCounted && !readSession(sessionKey);
    if (shouldIncrement) markSession(sessionKey);

    try {
      const value = await request(shouldIncrement ? "hit" : "get", key);
      node.textContent = value.toLocaleString("en-US");
      writeCache(key, value);
    } catch (_) {
      try {
        // An unavailable /hit endpoint must never erase a working /get result.
        const value = await request("get", key);
        node.textContent = value.toLocaleString("en-US");
        writeCache(key, value);
      } catch (_) {
        failed = true;
        const cached = readCache(key);
        if (cached !== null) {
          node.textContent = cached.toLocaleString("en-US");
          card.title = "Some visit totals are the last values available";
        } else {
          node.textContent = "—";
          card.title = "Visitor counter temporarily unavailable";
        }
      }
    }
  };

  Promise.allSettled([
    show(totalKey, totalNode, "jk-academic-total-counted-v4"),
    show(todayKey, todayNode, `jk-academic-daily-counted-v4-${date}`)
  ]).then(() => {
    card.classList.remove("is-loading");
    card.classList.toggle("is-error", failed);
  });
})();
