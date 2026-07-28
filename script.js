const root = document.documentElement;
const loadRocketStyles = () => {
  if (document.querySelector('link[href^="/rocket."]')) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/rocket.min.css?v=20260728d";
  document.head.append(stylesheet);
};
window.addEventListener("scroll", loadRocketStyles, { once: true, passive: true });
if (window.location.hash) loadRocketStyles();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadRocketStyles();
}, { once: true });

const year = document.querySelector("[data-year]");
if (year) {
  year.textContent = new Date().getFullYear();
}

const menuToggle = document.querySelector(".mobile-menu-toggle");
const menu = menuToggle
  ? document.getElementById(menuToggle.getAttribute("aria-controls"))
  : null;

if (menuToggle && menu) {
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-open");
  };

  menuToggle.addEventListener("click", () => {
    const willOpen = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(willOpen));
    menu.classList.toggle("is-open", willOpen);
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (event) => {
    if (menu.classList.contains("is-open") && !menuToggle.closest(".site-header").contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      closeMenu();
      menuToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1000) {
      closeMenu();
    }
  });
}

const decodeEmailAddress = () => String.fromCharCode(
  98, 104, 46, 104, 97, 101, 110, 105, 107, 101, 110,
  64, 103, 109, 97, 105, 108, 46, 99, 111, 109
);

