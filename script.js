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

const lazyBackgroundVideos = document.querySelectorAll("[data-lazy-background-video]");
if (lazyBackgroundVideos.length) {
  const reducedVideoMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loadBackgroundVideo = (video) => {
    if (!video.poster && video.dataset.poster) video.poster = video.dataset.poster;
    if (reducedVideoMotion) return;
    if (video.dataset.loaded === "true") return;
    const source = document.createElement("source");
    source.type = "video/mp4";
    source.src = window.matchMedia("(max-width: 650px)").matches
      ? video.dataset.srcMobile
      : video.dataset.srcDesktop;
    video.append(source);
    video.dataset.loaded = "true";
    video.load();
  };
  const updateBackgroundVideo = (video) => {
    if (video.dataset.inView === "true" && !document.hidden && !reducedVideoMotion) {
      loadBackgroundVideo(video);
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };
  const videoLoader = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadBackgroundVideo(entry.target);
      videoLoader.unobserve(entry.target);
    });
  }, { rootMargin: "320px 0px" });
  const videoPlayback = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.dataset.inView = String(entry.isIntersecting);
      updateBackgroundVideo(entry.target);
    });
  }, { threshold: 0.12 });
  lazyBackgroundVideos.forEach((video) => {
    videoLoader.observe(video);
    videoPlayback.observe(video);
    video.addEventListener("canplay", () => updateBackgroundVideo(video));
  });
  document.addEventListener("visibilitychange", () => {
    lazyBackgroundVideos.forEach(updateBackgroundVideo);
  });
}

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

const networkDiagram = document.querySelector("[data-network-failover]");
if (networkDiagram && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const networkLinks = ["ab", "ac", "ad", "bc", "bd", "cd"];
  const networkStateClasses = ["is-alert", "is-failover", "is-recovery"];
  const networkTargets = [
    ...networkDiagram.querySelectorAll("[data-network-primary], [data-network-failure], [data-network-backup-active], [data-network-recovery], [data-network-marker], [data-network-primary-flow], [data-network-backup-flow]"),
  ];
  const networkNodes = [...networkDiagram.querySelectorAll("[data-network-node]")];
  const networkTriggerText = networkDiagram.querySelector("[data-network-trigger-text]");
  let networkTimer;
  let networkVisible = false;
  let previousNetworkSelection = "";

  const networkAttributeValue = (element) => [
    "networkPrimary", "networkFailure", "networkBackupActive", "networkRecovery",
    "networkMarker", "networkPrimaryFlow", "networkBackupFlow",
  ].map((key) => element.dataset[key]).find(Boolean);

  const resetNetworkDiagram = () => {
    networkDiagram.classList.remove(...networkStateClasses);
    networkTargets.forEach((element) => {
      element.classList.remove("is-active");
    });
    networkNodes.forEach((node) => {
      node.classList.remove("is-affected");
    });
  };

  const setNetworkState = (state) => {
    networkDiagram.classList.remove(...networkStateClasses);
    if (state) networkDiagram.classList.add(`is-${state}`);
  };

  const selectNetworkFailures = () => {
    let selected;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const shuffled = [...networkLinks].sort(() => Math.random() - .5);
      selected = shuffled.slice(0, Math.random() < .32 ? 2 : 1).sort();
      if (selected.join(",") !== previousNetworkSelection) break;
    }
    previousNetworkSelection = selected.join(",");
    return selected;
  };

  const activateNetworkFailures = (selected) => {
    const active = new Set(selected);
    networkTargets.forEach((element) => {
      element.classList.toggle("is-active", active.has(networkAttributeValue(element)));
    });
    networkNodes.forEach((node) => {
      node.classList.toggle("is-affected", selected.some((link) => link.includes(node.dataset.networkNode)));
    });
    if (networkTriggerText) {
      const routes = selected.map((link) => link.toUpperCase().split("").join("↔")).join(" + ");
      networkTriggerText.textContent = root.dataset.language === "en"
        ? `WG ${routes} · LINK DOWN`
        : `WG ${routes} · НЕТ СВЯЗИ`;
    }
  };

  const scheduleNetworkCycle = (initial = false) => {
    window.clearTimeout(networkTimer);
    if (!networkVisible || document.hidden) return;
    resetNetworkDiagram();
    const delay = initial ? 2400 : 4200 + Math.random() * 4200;
    networkTimer = window.setTimeout(() => {
      const selected = selectNetworkFailures();
      activateNetworkFailures(selected);
      setNetworkState("alert");
      networkTimer = window.setTimeout(() => {
        setNetworkState("failover");
        networkTimer = window.setTimeout(() => {
          setNetworkState("recovery");
          networkTimer = window.setTimeout(() => scheduleNetworkCycle(false), 2800);
        }, 6200 + Math.random() * 1800);
      }, 2800);
    }, delay);
  };

  const networkVisibility = new IntersectionObserver(([entry]) => {
    networkVisible = entry.isIntersecting;
    window.clearTimeout(networkTimer);
    if (networkVisible && !document.hidden) scheduleNetworkCycle(true);
    else resetNetworkDiagram();
  }, { threshold: .12 });
  networkVisibility.observe(networkDiagram);
  document.addEventListener("visibilitychange", () => {
    window.clearTimeout(networkTimer);
    if (!document.hidden && networkVisible) scheduleNetworkCycle(true);
    else resetNetworkDiagram();
  });
}

