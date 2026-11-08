/* Shared public visitor counter. Count each 30-minute browser session, on any page. */
(function () {
  "use strict";
  const card = document.getElementById("visit-card");
  const todayNode = document.getElementById("visits-today");
  const totalNode = document.getElementById("visits-total");
  if (!card || !todayNode || !totalNode) return;

  const api = "https://countapi.mileshilliard.com/api/v1";
  // Keep the same server-side keys: previous visitor totals must not reset.
  const totalKey = "jiten-kumbhakar-academic-site-total-2026-v3";
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => dateParts.find(item => item.type === type).value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const todayKey = `jiten-kumbhakar-academic-site-${date}-v3`;
  const sessionKey = "jk-visitor-session-v5";
  const maxIdleMs = 30 * 60 * 1000;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Private browsing may block it. */ }
  }
  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (_) { /* Ignore storage restrictions. */ }
  }
  function readRecord(key) {
    try { return JSON.parse(readStorage(key) || "null"); } catch (_) { return null; }
  }

  const now = Date.now();
  const previous = readRecord(sessionKey);
  const sameVisit = previous && previous.date === date &&
    typeof previous.lastAt === "number" &&
    now >= previous.lastAt && now - previous.lastAt < maxIdleMs;
  // A fresh visit starts after 30 minutes of inactivity or at a new local date.
  const visitId = sameVisit && typeof previous.id === "string" ? previous.id :
    `${now}-${Math.random().toString(36).slice(2)}`;
  writeStorage(sessionKey, JSON.stringify({ id: visitId, date, lastAt: now }));

  async function request(action, key) {
    const response = await fetch(`${api}/${action}/${encodeURIComponent(key)}`, {
      cache: "no-store"
    });
    // A new day's key may not exist until someone first visits.
    if (response.status === 404 && action === "get" && key === todayKey) return 0;
    if (!response.ok) throw new Error(`Counter HTTP ${response.status}`);
    const data = await response.json();
    const value = Number(data && data.value);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid counter value");
    return value;
  }

  let usedCache = false;
  let unavailable = false;
  async function updateMetric(key, node) {
    const doneKey = `jk-visit-counted-v5-${key}`;
    const lockKey = `jk-visit-lock-v5-${key}`;
    const cacheKey = `jk-counter-cache-${key}`;
    const lock = readRecord(lockKey);
    const locked = lock && lock.id === visitId && typeof lock.at === "number" &&
      now >= lock.at && now - lock.at < 15000;
    const shouldHit = readStorage(doneKey) !== visitId && !locked;

    if (shouldHit) writeStorage(lockKey, JSON.stringify({ id: visitId, at: now }));
    try {
      const value = await request(shouldHit ? "hit" : "get", key);
      node.textContent = value.toLocaleString("en-US");
      writeStorage(cacheKey, String(value));
      if (shouldHit) writeStorage(doneKey, visitId);
    } catch (_) {
      // Read-only fallback; never claim an increment happened when it did not.
      try {
        const value = await request("get", key);
        node.textContent = value.toLocaleString("en-US");
        writeStorage(cacheKey, String(value));
      } catch (_) {
        unavailable = true;
        const cached = readStorage(cacheKey);
        if (cached !== null && Number.isSafeInteger(Number(cached))) {
          node.textContent = Number(cached).toLocaleString("en-US");
          usedCache = true;
        } else {
          node.textContent = "—";
        }
      }
    } finally {
      const currentLock = readRecord(lockKey);
      if (shouldHit && currentLock && currentLock.id === visitId) removeStorage(lockKey);
    }
  }

  Promise.allSettled([
    updateMetric(totalKey, totalNode),
    updateMetric(todayKey, todayNode)
  ]).then(() => {
    card.classList.remove("is-loading");
    card.classList.toggle("is-error", unavailable);
    if (usedCache) {
      const smallHeading = card.querySelector(".visit-heading small");
      if (smallHeading) smallHeading.textContent = "Last known totals";
      card.title = "The counter service is unavailable; values may be out of date.";
    } else if (unavailable) {
      card.title = "The visitor counter is temporarily unavailable.";
    } else {
      card.removeAttribute("title");
    }
  });
})();