const emailAction = document.querySelector("[data-email-action]");
if (emailAction) {
  emailAction.addEventListener("click", () => {
    const address = decodeEmailAddress();
    const subject = root.dataset.language === "ru"
      ? "Обсудить DevOps / SRE задачу"
      : "DevOps / SRE opportunity";
    window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}`;
  });
}

const printActions = document.querySelectorAll("[data-print-action]");
const printContacts = document.querySelectorAll("[data-print-contact]");
let printStylesPromise;

const loadPrintStyles = () => {
  if (printStylesPromise) {
    return printStylesPromise;
  }

  printStylesPromise = new Promise((resolve) => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/print.css?v=20260727f";
    stylesheet.media = "all";
    stylesheet.dataset.printStylesheet = "";
    stylesheet.addEventListener("load", resolve, { once: true });
    stylesheet.addEventListener("error", resolve, { once: true });
    document.head.appendChild(stylesheet);
  });

  return printStylesPromise;
};

const preparePrintContact = () => {
  if (printContacts.length === 0) {
    return;
  }

  const address = decodeEmailAddress();
  const contactLine = root.dataset.language === "ru"
    ? `Почта: ${address} · Telegram: @haeniken · GitHub: Haeniken`
    : `Email: ${address} · Telegram: @haeniken · GitHub: Haeniken`;
  printContacts.forEach((element) => {
    element.textContent = contactLine;
  });
};

if (printActions.length > 0) {
  printActions.forEach((printAction) => {
    printAction.addEventListener("click", async () => {
      if (menuToggle && menu) {
        menuToggle.setAttribute("aria-expanded", "false");
        menu.classList.remove("is-open");
      }
      preparePrintContact();
      await loadPrintStyles();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();
      const stylesheet = document.querySelector("[data-print-stylesheet]");
      if (stylesheet) {
        stylesheet.media = "print";
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      printActions[0].click();
    }
  });
}

window.addEventListener("beforeprint", preparePrintContact);
window.addEventListener("afterprint", () => {
  printContacts.forEach((element) => {
    element.textContent = "";
  });
  const stylesheet = document.querySelector("[data-print-stylesheet]");
  if (stylesheet) {
    stylesheet.remove();
    printStylesPromise = undefined;
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((element) => {
  observer.observe(element);
});

const returnToTop = document.querySelector("[data-return-to-top]");
if (returnToTop) {
  const returnLabel = root.dataset.language === "en"
    ? returnToTop.dataset.labelEn
    : returnToTop.dataset.labelRu;
  returnToTop.dataset.label = returnLabel;
  returnToTop.setAttribute("aria-label", returnLabel);

  let scrollFrame = 0;
  const updateReturnToTop = () => {
    scrollFrame = 0;
    if (!returnToTop.classList.contains("is-launching")) {
      returnToTop.classList.toggle("is-visible", window.scrollY > Math.min(520, window.innerHeight * .62));
    }
  };
  window.addEventListener("scroll", () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateReturnToTop);
  }, { passive: true });
  updateReturnToTop();

  returnToTop.addEventListener("click", () => {
    if (returnToTop.classList.contains("is-launching")) return;
    returnToTop.classList.add("is-visible", "is-launching");
    returnToTop.setAttribute("aria-busy", "true");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    window.setTimeout(() => {
      returnToTop.classList.remove("is-launching");
      returnToTop.removeAttribute("aria-busy");
      updateReturnToTop();
    }, reducedMotion ? 50 : 1180);
  });
}

const satelliteTrain = document.querySelector("[data-satellite-train]");
if (satelliteTrain && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let satelliteTimer;
  const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
  const scheduleSatellitePass = (firstPass = false) => {
    window.clearTimeout(satelliteTimer);
    const delay = firstPass ? randomBetween(12000, 21000) : randomBetween(38000, 82000);
    satelliteTimer = window.setTimeout(() => {
      if (document.hidden) {
        scheduleSatellitePass(false);
        return;
      }
      const startY = randomBetween(5.5, 14);
      const descent = randomBetween(7, 17);
      satelliteTrain.style.setProperty("--satellite-start-y", `${startY.toFixed(1)}%`);
      satelliteTrain.style.setProperty("--satellite-end-y", `${(startY + descent).toFixed(1)}%`);
      satelliteTrain.style.setProperty("--satellite-tilt", `${randomBetween(3, 8).toFixed(1)}deg`);
      satelliteTrain.style.setProperty("--satellite-duration", `${randomBetween(14.5, 20.5).toFixed(1)}s`);
      satelliteTrain.classList.remove("is-passing");
      void satelliteTrain.offsetWidth;
      satelliteTrain.classList.add("is-passing");
    }, delay);
  };
  satelliteTrain.addEventListener("animationend", (event) => {
    if (event.animationName !== "satellite-pass") return;
    satelliteTrain.classList.remove("is-passing");
    scheduleSatellitePass(false);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !satelliteTrain.classList.contains("is-passing")) scheduleSatellitePass(false);
  });
  scheduleSatellitePass(true);
}

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll("[data-ambient-scan]").forEach((surface) => {
    let scanTimer;
    let isVisible = false;
    const scheduleScan = (firstPass = false) => {
      window.clearTimeout(scanTimer);
      if (!isVisible) return;
      const minimum = firstPass ? 1800 : 22000;
      const maximum = firstPass ? 4200 : 48000;
      scanTimer = window.setTimeout(() => {
        if (document.hidden || !isVisible) {
          scheduleScan(false);
          return;
        }
        surface.style.setProperty("--ambient-scan-angle", `${(-2 + Math.random() * 5).toFixed(1)}deg`);
        surface.style.setProperty("--ambient-scan-duration", `${(4.2 + Math.random() * 1.7).toFixed(1)}s`);
        surface.classList.remove("is-ambient-scanning");
        void surface.offsetWidth;
        surface.classList.add("is-ambient-scanning");
      }, minimum + Math.random() * (maximum - minimum));
    };
    surface.addEventListener("animationend", (event) => {
      if (event.animationName !== "photo-ambient-scan") return;
      surface.classList.remove("is-ambient-scanning");
      scheduleScan(false);
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      const becameVisible = !isVisible && entry.isIntersecting;
      isVisible = entry.isIntersecting;
      if (becameVisible) scheduleScan(true);
      if (!isVisible) {
        window.clearTimeout(scanTimer);
        surface.classList.remove("is-ambient-scanning");
      }
    }, { threshold: 0.18 });
    visibilityObserver.observe(surface);
  });
}