const astroArchitecture = document.querySelector("[data-astro-architecture]");
if (astroArchitecture) {
  const astroStages = ["sync", "request", "compute", "render"];
  const astroLabels = {
    ru: [
      "СИНХРОНИЗАЦИЯ · ПРОВЕРКА ЦИКЛА",
      "ЗАПРОС · КООРДИНАТЫ И МОДЕЛЬ",
      "РАСЧЁТ · ОБЛАКА / Cn² / ЭФЕМЕРИДЫ",
      "ОТРИСОВКА · 7 ГРАФИКОВ / ОТПРАВКА",
    ],
    en: [
      "SYNC · RUN VALIDATION",
      "REQUEST · LOCATION AND PROVIDER",
      "COMPUTE · CLOUD / Cn² / EPHEMERIDES",
      "RENDER · 7 CHARTS / DELIVERY",
    ],
  };
  const astroStageLabel = astroArchitecture.querySelector("[data-astro-stage-label]");
  const astroStageIndex = astroArchitecture.querySelector("[data-astro-stage-index]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let astroIndex = 0;
  let astroTimer;
  let astroVisible = false;

  const showAstroStage = (index) => {
    astroArchitecture.classList.remove(...astroStages.map((stage) => `is-${stage}`));
    astroArchitecture.classList.add(`is-${astroStages[index]}`);
    const language = root.dataset.language === "en" ? "en" : "ru";
    if (astroStageLabel) astroStageLabel.textContent = astroLabels[language][index];
    if (astroStageIndex) astroStageIndex.textContent = `${String(index + 1).padStart(2, "0")} / 04`;
  };

  const scheduleAstroStage = () => {
    window.clearTimeout(astroTimer);
    if (!astroVisible || document.hidden || reducedMotion) return;
    astroTimer = window.setTimeout(() => {
      astroIndex = (astroIndex + 1) % astroStages.length;
      showAstroStage(astroIndex);
      scheduleAstroStage();
    }, 4300);
  };

  showAstroStage(0);
  if (!reducedMotion) {
    const astroVisibility = new IntersectionObserver(([entry]) => {
      astroVisible = entry.isIntersecting;
      window.clearTimeout(astroTimer);
      if (astroVisible && !document.hidden) scheduleAstroStage();
    }, { threshold: .12 });
    astroVisibility.observe(astroArchitecture);
    document.addEventListener("visibilitychange", () => {
      window.clearTimeout(astroTimer);
      if (!document.hidden && astroVisible) scheduleAstroStage();
    });
  }
}

const rabbitArchitecture = document.querySelector("[data-rabbit-architecture]");
if (rabbitArchitecture) {
  const rabbitStages = ["intent", "confirm", "provision", "reconcile"];
  const rabbitLabels = {
    ru: [
      "НАМЕРЕНИЕ · ПЛАТЁЖ СОЗДАН",
      "ПОДТВЕРЖДЕНИЕ · ПОДПИСЬ / СУММА / АУДИТ",
      "ДОСТУП · ЖЕЛАЕМОЕ СОСТОЯНИЕ / 3X-UI",
      "СВЕРКА · ФАКТ / ПОВТОР / ВОССТАНОВЛЕНИЕ",
    ],
    en: [
      "INTENT · PAYMENT CREATED",
      "CONFIRM · SIGNATURE / AMOUNT / AUDIT",
      "ACCESS · DESIRED STATE / 3X-UI",
      "RECONCILE · ACTUAL / RETRY / RECOVERY",
    ],
  };
  const rabbitStageLabel = rabbitArchitecture.querySelector("[data-rabbit-stage-label]");
  const rabbitStageIndex = rabbitArchitecture.querySelector("[data-rabbit-stage-index]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let rabbitIndex = 0;
  let rabbitTimer;
  let rabbitVisible = false;

  const showRabbitStage = (index) => {
    rabbitArchitecture.classList.remove(...rabbitStages.map((stage) => `is-${stage}`));
    rabbitArchitecture.classList.add(`is-${rabbitStages[index]}`);
    const language = root.dataset.language === "en" ? "en" : "ru";
    if (rabbitStageLabel) rabbitStageLabel.textContent = rabbitLabels[language][index];
    if (rabbitStageIndex) rabbitStageIndex.textContent = `${String(index + 1).padStart(2, "0")} / 04`;
  };

  const scheduleRabbitStage = () => {
    window.clearTimeout(rabbitTimer);
    if (!rabbitVisible || document.hidden || reducedMotion) return;
    rabbitTimer = window.setTimeout(() => {
      rabbitIndex = (rabbitIndex + 1) % rabbitStages.length;
      showRabbitStage(rabbitIndex);
      scheduleRabbitStage();
    }, 4300);
  };

  showRabbitStage(0);
  if (!reducedMotion) {
    const rabbitVisibility = new IntersectionObserver(([entry]) => {
      rabbitVisible = entry.isIntersecting;
      window.clearTimeout(rabbitTimer);
      if (rabbitVisible && !document.hidden) scheduleRabbitStage();
    }, { threshold: .12 });
    rabbitVisibility.observe(rabbitArchitecture);
    document.addEventListener("visibilitychange", () => {
      window.clearTimeout(rabbitTimer);
      if (!document.hidden && rabbitVisible) scheduleRabbitStage();
    });
  }
}

const codeSources = new WeakMap();
const bashKeywords = new Set(["if", "then", "else", "elif", "fi", "for", "in", "do", "done", "case", "esac", "function"]);
const bashCommands = new Set(["set", "trap", "iptables", "ip", "head", "sleep", "test", "ping", "curl", "printf", "seq", "pki", "umask", "true", "false"]);
const pythonKeywords = new Set(["from", "import", "for", "in", "if", "not", "enumerate"]);
const goKeywords = new Set(["break", "case", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var"]);
const sqlKeywords = new Set(["and", "as", "by", "case", "delete", "else", "end", "from", "group", "having", "insert", "into", "is", "join", "not", "null", "on", "or", "order", "returning", "select", "set", "then", "update", "values", "when", "where"]);

const syntaxClass = (token, syntax) => {
  if (token.trimStart().startsWith("#") || token.trimStart().startsWith("!") || token.trimStart().startsWith("//") || token.trimStart().startsWith("--")) return "syntax-comment";
  if (/^f?["'`]/.test(token)) return "syntax-string";
  if (token.startsWith("$")) return "syntax-variable";
  if (/^\d+(?:\.\d+){3}(?:\/\d+)?$/.test(token)) return "syntax-address";
  if (/^\d+$/.test(token)) return "syntax-number";
  if (syntax === "bash" && bashKeywords.has(token)) return "syntax-keyword";
  if (syntax === "bash" && bashCommands.has(token)) return "syntax-command";
  if (syntax === "python" && pythonKeywords.has(token)) return "syntax-keyword";
  if (syntax === "go" && goKeywords.has(token)) return "syntax-keyword";
  if (syntax === "sql" && sqlKeywords.has(token.toLowerCase())) return "syntax-keyword";
  return "syntax-keyword";
};

const highlightCode = (code) => {
  const source = code.textContent;
  codeSources.set(code, source);
  const syntax = code.dataset.syntax;
  let expression;
  if (syntax === "bash") {
    expression = /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$\{?[A-Za-z_][A-Za-z0-9_]*(?:\[@\])?\}?|\b(?:if|then|else|elif|fi|for|in|do|done|case|esac|function|trap|true|false|set|iptables|ip|head|sleep|test|ping|curl|printf|seq|pki|umask)\b|\b\d+(?:\.\d+){3}(?:\/\d+)?\b|\b\d+\b)/gm;
  } else if (syntax === "python") {
    expression = /(#[^\n]*|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*'|\b(?:from|import|for|in|if|not|enumerate)\b|\b\d+\b)/gm;
  } else if (syntax === "go") {
    expression = /(\/\/[^\n]*|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:break|case|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b|\b\d+(?:\.\d+)?\b)/gm;
  } else if (syntax === "sql") {
    expression = /(--[^\n]*|'(?:''|[^'])*'|\$[A-Za-z_][A-Za-z0-9_]*|\b(?:and|as|by|case|delete|else|end|from|group|having|insert|into|is|join|not|null|on|or|order|returning|select|set|then|update|values|when|where)\b|\b\d+(?:\.\d+)?\b)/gim;
  } else {
    expression = /(^\s*!.*$|^\s*(?:ip|route-map|router|bgp|neighbor|address-family|network|set)\b|\b(?:permit|in|out|remote-as|prefix-list|route-map|local-preference|ipv4|unicast|bfd)\b|\b\d+(?:\.\d+){3}(?:\/\d+)?\b|\b\d+\b)/gm;
  }
  const fragment = document.createDocumentFragment();
  let offset = 0;
  for (const match of source.matchAll(expression)) {
    if (match.index > offset) fragment.append(document.createTextNode(source.slice(offset, match.index)));
    const span = document.createElement("span");
    span.className = syntaxClass(match[0], syntax);
    span.textContent = match[0];
    fragment.append(span);
    offset = match.index + match[0].length;
  }
  if (offset < source.length) fragment.append(document.createTextNode(source.slice(offset)));
  code.replaceChildren(fragment);
};

document.querySelectorAll("code[data-syntax]").forEach(highlightCode);

const writeClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some embedded browsers expose the API but deny it; use the local fallback below.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Clipboard copy failed");
};

document.querySelectorAll("[data-copy-code]").forEach((button) => {
  let resetTimer;
  button.addEventListener("click", async () => {
    const code = button.closest(".article-code")?.querySelector("code[data-syntax]");
    if (!code) return;
    try {
      await writeClipboard(codeSources.get(code) ?? code.textContent);
      button.classList.add("is-copied");
      button.setAttribute("aria-label", root.dataset.language === "en" ? "Code copied" : "Код скопирован");
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.classList.remove("is-copied");
        button.removeAttribute("aria-label");
      }, 1800);
    } catch {
      button.classList.add("is-copy-error");
      window.setTimeout(() => button.classList.remove("is-copy-error"), 1200);
    }
  });
});
