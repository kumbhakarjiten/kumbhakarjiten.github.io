(function () {
  const card = document.getElementById("visit-card");
  const todayNode = document.getElementById("visits-today");
  const totalNode = document.getElementById("visits-total");
  if (!card || !todayNode || !totalNode) return;

  const api = "https://countapi.mileshilliard.com/api/v1";
  const totalKey = "jiten-kumbhakar-academic-site-total-2026-v3";
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = type => dateParts.find(x => x.type === type).value;
  const budapestDate = `${part("year")}-${part("month")}-${part("day")}`;
  const todayKey = `jiten-kumbhakar-academic-site-${budapestDate}-v3`;

  const readValue = key => fetch(`${api}/get/${key}`, { cache: "no-store" })
    .then(response => response.ok ? response.json() : { value: 0 })
    .then(data => Number.isFinite(Number(data.value)) ? Number(data.value) : 0);

  Promise.all([readValue(totalKey), readValue(todayKey)])
    .then(([total, today]) => {
      totalNode.textContent = total;
      todayNode.textContent = today;
      card.classList.remove("is-loading", "is-error");
    })
    .catch(() => {
      card.classList.remove("is-loading");
      card.classList.add("is-error");
      todayNode.textContent = "—";
      totalNode.textContent = "—";
      card.title = "Visit counter temporarily unavailable";
    });
})();
