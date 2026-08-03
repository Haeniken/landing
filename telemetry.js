(() => {
  const footer = document.querySelector("body > footer");
  if (!footer || footer.querySelector("[data-service-telemetry]")) return;

  const language = document.documentElement.dataset.language === "en" ? "en" : "ru";
  const panel = document.createElement("aside");
  panel.className = "service-telemetry";
  panel.dataset.serviceTelemetry = "";
  panel.setAttribute("aria-label", language === "en" ? "Site release status" : "Состояние выпуска сайта");

  const createItem = (key, valueElement) => {
    const item = document.createElement("span");
    item.className = "service-telemetry-item";
    const label = document.createElement("b");
    label.className = "service-telemetry-key";
    label.textContent = key;
    valueElement.classList.add("service-telemetry-value");
    item.append(label, valueElement);
    return item;
  };

  const revision = document.createElement("code");
  revision.textContent = "-------";
  const deployed = document.createElement("time");
  deployed.textContent = "—";
  const health = document.createElement("strong");
  health.textContent = "OK";
  const healthItem = createItem("HEALTH", health);
  healthItem.classList.add("service-health", "is-ok");
  const healthLight = document.createElement("i");
  healthLight.className = "service-health-light";
  healthLight.setAttribute("aria-hidden", "true");
  healthItem.prepend(healthLight);

  panel.append(
    createItem("REV", revision),
    createItem("DEPLOYED", deployed),
    healthItem,
  );
  footer.prepend(panel);

  const formatDeploymentTime = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat(
      language === "en" ? "en-GB" : "ru-RU",
      {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    ).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.day} ${parts.month.replace(".", "")} · ${parts.hour}:${parts.minute} MSK`.toUpperCase();
  };

  fetch("/release.json", { cache: "no-store", headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error("Release metadata unavailable");
      return response.json();
    })
    .then((release) => {
      if (/^[0-9a-f]{7,40}$/i.test(release.revision)) revision.textContent = release.revision.slice(0, 7);
      else if (release.revision === "development") revision.textContent = "DEV";
      const formatted = formatDeploymentTime(release.deployedAt);
      if (formatted) {
        deployed.textContent = formatted;
        deployed.dateTime = release.deployedAt;
        deployed.title = release.deployedAt;
      }
    })
    .catch(() => {
      revision.textContent = "UNKNOWN";
      deployed.textContent = "UNKNOWN";
    });

})();
