(() => {
  const SHIFT_DURATION = 90;
  const MAX_NICK_LENGTH = 15;
  const WRONG_ACTION_BASE_PENALTY = 70;
  const API_BASE = "/api/lab";
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

  const PROFILE_STORAGE_KEY = "haeniken-lab-profiles-v1";
  const SOUND_STORAGE_KEY = "haeniken-lab-sound-v1";
  const englishProfanityRoots = ["fuck", "fck", "fuk", "phuck", "shit", "bitch", "cunt", "dickhead", "cock", "pussy", "asshole", "arsehole", "motherf", "whore", "slut", "wanker", "bollock", "twat", "nigg", "fagg", "huy", "hui", "khuy", "pizd", "blyad", "blyat", "blya", "ebat", "yebat", "eban", "suka", "mudak", "pidor", "pidar", "gandon", "zalup", "shlyuh"];
  const russianProfanityRoots = ["хуй", "хуе", "хуё", "хуя", "хуи", "хуйн", "пизд", "бляд", "блят", "ебан", "ёбан", "ебат", "ёбат", "ебал", "ёбал", "ебет", "ебёт", "ебут", "ебуч", "ебл", "заеб", "заёб", "наеб", "наёб", "уеб", "уёб", "выеб", "выёб", "проеб", "проёб", "долбоеб", "долбоёб", "мудил", "мудозвон", "гандон", "гондон", "залуп", "шлюх", "пидор", "пидар", "сучк"];
  const language = document.documentElement.dataset.language === "en" ? "en" : "ru";
  const pick = (value) => value[language];
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const incidents = [
    {
      id: "traffic", action: "scale", target: "core", className: "incident-load", deadline: 14,
      title: { ru: "Рост задержки API", en: "API latency spike" },
      detail: { ru: "p95: 840 мс · CPU: 91% · очередь запросов растёт. Текущих реплик не хватает.", en: "p95: 840 ms · CPU: 91% · request queue is growing. Current replicas are insufficient." },
      status: { ru: "API перегружен · нажмите на ядро или выберите масштабирование", en: "API overloaded · tap the core or choose scaling" },
      resolved: { ru: "Добавлена реплика, p95 возвращается к норме", en: "Replica added; p95 is returning to normal" },
      telemetry: { load: 91, resources: 38, loadRate: .55, resourceRate: .45, critical: "load" },
      budgetLoss: 1.15, availabilityLoss: .0013, loadGrowth: 3.2, baseScore: 210
    },
    {
      id: "node", action: "drain", target: "node", className: "incident-node", deadline: 16, affectsNode: true,
      title: { ru: "Рабочий сервер недоступен", en: "Node stopped responding" },
      detail: { ru: "NodeNotReady · потеря пакетов 38% · kubelet не передаёт состояние. Нагрузку нужно вывести.", en: "NodeNotReady · 38% packet loss · kubelet is not reporting status. Workloads must be drained." },
      status: { ru: "Сервер вне связи · нажмите на подсвеченный узел", en: "Node unreachable · tap the highlighted node" },
      resolved: { ru: "Сервер изолирован, поды перенесены на исправный контур", en: "Node isolated; pods moved to the healthy pool" },
      telemetry: { load: 82, resources: 44, loadRate: .35, resourceRate: .55 },
      budgetLoss: 1.4, availabilityLoss: .0017, loadGrowth: 1.1, baseScore: 230
    },
    {
      id: "release", action: "rollback", target: "core", className: "incident-deploy", deadline: 13,
      title: { ru: "Ошибки после релиза", en: "Errors after deployment" },
      detail: { ru: "HTTP 5xx: 17% · версия api-2.14.7 развёрнута 2 минуты назад · ошибки растут на всех репликах.", en: "HTTP 5xx: 17% · api-2.14.7 was deployed 2 minutes ago · errors are rising across all replicas." },
      status: { ru: "Регрессия релиза · нажмите на ядро или выполните откат", en: "Release regression · tap the core or rollback" },
      resolved: { ru: "Возвращена предыдущая версия, доля 5xx снижается", en: "Previous version restored; 5xx rate is falling" },
      telemetry: { load: 68, resources: 56, loadRate: .3, resourceRate: .2 },
      budgetLoss: 1.75, availabilityLoss: .0022, loadGrowth: .7, baseScore: 250
    },
    {
      id: "disk", action: "cleanup", target: "node", className: "incident-storage", deadline: 16, affectsNode: true,
      title: { ru: "На сервере заканчивается место", en: "Server is running out of disk space" },
      detail: { ru: "/var: 94% · журналы выросли на 18 ГБ за час · запись новых событий скоро остановится.", en: "/var: 94% · logs grew by 18 GB in one hour · new events will soon stop being written." },
      status: { ru: "Диск заполнен на 94% · нажмите на подсвеченный узел", en: "Disk is 94% full · tap the highlighted node" },
      resolved: { ru: "Старые журналы удалены, ротация восстановлена", en: "Old logs removed; log rotation restored" },
      telemetry: { load: 49, resources: 6, loadRate: .15, resourceRate: .2, critical: "resources" },
      budgetLoss: 1.05, availabilityLoss: .0009, loadGrowth: .4, baseScore: 205
    },
    {
      id: "container", action: "restart", target: "pod", className: "incident-service", deadline: 13,
      title: { ru: "Контейнер не отвечает", en: "Container is not responding" },
      detail: { ru: "Проверка готовности: 5 ошибок подряд · процесс запущен, но соединения не принимает.", en: "Readiness check: 5 consecutive failures · process is running but accepts no connections." },
      status: { ru: "Одна реплика недоступна · нажмите на красный под", en: "One replica unavailable · tap the red pod" },
      resolved: { ru: "Контейнер перезапущен и снова принимает трафик", en: "Container restarted and is accepting traffic again" },
      telemetry: { load: 76, resources: 54, loadRate: .4, resourceRate: .35 },
      budgetLoss: 1.45, availabilityLoss: .0017, loadGrowth: 1.4, baseScore: 225
    },
    {
      id: "bruteforce", action: "block", target: "beacon", className: "incident-security", deadline: 15,
      title: { ru: "Обнаружен подбор паролей", en: "Brute-force attempt detected" },
      detail: { ru: "620 неудачных входов за 5 минут · один внешний адрес · число попыток продолжает расти.", en: "620 failed logins in 5 minutes · one external address · attempts continue to rise." },
      status: { ru: "Подозрительная активность · нажмите на внешний терминал", en: "Suspicious activity · tap the external terminal" },
      resolved: { ru: "Адрес заблокирован, новые попытки входа прекратились", en: "Source address blocked; login attempts stopped" },
      telemetry: { load: 64, resources: 62, loadRate: .45, resourceRate: .15 },
      budgetLoss: .9, availabilityLoss: .0006, loadGrowth: .8, baseScore: 220
    }
  ];

  const actionCosts = { scale: 10, drain: 7, rollback: 5, cleanup: 3, restart: 4, block: 2 };
  const actionLabels = {
    scale: { ru: "масштабирование", en: "scaling" }, drain: { ru: "изоляция сервера", en: "node drain" },
    rollback: { ru: "откат", en: "rollback" },
    cleanup: { ru: "очистка диска", en: "disk cleanup" }, restart: { ru: "перезапуск контейнера", en: "container restart" },
    block: { ru: "блокировка источника", en: "source block" }
  };
  const effectLabels = {
    scale: "+1 POD / READY", drain: "NODE / DRAINED", rollback: "RELEASE / ROLLED BACK",
    cleanup: "DISK / CLEAN", restart: "POD / RESTARTED", block: "SOURCE / BLOCKED"
  };
  const LEGENDARY_ACHIEVEMENT_ID = "orbit_legend";
  const coreAchievementIds = [
    "first_shift", "no_panic", "fast_reaction", "slo_keeper", "error_budget", "scale_up", "devsecops", "full_orbit",
    "clean_watch", "calm_operator", "resource_reserve", "incident_streak", "violet_protocol", "event_horizon", "zero_drift", "orbital_master", "absolute_control"
  ];
  const achievements = [
    { id: "first_shift", mark: "✓", title: { ru: "Первая смена", en: "First shift" }, detail: { ru: "Тренировка завершена", en: "Completed a training shift" }, test: () => true },
    { id: "no_panic", mark: "0", title: { ru: "Без паники", en: "No panic" }, detail: { ru: "Ни одного лишнего действия", en: "No unnecessary actions" }, test: (s) => s.stats.wrong === 0 && s.stats.correct >= 3 },
    { id: "fast_reaction", mark: "⚡", title: { ru: "Быстрая реакция", en: "Fast response" }, detail: { ru: "Сигнал устранён за 3 секунды", en: "Resolved an alert within 3 seconds" }, test: (s) => s.stats.fastest <= 3 },
    { id: "slo_keeper", mark: "S", title: { ru: "Хранитель SLO", en: "SLO keeper" }, detail: { ru: "Доступность не ниже 99,950%", en: "Availability stayed above 99.950%" }, test: (s) => s.availability >= 99.95 },
    { id: "error_budget", mark: "%", title: { ru: "Запас прочности", en: "Budget intact" }, detail: { ru: "Сохранено не менее 75% запаса", en: "At least 75% error budget remains" }, test: (s) => s.budget >= 75 },
    { id: "scale_up", mark: "+", title: { ru: "Горизонтальный рост", en: "Scale out" }, detail: { ru: "Кластер масштабирован дважды", en: "Scaled the cluster twice" }, test: (s) => s.stats.actionCounts.scale >= 2 },
    { id: "devsecops", mark: "D", title: { ru: "DevSecOps на посту", en: "DevSecOps on duty" }, detail: { ru: "Атака остановлена без лишних действий", en: "Blocked an attack without unnecessary actions" }, test: (s) => s.stats.resolvedIds.has("bruteforce") && s.stats.wrong === 0 },
    { id: "full_orbit", mark: "6", title: { ru: "Полная орбита", en: "Full orbit" }, detail: { ru: "Решены шесть разных сценариев", en: "Resolved six different scenarios" }, test: (s) => s.stats.resolvedIds.size >= 6 },
    { id: "clean_watch", mark: "≠", title: { ru: "Чистый журнал", en: "Clean log" }, detail: { ru: "Шесть решений без пропущенных сигналов", en: "Six resolutions without a missed alert" }, test: (s) => s.stats.correct >= 6 && s.stats.missed === 0 },
    { id: "calm_operator", mark: "5", title: { ru: "Холодный расчёт", en: "Cool operator" }, detail: { ru: "Шесть сигналов устранены не дольше чем за 5 секунд", en: "Six alerts resolved within 5 seconds each" }, test: (s) => s.stats.correct >= 6 && s.stats.slowest <= 5 },
    { id: "resource_reserve", mark: "R", title: { ru: "Резерв сохранён", en: "Reserve intact" }, detail: { ru: "После шести решений осталось не менее 65% ресурсов", en: "At least 65% resources remain after six resolutions" }, test: (s) => s.stats.correct >= 6 && s.resources >= 65 },
    { id: "incident_streak", mark: "8", title: { ru: "Серия из восьми", en: "Eight-alert streak" }, detail: { ru: "Устранено восемь сигналов за одну смену", en: "Resolved eight alerts in one shift" }, test: (s) => s.stats.correct >= 8 },
    { id: "violet_protocol", mark: "◆", rare: true, title: { ru: "Фиолетовый протокол", en: "Violet protocol" }, detail: { ru: "Десять сигналов, все шесть типов, без ошибок и не дольше 2 секунд каждый", en: "Ten alerts, all six types, no errors and no response over 2 seconds" }, test: (s) => s.stats.correct >= 10 && s.stats.resolvedIds.size >= 6 && s.stats.wrong === 0 && s.stats.missed === 0 && s.stats.slowest <= 2 },
    { id: "event_horizon", mark: "◉", rare: true, title: { ru: "Горизонт событий", en: "Event horizon" }, detail: { ru: "4000 очков и не менее десяти решений без ошибок и пропусков", en: "4000 points and at least ten resolutions with no errors or misses" }, test: (s) => s.score >= 4000 && s.stats.correct >= 10 && s.stats.wrong === 0 && s.stats.missed === 0 },
    { id: "zero_drift", mark: "∅", rare: true, title: { ru: "Нулевой дрейф", en: "Zero drift" }, detail: { ru: "Десять быстрых решений, доступность 99,985% и запас не ниже 95%", en: "Ten fast resolutions, 99.985% availability and at least 95% budget" }, test: (s) => s.stats.correct >= 10 && s.stats.wrong === 0 && s.stats.missed === 0 && s.stats.slowest <= 2 && s.availability >= 99.985 && s.budget >= 95 },
    { id: "orbital_master", mark: "Ω", rare: true, title: { ru: "Мастер орбиты", en: "Orbital master" }, detail: { ru: "Двенадцать решений, все типы сигналов и ни одной ошибки", en: "Twelve resolutions, every alert type and no mistakes" }, test: (s) => s.stats.correct >= 12 && s.stats.resolvedIds.size >= 6 && s.stats.wrong === 0 && s.stats.missed === 0 },
    { id: "absolute_control", mark: "Ψ", rare: true, title: { ru: "Абсолютный контроль", en: "Absolute control" }, detail: { ru: "4700 очков, двенадцать решений и реакция не дольше 1 секунды при идеальных показателях", en: "4700 points, twelve resolutions and every response within 1 second with pristine metrics" }, test: (s) => s.score >= 4700 && s.stats.correct >= 12 && s.stats.resolvedIds.size >= 6 && s.stats.wrong === 0 && s.stats.missed === 0 && s.stats.slowest <= 1 && s.availability >= 99.985 && s.budget >= 95 },
    { id: LEGENDARY_ACHIEVEMENT_ID, mark: "★", legendary: true, hidden: true, title: { ru: "Легенда орбиты", en: "Legend of the orbit" }, detail: { ru: "Получены все семнадцать основных ачивок", en: "All seventeen core achievements unlocked" }, test: () => false }
  ];
  const achievementsById = new Map(achievements.map((achievement) => [achievement.id, achievement]));
  const leaderboardWorlds = [
    { id: "sun", name: { ru: "Солнце", en: "Sun" }, detail: { ru: "Раскалённая плазма, свет и центр тяготения всей системы. Сесилия Пейн-Гапошкина знала, из чего сделан этот свет.", en: "Incandescent plasma, light and the gravitational center of the system. Cecilia Payne-Gaposchkin knew what that light was made of." } },
    { id: "mercury", name: { ru: "Меркурий", en: "Mercury" }, detail: { ru: "Обожжённый кратерами мир с почти исчезнувшей атмосферой. Небесная механика Джузеппе Коломбо вернула сюда Mariner 10 трижды.", en: "A cratered, sun-scorched world with almost no atmosphere. Giuseppe Colombo’s celestial mechanics brought Mariner 10 past it three times." } },
    { id: "venus", name: { ru: "Венера", en: "Venus" }, detail: { ru: "Яркая снаружи, невыносимо жаркая под облаками серной кислоты. Та самая атмосфера, которую заметил Михаил Ломоносов.", en: "Bright from afar, unbearably hot beneath sulfuric-acid clouds: the very atmosphere Mikhail Lomonosov noticed." } },
    { id: "earth", name: { ru: "Земля", en: "Earth" }, detail: { ru: "Голубая точка с жидкой водой и единственной известной жизнью. Отсюда прозвучало гагаринское «Поехали!».", en: "A blue world with liquid water and the only life known to us. This is where Yuri Gagarin’s “Poyekhali!” began." } },
    { id: "mars", name: { ru: "Марс", en: "Mars" }, detail: { ru: "Красная пыль, полярный лёд и древние русла. Тот самый новый адрес человечества, о котором говорит Илон Маск.", en: "Red dust, polar ice and ancient channels: the new address for humanity that Elon Musk keeps talking about." } },
    { id: "jupiter", name: { ru: "Юпитер", en: "Jupiter" }, detail: { ru: "Газовый исполин с вечным штормом и целой свитой спутников. Четыре яркие точки рядом с ним прославили Галилео Галилея.", en: "A gas giant with an enduring storm and a vast retinue of moons. Four bright points beside it made Galileo Galilei famous." } },
    { id: "saturn", name: { ru: "Сатурн", en: "Saturn" }, detail: { ru: "Лёд, пыль и камень собраны вокруг гиганта в тонкие кольца — загадку, которую разгадал Христиан Гюйгенс.", en: "Ice, dust and rock form delicate rings around this giant: the puzzle Christiaan Huygens solved." } },
    { id: "uranus", name: { ru: "Уран", en: "Uranus" }, detail: { ru: "Холодный голубой гигант вращается почти лёжа. Уильям Гершель сперва решил, что нашёл комету.", en: "A cold cyan giant rotating almost on its side. William Herschel first thought he had found a comet." } },
    { id: "neptune", name: { ru: "Нептун", en: "Neptune" }, detail: { ru: "Дальний синий мир сверхзвуковых ветров, который Урбен Леверье сначала нашёл на бумаге.", en: "A distant blue world of supersonic winds, first found on paper by Urbain Le Verrier." } },
    { id: "pluto", name: { ru: "Плутон", en: "Pluto" }, detail: { ru: "Ледяной карликовый мир с огромным светлым сердцем — областью, которая носит имя Клайда Томбо.", en: "An icy dwarf world with a vast bright heart: a region bearing Clyde Tombaugh’s name." } }
  ];

  const elements = {
    start: document.querySelector("[data-start]"), reset: document.querySelector("[data-reset]"), soundToggle: document.querySelector("[data-sound-toggle]"), soundState: document.querySelector("[data-sound-state]"),
    time: document.querySelector("[data-time]"), score: document.querySelector("[data-score]"),
    availability: document.querySelector("[data-availability]"), availabilityBar: document.querySelector("[data-availability-bar]"),
    budget: document.querySelector("[data-budget]"), budgetBar: document.querySelector("[data-budget-bar]"),
    load: document.querySelector("[data-load]"), resources: document.querySelector("[data-resources]"),
    incident: document.querySelector("[data-incident]"), incidentTitle: document.querySelector("[data-incident-title]"),
    incidentDetail: document.querySelector("[data-incident-detail]"), space: document.querySelector("[data-space]"),
    spaceStatus: document.querySelector("[data-space-status]"), problemHint: document.querySelector("[data-problem-hint]"),
    pods: document.querySelector("[data-pods]"), streams: document.querySelector("[data-streams]"), core: document.querySelector("[data-core]"),
    nodeStreams: Array.from(document.querySelectorAll("[data-node-stream]")),
    beacon: document.querySelector("[data-beacon]"), terminalStatus: document.querySelector("[data-terminal-status]"), attackLink: document.querySelector("[data-attack-link]"), clusterEvent: document.querySelector("[data-cluster-event]"),
    radialMenu: document.querySelector("[data-radial-menu]"), radialClose: document.querySelector("[data-radial-close]"),
    radialActions: Array.from(document.querySelectorAll("[data-radial-action]")),
    log: document.querySelector("[data-log]"), nodes: Array.from(document.querySelectorAll("[data-node]")),
    actions: Array.from(document.querySelectorAll("[data-action]")), year: document.querySelector("[data-year]"),
    results: document.querySelector("[data-results]"), resultDialog: document.querySelector(".result-dialog"),
    resultClose: document.querySelector("[data-result-close]"), resultTitle: document.querySelector("[data-result-title]"),
    resultScore: document.querySelector("[data-result-score]"), achievementList: document.querySelector("[data-achievements]"),
    scoreForm: document.querySelector("[data-score-form]"), nickInput: document.querySelector("#player-nick"), saveStatus: document.querySelector("[data-save-status]"),
    leaderboard: document.querySelector("[data-leaderboard]"), leaderboardStatus: document.querySelector("[data-leaderboard-status]")
  };

  let timer;
  let effectTimer;
  let incidentBag = [];
  let menuIncidentId = "";
  let achievementPopover;
  let activeAchievementTrigger;
  let achievementHideTimer;
  let achievementPopoverPinned = false;
  let worldPopover;
  let activeWorldTrigger;
  let worldHideTimer;
  let worldPopoverPinned = false;
  let idleTelemetryTimer;
  const idleTelemetry = { load: 36, resources: 72 };
  let cachedLeaderboardEntries = [];
  let state;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext;
  let audioOutput;
  let audioNoiseBuffer;
  let soundEnabled = true;
  try {
    soundEnabled = window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    soundEnabled = true;
  }

  function updateSoundControl() {
    if (!elements.soundToggle) return;
    if (!AudioContextClass) {
      elements.soundToggle.disabled = true;
      elements.soundToggle.setAttribute("aria-pressed", "false");
      elements.soundToggle.setAttribute("aria-label", pick({ ru: "Звук: Нет. Звук недоступен", en: "Sound: N/A. Sound unavailable" }));
      elements.soundState.textContent = pick({ ru: "Нет", en: "N/A" });
      return;
    }
    elements.soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    elements.soundToggle.setAttribute("aria-label", soundEnabled
      ? pick({ ru: "Звук: Вкл. Отключить звук", en: "Sound: On. Mute sound" })
      : pick({ ru: "Звук: Выкл. Включить звук", en: "Sound: Off. Enable sound" }));
    elements.soundState.textContent = soundEnabled ? pick({ ru: "Вкл.", en: "On" }) : pick({ ru: "Выкл.", en: "Off" });
  }

  function ensureAudio() {
    if (!soundEnabled || !AudioContextClass) return undefined;
    if (!audioContext) {
      audioContext = new AudioContextClass();
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = .004;
      compressor.release.value = .18;
      audioOutput = audioContext.createGain();
      audioOutput.gain.value = .24;
      audioOutput.connect(compressor);
      compressor.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function soundTone(frequency, duration = .08, type = "sine", volume = .1, delay = 0, slideTo = frequency) {
    const context = ensureAudio();
    if (!context || !audioOutput) return;
    const start = context.currentTime + Math.max(0, delay);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + duration);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.001, volume), start + Math.min(.014, duration * .25));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(audioOutput);
    oscillator.start(start);
    oscillator.stop(start + duration + .025);
  }

  function soundNoise(duration = .1, volume = .04, delay = 0, frequency = 1200) {
    const context = ensureAudio();
    if (!context || !audioOutput) return;
    if (!audioNoiseBuffer) {
      const length = Math.ceil(context.sampleRate * .55);
      audioNoiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = audioNoiseBuffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) samples[index] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + Math.max(0, delay);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = audioNoiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 2.2;
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.001, volume), start + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(audioOutput);
    source.start(start, Math.random() * .3, duration);
    source.stop(start + duration + .02);
  }

  function playSound(name, detail) {
    if (!soundEnabled || document.hidden) return;
    switch (name) {
      case "timer": {
        const seconds = Number(detail);
        if (seconds <= 0) return;
        if (seconds <= 10) {
          const urgentFrequency = 520 + (10 - seconds) * 26;
          soundTone(urgentFrequency, seconds <= 3 ? .075 : .045, "square", seconds <= 3 ? .075 : .045);
          if (seconds <= 3) soundTone(urgentFrequency * 1.5, .035, "sine", .045, .08);
        } else {
          const accent = seconds % 10 === 0;
          soundTone(accent ? 540 : 390, accent ? .035 : .018, "square", accent ? .035 : .016);
        }
        break;
      }
      case "alert":
        soundTone(760, .11, "square", .09, 0, 520);
        soundTone(680, .1, "square", .075, .17, 470);
        soundNoise(.13, .035, .02, 2100);
        break;
      case "action": {
        const action = detail;
        if (action === "scale") {
          soundTone(330, .07, "sine", .075);
          soundTone(510, .08, "sine", .075, .055);
          soundTone(720, .1, "triangle", .07, .12);
        } else if (action === "drain") {
          soundTone(560, .2, "triangle", .08, 0, 240);
          soundNoise(.12, .03, .06, 520);
        } else if (action === "rollback") {
          soundTone(820, .08, "square", .055);
          soundTone(610, .08, "square", .06, .065);
          soundTone(410, .13, "triangle", .075, .13, 360);
        } else if (action === "cleanup") {
          soundNoise(.19, .055, 0, 2600);
          soundTone(1250, .09, "sine", .06, .08, 820);
        } else if (action === "restart") {
          soundTone(230, .13, "sawtooth", .065, 0, 110);
          soundTone(430, .08, "square", .055, .14);
          soundTone(760, .12, "sine", .075, .22, 920);
        } else if (action === "block") {
          soundTone(980, .055, "square", .065);
          soundTone(650, .055, "square", .065, .06);
          soundTone(330, .1, "square", .075, .12, 210);
        }
        break;
      }
      case "success":
        soundTone(620, .1, "sine", .085, .035);
        soundTone(880, .13, "triangle", .09, .11);
        soundTone(1170, .12, "sine", .07, .2);
        break;
      case "error":
        soundTone(230, .18, "sawtooth", .085, .025, 110);
        soundTone(118, .12, "square", .06, .14, 84);
        soundNoise(.12, .045, .03, 430);
        break;
      case "miss":
        soundTone(420, .24, "square", .08, 0, 130);
        soundTone(145, .18, "sawtooth", .065, .16, 70);
        soundNoise(.2, .045, .05, 360);
        break;
      case "menu":
        soundTone(720, .035, "sine", .04);
        soundTone(1040, .045, "sine", .045, .045);
        break;
      case "start":
        soundTone(180, .3, "sine", .08, 0, 360);
        soundTone(430, .22, "triangle", .075, .08, 650);
        soundTone(760, .22, "sine", .075, .2, 980);
        soundNoise(.25, .03, .02, 900);
        break;
      case "reset":
        soundTone(560, .18, "triangle", .07, 0, 250);
        soundNoise(.1, .028, .05, 1100);
        break;
      case "finish-success":
        soundTone(420, .3, "sine", .08);
        soundTone(630, .3, "sine", .075, .09);
        soundTone(840, .34, "triangle", .085, .18);
        soundTone(1120, .24, "sine", .06, .34);
        break;
      case "finish-error":
        soundTone(430, .25, "triangle", .075, 0, 260);
        soundTone(230, .3, "sawtooth", .06, .15, 90);
        break;
      case "save":
        soundTone(760, .09, "sine", .07);
        soundTone(1120, .15, "sine", .075, .1);
        break;
      case "enabled":
        soundTone(540, .08, "sine", .07);
        soundTone(880, .12, "sine", .075, .08);
        break;
      default:
        break;
    }
  }

  function toggleSound() {
    if (!AudioContextClass) return;
    soundEnabled = !soundEnabled;
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? "on" : "off");
    } catch {
      // The sound preference remains active for the current page when storage is unavailable.
    }
    if (soundEnabled) {
      ensureAudio();
      if (audioContext && audioOutput) {
        audioOutput.gain.cancelScheduledValues(audioContext.currentTime);
        audioOutput.gain.setTargetAtTime(.24, audioContext.currentTime, .018);
      }
      playSound("enabled");
    } else if (audioContext && audioOutput) {
      audioOutput.gain.cancelScheduledValues(audioContext.currentTime);
      audioOutput.gain.setTargetAtTime(.0001, audioContext.currentTime, .018);
    }
    updateSoundControl();
  }

  function initialState() {
    return {
      running: false, ended: false, time: SHIFT_DURATION, score: 0, availability: 99.990,
      budget: 100, load: 36, resources: 72, replicas: 3, incident: null, incidentAge: 0,
      nextIncident: 3, affectedNode: -1, affectedPod: -1, drainedNode: -1, incidentMistakes: 0, entries: [],
      sessionId: "", saved: false, unlocked: [], sessionAchievements: [],
      stats: { correct: 0, wrong: 0, missed: 0, fastest: Infinity, slowest: 0, actionCounts: { scale: 0, drain: 0, rollback: 0, cleanup: 0, restart: 0, block: 0 }, resolvedIds: new Set() }
    };
  }

  function formatClock(seconds) {
    return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  function formatScore(value) {
    const score = Math.round(value);
    return score < 0 ? `-${Math.abs(score).toString().padStart(3, "0")}` : score.toString().padStart(4, "0");
  }

  function normalizedNickForms(value) {
    const englishMap = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "а": "a", "б": "b", "в": "b", "г": "g", "д": "d", "е": "e", "з": "z", "и": "i", "і": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "p", "с": "c", "т": "t", "у": "u", "х": "x" };
    const russianMap = { "0": "о", "1": "и", "3": "з", "4": "ч", "5": "с", "6": "б", "a": "а", "b": "в", "c": "с", "e": "е", "h": "н", "i": "и", "k": "к", "m": "м", "o": "о", "p": "р", "t": "т", "x": "х", "y": "у" };
    const compact = Array.from(value.toLocaleLowerCase().normalize("NFKC")).filter((character) => /[\p{L}\p{N}]/u.test(character));
    const collapse = (characters) => characters.filter((character, index) => index === 0 || character !== characters[index - 1]).join("");
    return {
      english: collapse(compact.map((character) => englishMap[character] || character)),
      russian: collapse(compact.map((character) => russianMap[character] || character))
    };
  }

  function nickContainsProfanity(value) {
    const forms = normalizedNickForms(value);
    return englishProfanityRoots.some((root) => forms.english.includes(root)) || russianProfanityRoots.some((root) => forms.russian.includes(root));
  }

  function normalizeNickInput(value) {
    return String(value || "").trim().replace(/\s+/gu, " ");
  }

  function validateNickInput() {
    const nick = normalizeNickInput(elements.nickInput.value);
    const length = Array.from(nick).length;
    const blocked = nickContainsProfanity(nick);
    const invalidLength = length < 2 || length > MAX_NICK_LENGTH;
    elements.nickInput.setCustomValidity(blocked
      ? pick({ ru: "Выберите другой ник: обнаружено недопустимое слово.", en: "Choose another nickname: a prohibited word was detected." })
      : invalidLength
        ? pick({ ru: "Ник должен содержать от 2 до 15 знаков.", en: "Nickname must be between 2 and 15 characters." })
        : "");
    return !blocked && !invalidLength;
  }

  function readAchievementProfiles() {
    try {
      const value = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
      if (!value || !Array.isArray(value.profiles)) return { lastNick: "", profiles: [] };
      return {
        lastNick: typeof value.lastNick === "string" ? value.lastNick : "",
        profiles: value.profiles.filter((profile) => profile && typeof profile.nick === "string" && Array.isArray(profile.achievements))
      };
    } catch {
      return { lastNick: "", profiles: [] };
    }
  }

  function knownAchievementsForNick(nick) {
    const normalizedNick = String(nick || "").trim().toLocaleLowerCase();
    if (!normalizedNick) return new Set();
    const known = new Set();
    const localProfile = readAchievementProfiles().profiles.find((profile) => profile.nick.toLocaleLowerCase() === normalizedNick);
    const publicProfile = cachedLeaderboardEntries.find((entry) => String(entry.nick || "").toLocaleLowerCase() === normalizedNick);
    [localProfile?.achievements, publicProfile?.achievements].forEach((values) => {
      if (Array.isArray(values)) values.forEach((id) => { if (achievementsById.has(id)) known.add(id); });
    });
    return known;
  }

  function rememberAchievementProfile(nick, achievementIds) {
    try {
      const data = readAchievementProfiles();
      const normalizedNick = nick.toLocaleLowerCase();
      const existing = data.profiles.find((profile) => profile.nick.toLocaleLowerCase() === normalizedNick);
      const merged = new Set(Array.isArray(existing?.achievements) ? existing.achievements : []);
      achievementIds.forEach((id) => { if (achievementsById.has(id)) merged.add(id); });
      const profile = { nick, achievements: Array.from(merged) };
      data.lastNick = nick;
      data.profiles = [profile, ...data.profiles.filter((candidate) => candidate.nick.toLocaleLowerCase() !== normalizedNick)].slice(0, 12);
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // The shared leaderboard remains the source of truth when local storage is unavailable.
    }
  }

  function refreshNewAchievementsForNick(nick) {
    if (!state.ended || state.saved) return;
    const known = knownAchievementsForNick(nick);
    state.sessionAchievements = unlockedAchievements(known);
    state.unlocked = state.sessionAchievements.filter((achievement) => !known.has(achievement.id));
    renderAchievements();
  }

  function addLog(message, type = "") {
    state.entries.unshift({ time: formatClock(state.time), message, type });
    state.entries = state.entries.slice(0, 6);
  }

  function renderLog() {
    elements.log.replaceChildren();
    state.entries.forEach((entry) => {
      const item = document.createElement("li");
      if (entry.type) item.className = `is-${entry.type}`;
      const time = document.createElement("time");
      time.textContent = entry.time;
      const message = document.createElement("span");
      message.textContent = entry.message;
      item.append(time, message);
      elements.log.append(item);
    });
  }

  function renderPods() {
    const count = clamp(state.replicas, 2, 8);
    if (elements.pods.childElementCount !== count || elements.streams.childElementCount !== count) {
      const podFragment = document.createDocumentFragment();
      const streamFragment = document.createDocumentFragment();
      for (let index = 0; index < count; index += 1) {
        const angle = `${Math.round(index * (360 / count))}deg`;
        const radius = index % 2 === 0 ? "clamp(90px, 22vw, 205px)" : "clamp(70px, 16vw, 150px)";
        const speed = `${10 + (index % 4) * 2.3}s`;
        const pod = document.createElement("button");
        pod.type = "button";
        pod.className = "pod";
        pod.dataset.pod = index;
        pod.tabIndex = -1;
        pod.setAttribute("aria-label", `${pick({ ru: "Под", en: "Pod" })} ${index + 1}`);
        pod.style.setProperty("--angle", angle);
        pod.style.setProperty("--radius", radius);
        pod.style.setProperty("--speed", speed);
        const stream = document.createElement("span");
        stream.className = "pod-stream";
        stream.style.setProperty("--angle", angle);
        stream.style.setProperty("--radius", radius);
        stream.style.setProperty("--speed", speed);
        for (let packetIndex = 0; packetIndex < 2; packetIndex += 1) {
          const packet = document.createElement("i");
          packet.style.setProperty("--packet-delay", `${-packetIndex * 1.05 - index * .21}s`);
          stream.append(packet);
        }
        podFragment.append(pod);
        streamFragment.append(stream);
      }
      elements.pods.replaceChildren(podFragment);
      elements.streams.replaceChildren(streamFragment);
    }
  }

  function setInteractive(element, active, label) {
    element.classList.toggle("is-problem", active);
    element.tabIndex = active ? 0 : -1;
    element.setAttribute("aria-disabled", active ? "false" : "true");
    if (active && label) element.setAttribute("aria-description", label);
    else element.removeAttribute("aria-description");
  }

  function resyncPodConnection(index) {
    if (index < 0) return;
    const pod = elements.pods.children[index];
    const stream = elements.streams.children[index];
    if (!pod || !stream) return;
    pod.classList.add("is-resyncing");
    stream.classList.add("is-resyncing");
    void pod.offsetWidth;
    pod.classList.remove("is-resyncing");
    stream.classList.remove("is-resyncing");
  }

  function renderProblemTargets() {
    const incident = state.incident;
    const active = Boolean(incident && state.running);
    setInteractive(elements.core, active && incident.target === "core", active ? pick(incident.title) : "");
    elements.nodes.forEach((node, index) => {
      setInteractive(node, active && incident.target === "node" && state.affectedNode === index, active ? pick(incident.title) : "");
    });
    Array.from(elements.pods.children).forEach((pod, index) => {
      setInteractive(pod, active && incident.target === "pod" && state.affectedPod === index, active ? pick(incident.title) : "");
    });
    Array.from(elements.streams.children).forEach((stream, index) => {
      stream.classList.toggle("is-alert", active && incident.target === "pod" && state.affectedPod === index);
    });
    setInteractive(elements.beacon, active && incident.target === "beacon", active ? pick(incident.title) : "");
    if (active && incident.target === "beacon") window.requestAnimationFrame(positionAttackLink);
    elements.problemHint.hidden = !active;
  }

  function positionAttackLink() {
    if (state.incident?.target !== "beacon") return;
    const panelRect = elements.space.getBoundingClientRect();
    const sourceRect = elements.beacon.getBoundingClientRect();
    const targetRect = elements.core.getBoundingClientRect();
    if (!sourceRect.width || !targetRect.width) return;
    const sourceX = sourceRect.left + sourceRect.width / 2 - panelRect.left;
    const sourceY = sourceRect.top + sourceRect.height / 2 - panelRect.top;
    const targetX = targetRect.left + targetRect.width / 2 - panelRect.left;
    const targetY = targetRect.top + targetRect.height / 2 - panelRect.top;
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    elements.attackLink.style.left = `${sourceX}px`;
    elements.attackLink.style.top = `${sourceY}px`;
    elements.attackLink.style.width = `${Math.hypot(deltaX, deltaY)}px`;
    elements.attackLink.style.transform = `rotate(${Math.atan2(deltaY, deltaX)}rad)`;
  }

  function renderNodes() {
    elements.nodes.forEach((node, index) => {
      const failed = state.incident?.affectsNode === true && state.affectedNode === index;
      node.classList.toggle("is-failed", failed);
      node.classList.toggle("is-drained", state.drainedNode === index);
      elements.nodeStreams[index].classList.toggle("is-alert", failed);
      elements.nodeStreams[index].classList.toggle("is-muted", state.drainedNode === index);
      const status = node.querySelector("small");
      if (failed) status.textContent = state.incident.id === "disk" ? "DISK 94%" : "ALERT";
      else if (state.drainedNode === index) status.textContent = "DRAIN";
      else status.textContent = "READY";
    });
  }

  function renderIncident() {
    const active = Boolean(state.incident);
    elements.incident.classList.toggle("is-active", active);
    elements.space.classList.toggle("has-incident", active);
    elements.space.classList.remove("incident-load", "incident-node", "incident-deploy", "incident-storage", "incident-service", "incident-security");
    if (active) {
      elements.space.classList.add(state.incident.className);
      elements.incidentTitle.textContent = pick(state.incident.title);
      elements.incidentDetail.textContent = pick(state.incident.detail);
      elements.spaceStatus.textContent = pick(state.incident.status);
      elements.core.querySelector("small").textContent = "API / DEGRADED";
      return;
    }
    if (state.ended) return;
    elements.core.querySelector("small").textContent = state.running ? "API / OK" : "CONTROL PLANE";
    elements.incidentTitle.textContent = pick({ ru: "Сигналов нет", en: "No active alerts" });
    elements.incidentDetail.textContent = state.running
      ? pick({ ru: "Метрики в пределах рабочих порогов. Продолжайте наблюдение.", en: "Metrics are within operating thresholds. Keep watching." })
      : pick({ ru: "Запустите смену, чтобы начать тренировку.", en: "Start the shift to begin the exercise." });
    elements.spaceStatus.textContent = state.running
      ? pick({ ru: "Кластер работает штатно · наблюдение", en: "Cluster healthy · monitoring" })
      : pick({ ru: "Кластер ожидает начала смены", en: "Cluster is waiting for the shift" });
  }

  function render() {
    elements.space.classList.toggle("is-running", state.running);
    elements.time.textContent = state.time;
    elements.score.textContent = formatScore(state.score);
    elements.availability.textContent = `${state.availability.toFixed(3)}%`;
    elements.budget.textContent = `${Math.round(state.budget)}%`;
    const incidentTelemetry = state.incident?.telemetry;
    const displayedLoad = !state.running && !state.ended
      ? idleTelemetry.load
      : incidentTelemetry
        ? Math.max(state.load, incidentTelemetry.load + state.incidentAge * incidentTelemetry.loadRate)
        : state.load;
    const displayedResources = !state.running && !state.ended
      ? idleTelemetry.resources
      : incidentTelemetry
        ? Math.min(state.resources, incidentTelemetry.resources - state.incidentAge * incidentTelemetry.resourceRate)
        : state.resources;
    elements.load.textContent = `${Math.round(displayedLoad)}%`;
    elements.resources.textContent = `${Math.round(displayedResources)}%`;
    const loadCard = elements.load.closest(".telemetry-card");
    const resourcesCard = elements.resources.closest(".telemetry-card");
    const loadCritical = incidentTelemetry?.critical === "load" || displayedLoad >= 88;
    const resourcesCritical = incidentTelemetry?.critical === "resources" || displayedResources <= 12;
    loadCard.classList.toggle("is-critical", loadCritical);
    loadCard.classList.toggle("is-warning", !loadCritical && displayedLoad >= 75);
    resourcesCard.classList.toggle("is-critical", resourcesCritical);
    resourcesCard.classList.toggle("is-warning", !resourcesCritical && displayedResources <= 35);
    const availabilityWidth = clamp(((state.availability - 99.85) / .15) * 100, 0, 100);
    elements.availabilityBar.style.transform = `scaleX(${availabilityWidth / 100})`;
    elements.budgetBar.style.transform = `scaleX(${clamp(state.budget, 0, 100) / 100})`;
    elements.availabilityBar.style.background = availabilityWidth < 35 ? "#ff5d58" : "#73d5da";
    elements.budgetBar.style.background = state.budget < 30 ? "#ff5d58" : "#73d5da";
    elements.start.disabled = state.running;
    elements.actions.forEach((button) => { button.disabled = !state.running || state.resources < actionCosts[button.dataset.action]; });
    elements.radialActions.forEach((button) => { button.disabled = !state.running || state.resources < actionCosts[button.dataset.radialAction]; });
    renderIncident();
    renderNodes();
    renderPods();
    renderProblemTargets();
    renderLog();
  }

  function animateIdleMetric(element, value) {
    element.textContent = `${Math.round(value)}%`;
    const card = element.closest(".telemetry-card");
    card.classList.add("is-ambient-update");
    window.setTimeout(() => card.classList.remove("is-ambient-update"), 850);
  }

  function updateIdleTelemetry() {
    if (!state.running && !state.ended && !document.hidden) {
      const loadStep = Math.floor(Math.random() * 7) - 3;
      const resourceStep = Math.floor(Math.random() * 5) - 2;
      idleTelemetry.load = clamp(idleTelemetry.load + (loadStep || 1), 29, 44);
      idleTelemetry.resources = clamp(idleTelemetry.resources + (resourceStep || -1), 66, 79);
      animateIdleMetric(elements.load, idleTelemetry.load);
      animateIdleMetric(elements.resources, idleTelemetry.resources);
    }
    window.clearTimeout(idleTelemetryTimer);
    idleTelemetryTimer = window.setTimeout(updateIdleTelemetry, 2400 + Math.random() * 2600);
  }

  function shuffledIncidents() {
    const bag = incidents.slice();
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [bag[index], bag[swap]] = [bag[swap], bag[index]];
    }
    return bag;
  }

  function spawnIncident() {
    closeResponseMenu();
    if (incidentBag.length === 0) incidentBag = shuffledIncidents();
    state.incident = incidentBag.pop();
    state.incidentAge = 0;
    state.incidentMistakes = 0;
    state.affectedNode = state.incident.affectsNode ? Math.floor(Math.random() * elements.nodes.length) : -1;
    state.affectedPod = state.incident.target === "pod" ? Math.floor(Math.random() * state.replicas) : -1;
    elements.terminalStatus.textContent = "BRUTE / EXT";
    addLog(`${pick({ ru: "СИГНАЛ", en: "ALERT" })}: ${pick(state.incident.title)}`, "warning");
    playSound("alert");
  }

  function clearIncident() {
    closeResponseMenu();
    state.incident = null;
    state.incidentAge = 0;
    state.incidentMistakes = 0;
    state.affectedNode = -1;
    state.affectedPod = -1;
    state.nextIncident = 5 + Math.floor(Math.random() * 4);
  }

  function missIncident() {
    const incident = state.incident;
    state.score -= 90;
    state.budget = clamp(state.budget - 8, 0, 100);
    state.availability = clamp(state.availability - .008, 99.8, 100);
    state.load = clamp(state.load + 8, 20, 100);
    state.stats.missed += 1;
    addLog(`${pick({ ru: "Порог нарушен", en: "Threshold breached" })}: ${pick(incident.title)}`, "warning");
    playSound("miss");
    clearIncident();
  }

  function tick() {
    if (!state.running) return;
    state.time = Math.max(0, state.time - 1);
    if (state.time > 0) playSound("timer", state.time);
    if (state.incident) {
      state.incidentAge += 1;
      state.budget = clamp(state.budget - state.incident.budgetLoss, 0, 100);
      state.availability = clamp(state.availability - state.incident.availabilityLoss, 99.8, 100);
      state.load = clamp(state.load + state.incident.loadGrowth, 18, 100);
      if (state.incidentAge >= state.incident.deadline) missIncident();
    } else {
      state.nextIncident -= 1;
      state.resources = clamp(state.resources + .7, 0, 100);
      state.load += (36 - state.load) * .12;
      if (state.nextIncident <= 0 && state.time > 2) spawnIncident();
    }
    if (state.time <= 0) finishShift();
    else render();
  }

  function flashAction(button, className) {
    button.classList.remove("is-success", "is-error");
    button.classList.add(className);
    window.setTimeout(() => button.classList.remove(className), 650);
  }

  function triggerVisualEffect(action, outcome, target = null) {
    window.clearTimeout(effectTimer);
    const successful = outcome === "success";
    const connectionIndex = action === "scale"
      ? elements.pods.childElementCount - 1
      : target?.type === "pod" ? target.index : -1;
    elements.nodes.forEach((node) => {
      node.classList.remove("is-cleaning");
    });
    Array.from(elements.pods.children).forEach((pod) => {
      pod.classList.remove("is-restarting", "is-scaling-in");
    });
    Array.from(elements.streams.children).forEach((stream) => {
      stream.classList.remove("is-provisioning", "is-restarting");
    });
    elements.space.classList.remove("effect-scale", "effect-drain", "effect-rollback", "effect-cleanup", "effect-restart", "effect-block", "effect-success", "effect-error");
    void elements.space.offsetWidth;
    elements.space.classList.add(successful ? "effect-success" : "effect-error");
    if (successful) {
      elements.space.classList.add(`effect-${action}`);
      if (action === "scale") {
        elements.pods.lastElementChild?.classList.add("is-scaling-in");
        elements.streams.lastElementChild?.classList.add("is-provisioning");
      }
      if (action === "cleanup" && target?.type === "node") {
        const cleanupNode = elements.nodes[target.index];
        cleanupNode?.classList.add("is-cleaning");
        if (cleanupNode) cleanupNode.querySelector("small").textContent = "LOG / PURGE";
      }
      if (action === "restart" && target?.type === "pod") {
        elements.pods.children[target.index]?.classList.add("is-restarting");
        elements.streams.children[target.index]?.classList.add("is-restarting");
      }
    }
    elements.clusterEvent.textContent = successful ? effectLabels[action] : pick({ ru: "ОТВЕТ / ОТКЛОНЁН", en: "RESPONSE / REJECTED" });
    elements.clusterEvent.classList.toggle("is-error", !successful);
    elements.clusterEvent.classList.add("is-visible");
    if (successful && action === "block") elements.terminalStatus.textContent = "BLOCKED";
    const coreLabels = { scale: "SCHEDULER / +1", rollback: "RELEASE / STABLE", restart: "POD / READY" };
    if (successful && coreLabels[action]) elements.core.querySelector("small").textContent = coreLabels[action];
    effectTimer = window.setTimeout(() => {
      elements.space.classList.remove(`effect-${action}`, "effect-success", "effect-error");
      elements.nodes.forEach((node) => {
        node.classList.remove("is-cleaning");
      });
      Array.from(elements.pods.children).forEach((pod) => {
        pod.classList.remove("is-restarting", "is-scaling-in");
      });
      Array.from(elements.streams.children).forEach((stream) => {
        stream.classList.remove("is-provisioning", "is-restarting");
      });
      if (successful && (action === "scale" || action === "restart")) resyncPodConnection(connectionIndex);
      elements.clusterEvent.classList.remove("is-visible", "is-error");
      elements.terminalStatus.textContent = "BRUTE / EXT";
      renderIncident();
    }, 1500);
  }

  function performAction(action, button) {
    if (!state.running) return;
    playSound("action", action);
    const cost = actionCosts[action];
    if (state.resources < cost) {
      addLog(pick({ ru: "Недостаточно свободных ресурсов", en: "Insufficient free resources" }), "warning");
      flashAction(button, "is-error");
      renderLog();
      triggerVisualEffect(action, "error");
      playSound("error");
      return;
    }
    state.resources = clamp(state.resources - cost, 0, 100);
    state.stats.actionCounts[action] += 1;
    if (action === "scale") {
      state.replicas = clamp(state.replicas + 1, 2, 8);
      state.load = clamp(state.load - 18, 12, 100);
    }
    if (!state.incident) {
      state.stats.wrong += 1;
      state.score -= 12;
      state.budget = clamp(state.budget - 1.5, 0, 100);
      addLog(`${pick(actionLabels[action])}: ${pick({ ru: "нет подтверждающего сигнала", en: "no supporting signal" })}`, "warning");
      flashAction(button, "is-error");
      render();
      triggerVisualEffect(action, "error");
      playSound("error");
      return;
    }
    let outcome = "error";
    let effectTarget = null;
    if (state.incident.action === action) {
      const incident = state.incident;
      effectTarget = {
        type: incident.target,
        index: incident.target === "node" ? state.affectedNode : incident.target === "pod" ? state.affectedPod : -1
      };
      const responseTime = state.incidentAge;
      const points = incident.baseScore + Math.max(0, incident.deadline - responseTime) * 11;
      state.score += points;
      state.budget = clamp(state.budget + 3.5, 0, 100);
      state.availability = clamp(state.availability + .001, 99.8, 100);
      state.load = clamp(state.load - 12, 16, 100);
      state.stats.correct += 1;
      state.stats.fastest = Math.min(state.stats.fastest, responseTime);
      state.stats.slowest = Math.max(state.stats.slowest, responseTime);
      state.stats.resolvedIds.add(incident.id);
      if (action === "drain") {
        state.drainedNode = state.affectedNode;
        window.setTimeout(() => { state.drainedNode = -1; renderNodes(); }, 2200);
      }
      addLog(`${pick(incident.resolved)} · +${points}`, "success");
      clearIncident();
      flashAction(button, "is-success");
      outcome = "success";
    } else {
      state.stats.wrong += 1;
      state.incidentMistakes += 1;
      const penalty = WRONG_ACTION_BASE_PENALTY * state.incidentMistakes;
      state.score -= penalty;
      state.budget = clamp(state.budget - 3, 0, 100);
      addLog(`${pick(actionLabels[action])}: ${pick({ ru: "сигнал не устранён", en: "alert remains active" })} · -${penalty}`, "warning");
      flashAction(button, "is-error");
    }
    render();
    triggerVisualEffect(action, outcome, effectTarget);
    playSound(outcome === "success" ? "success" : "error");
  }

  function closeResponseMenu(returnFocus = false) {
    if (elements.radialMenu.hidden) return;
    elements.radialMenu.hidden = true;
    menuIncidentId = "";
    if (returnFocus && state.incident) {
      const target = document.querySelector(".is-problem");
      if (target) target.focus();
    }
  }

  function openResponseMenu(source) {
    const spaceRect = elements.space.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const x = sourceRect.left + sourceRect.width / 2 - spaceRect.left;
    const y = sourceRect.top + sourceRect.height / 2 - spaceRect.top;
    elements.radialMenu.style.setProperty("--menu-x", `${x}px`);
    elements.radialMenu.style.setProperty("--menu-y", `${y}px`);
    menuIncidentId = state.incident.id;
    elements.radialMenu.hidden = false;
    playSound("menu");
    const firstAvailable = elements.radialActions.find((button) => !button.disabled);
    if (firstAvailable) firstAvailable.focus();
  }

  function handleProblemObject(target, index = -1, source) {
    if (!state.running || !state.incident || state.incident.target !== target) return;
    if (target === "node" && index !== state.affectedNode) return;
    if (target === "pod" && index !== state.affectedPod) return;
    openResponseMenu(source);
  }

  function unlockedAchievements(known = new Set()) {
    const unlocked = achievements.filter((achievement) => !achievement.hidden && achievement.test(state));
    const collected = new Set([...known, ...unlocked.map((achievement) => achievement.id)]);
    if (coreAchievementIds.every((id) => collected.has(id))) {
      unlocked.push(achievementsById.get(LEGENDARY_ACHIEVEMENT_ID));
    }
    return unlocked;
  }

  function renderAchievements() {
    elements.achievementList.replaceChildren();
    if (!state.unlocked.length) {
      const empty = document.createElement("li");
      empty.className = "achievement-empty";
      empty.textContent = pick({ ru: "Новых ачивок нет — профиль уже содержит достижения этой смены.", en: "No new badges — this profile already has the achievements earned in this shift." });
      elements.achievementList.append(empty);
      return;
    }
    state.unlocked.forEach((achievement) => {
      const item = document.createElement("li");
      item.className = "achievement";
      item.classList.toggle("is-rare", achievement.rare === true);
      item.classList.toggle("is-legendary", achievement.legendary === true);
      const mark = document.createElement("span");
      mark.className = "achievement-mark";
      mark.textContent = achievement.mark;
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = pick(achievement.title);
      const detail = document.createElement("small");
      detail.textContent = pick(achievement.detail);
      copy.append(title, detail);
      item.append(mark, copy);
      elements.achievementList.append(item);
    });
  }

  function showResults() {
    elements.results.hidden = false;
    elements.resultScore.textContent = Math.max(0, state.score).toString().padStart(4, "0");
    const lastNick = readAchievementProfiles().lastNick;
    if (lastNick && !elements.nickInput.value) elements.nickInput.value = lastNick;
    refreshNewAchievementsForNick(elements.nickInput.value);
    renderAchievements();
    elements.resultDialog.focus();
  }

  function hideResults() {
    elements.results.hidden = true;
    elements.start.focus();
  }

  function finishShift() {
    window.clearInterval(timer);
    closeResponseMenu();
    state.running = false;
    state.ended = true;
    state.score = Math.max(0, state.score);
    state.incident = null;
    state.affectedNode = -1;
    state.affectedPod = -1;
    const lastNick = readAchievementProfiles().lastNick;
    const known = knownAchievementsForNick(lastNick);
    state.sessionAchievements = unlockedAchievements(known);
    state.unlocked = state.sessionAchievements.filter((achievement) => !known.has(achievement.id));
    const passed = state.budget > 25 && state.availability >= 99.9;
    playSound(passed ? "finish-success" : "finish-error");
    const result = passed ? pick({ ru: "Смена принята", en: "Shift completed" }) : pick({ ru: "Запас надёжности исчерпан", en: "Reliability budget exhausted" });
    addLog(result, passed ? "success" : "warning");
    render();
    elements.incidentTitle.textContent = result;
    elements.incidentDetail.textContent = `${pick({ ru: "Счёт", en: "Score" })}: ${state.score} · ${pick({ ru: "доступность", en: "availability" })}: ${state.availability.toFixed(3)}% · ${pick({ ru: "запас", en: "budget" })}: ${Math.round(state.budget)}%`;
    elements.spaceStatus.textContent = passed ? pick({ ru: "Контур стабилен · смена завершена", en: "Cluster stable · shift complete" }) : pick({ ru: "Требуется разбор инцидентов", en: "Incident review required" });
    elements.core.querySelector("small").textContent = passed ? "SHIFT / OK" : "POSTMORTEM";
    elements.resultTitle.textContent = result;
    window.setTimeout(showResults, 350);
  }

  async function createServerSession(activeState) {
    try {
      const response = await fetch(`${API_BASE}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      if (!response.ok) throw new Error("session unavailable");
      const payload = await response.json();
      if (state === activeState && state.running) state.sessionId = payload.sessionId;
    } catch {
      if (state === activeState) state.sessionId = "";
    }
  }

  function startShift() {
    if (state.running) return;
    if (state.ended || state.time <= 0) resetShift(true);
    ensureAudio();
    playSound("start");
    state.running = true;
    const activeState = state;
    createServerSession(activeState);
    addLog(pick({ ru: "Смена принята · мониторинг включён", en: "Shift started · monitoring enabled" }), "success");
    render();
    timer = window.setInterval(tick, 1000);
  }

  function resetShift(silent = false) {
    if (!silent) playSound("reset");
    window.clearInterval(timer);
    window.clearTimeout(effectTimer);
    incidentBag = [];
    state = initialState();
    closeResponseMenu();
    elements.results.hidden = true;
    elements.scoreForm.reset();
    elements.saveStatus.textContent = "";
    elements.scoreForm.querySelector("button[type=submit]").disabled = false;
    elements.space.classList.remove("effect-scale", "effect-drain", "effect-rollback", "effect-cleanup", "effect-restart", "effect-block", "effect-success", "effect-error");
    elements.nodes.forEach((node) => {
      node.classList.remove("is-cleaning");
    });
    Array.from(elements.pods.children).forEach((pod) => {
      pod.classList.remove("is-restarting", "is-scaling-in");
    });
    Array.from(elements.streams.children).forEach((stream) => {
      stream.classList.remove("is-provisioning", "is-restarting");
    });
    elements.terminalStatus.textContent = "BRUTE / EXT";
    elements.clusterEvent.classList.remove("is-visible", "is-error");
    addLog(pick({ ru: "Тренажёр готов", en: "Simulator ready" }));
    render();
  }

  function leaderboardAchievements(entry) {
    if (!Array.isArray(entry.achievements)) return [];
    return entry.achievements.map((id) => achievementsById.get(id)).filter(Boolean);
  }

  function ensureAchievementPopover() {
    if (achievementPopover) return achievementPopover;
    achievementPopover = document.createElement("aside");
    achievementPopover.id = "leaderboard-achievement-popover";
    achievementPopover.className = "leaderboard-achievement-popover";
    achievementPopover.setAttribute("role", "tooltip");
    achievementPopover.hidden = true;
    achievementPopover.addEventListener("pointerenter", () => window.clearTimeout(achievementHideTimer));
    achievementPopover.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") scheduleAchievementPopoverClose();
    });
    document.body.append(achievementPopover);
    return achievementPopover;
  }

  function positionAchievementPopover() {
    if (!activeAchievementTrigger || !achievementPopover || achievementPopover.hidden) return;
    const triggerRect = activeAchievementTrigger.getBoundingClientRect();
    const popoverRect = achievementPopover.getBoundingClientRect();
    const margin = 12;
    const left = clamp(triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2, margin, window.innerWidth - popoverRect.width - margin);
    const roomBelow = window.innerHeight - triggerRect.bottom;
    const top = roomBelow >= popoverRect.height + margin
      ? triggerRect.bottom + 9
      : Math.max(margin, triggerRect.top - popoverRect.height - 9);
    achievementPopover.style.left = `${Math.round(left)}px`;
    achievementPopover.style.top = `${Math.round(top)}px`;
  }

  function showAchievementPopover(trigger, entry, pinned = false) {
    window.clearTimeout(achievementHideTimer);
    hideWorldPopover();
    if (activeAchievementTrigger && activeAchievementTrigger !== trigger) activeAchievementTrigger.setAttribute("aria-expanded", "false");
    activeAchievementTrigger = trigger;
    achievementPopoverPinned = pinned;
    trigger.setAttribute("aria-expanded", "true");
    const popover = ensureAchievementPopover();
    const unlocked = leaderboardAchievements(entry);
    const heading = document.createElement("div");
    heading.className = "achievement-popover-heading";
    const title = document.createElement("strong");
    title.textContent = pick({ ru: `Ачивки · ${entry.nick}`, en: `Badges · ${entry.nick}` });
    const counter = document.createElement("span");
    const hasLegendary = unlocked.some((achievement) => achievement.legendary === true);
    counter.textContent = `${unlocked.length} / ${hasLegendary ? achievements.length : coreAchievementIds.length}`;
    heading.append(title, counter);
    const list = document.createElement("ul");
    if (unlocked.length) {
      unlocked.forEach((achievement) => {
        const item = document.createElement("li");
        item.classList.toggle("is-rare", achievement.rare === true);
        item.classList.toggle("is-legendary", achievement.legendary === true);
        const mark = document.createElement("span");
        mark.className = "achievement-popover-mark";
        mark.textContent = achievement.mark;
        const copy = document.createElement("span");
        const achievementTitle = document.createElement("strong");
        achievementTitle.textContent = pick(achievement.title);
        const detail = document.createElement("small");
        detail.textContent = pick(achievement.detail);
        copy.append(achievementTitle, detail);
        item.append(mark, copy);
        list.append(item);
      });
    } else {
      const empty = document.createElement("li");
      empty.className = "achievement-popover-empty";
      empty.textContent = pick({ ru: "Подробности для этого результата не сохранены", en: "Badge details were not stored for this result" });
      list.append(empty);
    }
    popover.replaceChildren(heading, list);
    popover.hidden = false;
    positionAchievementPopover();
  }

  function hideAchievementPopover(restoreFocus = false) {
    window.clearTimeout(achievementHideTimer);
    achievementPopoverPinned = false;
    if (!activeAchievementTrigger) return;
    const trigger = activeAchievementTrigger;
    trigger.setAttribute("aria-expanded", "false");
    activeAchievementTrigger = undefined;
    if (achievementPopover) achievementPopover.hidden = true;
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }

  function scheduleAchievementPopoverClose() {
    window.clearTimeout(achievementHideTimer);
    if (achievementPopoverPinned) return;
    achievementHideTimer = window.setTimeout(() => hideAchievementPopover(), 140);
  }

  function bindAchievementPopover(trigger, entry) {
    trigger.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") showAchievementPopover(trigger, entry); });
    trigger.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") scheduleAchievementPopoverClose(); });
    trigger.addEventListener("focus", () => window.requestAnimationFrame(() => {
      if (trigger.matches(":focus-visible")) showAchievementPopover(trigger, entry);
    }));
    trigger.addEventListener("blur", scheduleAchievementPopoverClose);
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (activeAchievementTrigger === trigger && achievementPopover && !achievementPopover.hidden) hideAchievementPopover();
      else showAchievementPopover(trigger, entry, true);
    });
  }

  function ensureWorldPopover() {
    if (worldPopover) return worldPopover;
    worldPopover = document.createElement("aside");
    worldPopover.id = "leaderboard-world-popover";
    worldPopover.className = "leaderboard-world-popover";
    worldPopover.setAttribute("role", "tooltip");
    worldPopover.hidden = true;
    worldPopover.addEventListener("pointerenter", () => window.clearTimeout(worldHideTimer));
    worldPopover.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") scheduleWorldPopoverClose();
    });
    document.body.append(worldPopover);
    return worldPopover;
  }

  function positionWorldPopover() {
    if (!activeWorldTrigger || !worldPopover || worldPopover.hidden) return;
    const triggerRect = activeWorldTrigger.getBoundingClientRect();
    const popoverRect = worldPopover.getBoundingClientRect();
    const margin = 12;
    const left = clamp(triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2, margin, window.innerWidth - popoverRect.width - margin);
    const roomBelow = window.innerHeight - triggerRect.bottom;
    const top = roomBelow >= popoverRect.height + margin
      ? triggerRect.bottom + 9
      : Math.max(margin, triggerRect.top - popoverRect.height - 9);
    worldPopover.style.left = `${Math.round(left)}px`;
    worldPopover.style.top = `${Math.round(top)}px`;
  }

  function showWorldPopover(trigger, world, pinned = false) {
    window.clearTimeout(worldHideTimer);
    hideAchievementPopover();
    if (activeWorldTrigger && activeWorldTrigger !== trigger) activeWorldTrigger.setAttribute("aria-expanded", "false");
    activeWorldTrigger = trigger;
    worldPopoverPinned = pinned;
    trigger.setAttribute("aria-expanded", "true");
    const popover = ensureWorldPopover();
    const planet = document.createElement("i");
    planet.className = `planet planet-${world.id}`;
    planet.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = pick(world.name);
    const detail = document.createElement("small");
    detail.textContent = pick(world.detail);
    copy.append(title, detail);
    popover.replaceChildren(planet, copy);
    popover.hidden = false;
    positionWorldPopover();
  }

  function hideWorldPopover(restoreFocus = false) {
    window.clearTimeout(worldHideTimer);
    worldPopoverPinned = false;
    if (!activeWorldTrigger) return;
    const trigger = activeWorldTrigger;
    trigger.setAttribute("aria-expanded", "false");
    activeWorldTrigger = undefined;
    if (worldPopover) worldPopover.hidden = true;
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }

  function scheduleWorldPopoverClose() {
    window.clearTimeout(worldHideTimer);
    if (worldPopoverPinned) return;
    worldHideTimer = window.setTimeout(() => hideWorldPopover(), 140);
  }

  function bindWorldPopover(trigger, world) {
    trigger.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") showWorldPopover(trigger, world); });
    trigger.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") scheduleWorldPopoverClose(); });
    trigger.addEventListener("focus", () => window.requestAnimationFrame(() => {
      if (trigger.matches(":focus-visible") && !window.matchMedia("(pointer: coarse)").matches) {
        showWorldPopover(trigger, world);
      }
    }));
    trigger.addEventListener("blur", scheduleWorldPopoverClose);
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (activeWorldTrigger === trigger && worldPopover && !worldPopover.hidden) hideWorldPopover();
      else showWorldPopover(trigger, world, true);
    });
  }

  function renderLeaderboard(entries) {
    hideAchievementPopover();
    hideWorldPopover();
    cachedLeaderboardEntries = entries;
    elements.leaderboard.replaceChildren();
    if (!entries.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = pick({ ru: "Таблица пока пуста — можно занять первое место.", en: "The board is empty — first place is available." });
      row.append(cell);
      elements.leaderboard.append(row);
      return;
    }
    entries.slice(0, 10).forEach((entry, index) => {
      const row = document.createElement("tr");
      const world = leaderboardWorlds[index];
      const rankCell = document.createElement("td");
      const rank = document.createElement("button");
      rank.className = "rank-world";
      rank.type = "button";
      rank.setAttribute("aria-describedby", "leaderboard-world-popover");
      rank.setAttribute("aria-expanded", "false");
      rank.setAttribute("aria-label", `${index + 1} ${pick(world.name)}: ${pick(world.detail)}`);
      const planet = document.createElement("i");
      planet.className = `planet planet-${world.id}`;
      planet.setAttribute("aria-hidden", "true");
      rank.append(planet);
      bindWorldPopover(rank, world);
      rankCell.append(rank);
      row.append(rankCell);
      const nickCell = document.createElement("td");
      nickCell.textContent = entry.nick;
      const scoreCell = document.createElement("td");
      scoreCell.textContent = entry.score;
      const achievementCell = document.createElement("td");
      const achievementButton = document.createElement("button");
      achievementButton.className = "leaderboard-achievement-count";
      achievementButton.type = "button";
      achievementButton.setAttribute("aria-describedby", "leaderboard-achievement-popover");
      achievementButton.setAttribute("aria-expanded", "false");
      achievementButton.setAttribute("aria-label", `${pick({ ru: "Показать ачивки игрока", en: "Show badges for" })} ${entry.nick}: ${entry.achievementCount}`);
      const countMark = document.createElement("span");
      countMark.setAttribute("aria-hidden", "true");
      countMark.textContent = "✦";
      const count = document.createElement("strong");
      count.textContent = entry.achievementCount;
      achievementButton.append(countMark, count);
      bindAchievementPopover(achievementButton, entry);
      achievementCell.append(achievementButton);
      row.append(nickCell, scoreCell, achievementCell);
      elements.leaderboard.append(row);
    });
  }

  async function loadLeaderboard() {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`, { cache: "no-store" });
      if (!response.ok) throw new Error("leaderboard unavailable");
      const payload = await response.json();
      renderLeaderboard(Array.isArray(payload.entries) ? payload.entries : []);
      elements.leaderboardStatus.textContent = pick({ ru: "Обновлено сейчас", en: "Updated just now" });
    } catch {
      renderLeaderboard([]);
      elements.leaderboardStatus.textContent = pick({ ru: "Таблица временно недоступна", en: "Leaderboard is temporarily unavailable" });
    }
  }

  async function saveScore(event) {
    event.preventDefault();
    if (!state.ended || state.saved) return;
    const formData = new FormData(elements.scoreForm);
    const nick = normalizeNickInput(formData.get("nick"));
    elements.nickInput.value = nick;
    const submit = elements.scoreForm.querySelector("button[type=submit]");
    if (!validateNickInput()) {
      elements.saveStatus.textContent = pick({ ru: "Этот ник нельзя добавить в таблицу.", en: "This nickname cannot be added to the leaderboard." });
      elements.nickInput.reportValidity();
      return;
    }
    refreshNewAchievementsForNick(nick);
    if (!state.sessionId) {
      elements.saveStatus.textContent = pick({ ru: "Не удалось открыть игровую сессию. Сыграйте ещё раз.", en: "Game session was unavailable. Please play once more." });
      return;
    }
    submit.disabled = true;
    elements.saveStatus.textContent = pick({ ru: "Сохраняю результат…", en: "Saving score…" });
    try {
      const response = await fetch(`${API_BASE}/leaderboard`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ sessionId: state.sessionId, nick, website: String(formData.get("website") || ""), score: state.score, availability: Number(state.availability.toFixed(3)), budget: Math.round(state.budget), duration: SHIFT_DURATION, achievements: state.sessionAchievements.map((achievement) => achievement.id) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "save failed");
      playSound("save");
      state.saved = true;
      const newlyUnlocked = new Set(Array.isArray(payload.newAchievements) ? payload.newAchievements : state.unlocked.map((achievement) => achievement.id));
      state.unlocked = achievements.filter((achievement) => newlyUnlocked.has(achievement.id));
      const savedProfile = Array.isArray(payload.entries)
        ? payload.entries.find((entry) => String(entry.nick || "").toLocaleLowerCase() === nick.toLocaleLowerCase())
        : undefined;
      rememberAchievementProfile(nick, Array.isArray(savedProfile?.achievements) ? savedProfile.achievements : state.sessionAchievements.map((achievement) => achievement.id));
      renderAchievements();
      elements.saveStatus.textContent = payload.rank
        ? `${pick({ ru: "Результат сохранён. Место", en: "Score saved. Rank" })}: ${payload.rank}`
        : pick({ ru: "Результат сохранён", en: "Score saved" });
      renderLeaderboard(Array.isArray(payload.entries) ? payload.entries : []);
      elements.leaderboardStatus.textContent = pick({ ru: "Таблица обновлена", en: "Leaderboard updated" });
    } catch (error) {
      playSound("error");
      submit.disabled = false;
      elements.saveStatus.textContent = error.message === "invalid nickname"
        ? pick({ ru: "Этот ник содержит недопустимое слово или символы.", en: "This nickname contains a prohibited word or unsupported characters." })
        : pick({ ru: "Не удалось сохранить результат. Проверьте ник и попробуйте снова.", en: "Could not save the score. Check the nickname and try again." });
    }
  }

  elements.start.addEventListener("click", startShift);
  elements.reset.addEventListener("click", () => resetShift());
  elements.soundToggle?.addEventListener("click", toggleSound);
  elements.actions.forEach((button) => {
    button.addEventListener("click", () => performAction(button.dataset.action, button));
  });
  elements.core.addEventListener("click", () => handleProblemObject("core", -1, elements.core));
  elements.nodes.forEach((node, index) => {
    node.addEventListener("click", () => handleProblemObject("node", index, node));
  });
  elements.pods.addEventListener("click", (event) => {
    const pod = event.target.closest("[data-pod]");
    if (pod) handleProblemObject("pod", Number(pod.dataset.pod), pod);
  });
  elements.beacon.addEventListener("click", () => handleProblemObject("beacon", -1, elements.beacon));
  elements.radialClose.addEventListener("click", () => closeResponseMenu(true));
  elements.radialActions.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.incident || state.incident.id !== menuIncidentId) { closeResponseMenu(); return; }
      const action = button.dataset.radialAction;
      const actionButton = elements.actions.find((candidate) => candidate.dataset.action === action);
      closeResponseMenu();
      if (actionButton && !actionButton.disabled) performAction(action, actionButton);
    });
  });
  elements.resultClose.addEventListener("click", hideResults);
  elements.scoreForm.addEventListener("submit", saveScore);
  elements.nickInput.addEventListener("input", () => { validateNickInput(); refreshNewAchievementsForNick(elements.nickInput.value); });
  elements.nickInput.addEventListener("change", () => {
    const nick = normalizeNickInput(elements.nickInput.value);
    elements.nickInput.value = nick;
    if (Array.from(nick).length >= 2 && Array.from(nick).length <= MAX_NICK_LENGTH) rememberAchievementProfile(nick, []);
  });
  elements.results.addEventListener("click", (event) => { if (event.target === elements.results) hideResults(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeAchievementTrigger) { hideAchievementPopover(true); return; }
    if (event.key === "Escape" && activeWorldTrigger) { hideWorldPopover(true); return; }
    if (event.key === "Escape" && !elements.radialMenu.hidden) { closeResponseMenu(true); return; }
    if (event.key === "Escape" && !elements.results.hidden) { hideResults(); return; }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !elements.results.hidden) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < elements.actions.length) {
      const button = elements.actions[index];
      if (!button.disabled) { event.preventDefault(); button.click(); }
    }
  });
  document.addEventListener("click", (event) => {
    if (activeAchievementTrigger && !achievementPopover?.contains(event.target) && !activeAchievementTrigger.contains(event.target)) hideAchievementPopover();
    if (activeWorldTrigger && !worldPopover?.contains(event.target) && !activeWorldTrigger.contains(event.target)) hideWorldPopover();
  });
  window.addEventListener("resize", () => { positionAchievementPopover(); positionWorldPopover(); positionAttackLink(); });
  window.addEventListener("scroll", () => { positionAchievementPopover(); positionWorldPopover(); }, true);

  const returnToTop = document.querySelector("[data-return-to-top]");
  if (returnToTop) {
    const returnLabel = language === "en" ? returnToTop.dataset.labelEn : returnToTop.dataset.labelRu;
    returnToTop.dataset.label = returnLabel;
    returnToTop.setAttribute("aria-label", returnLabel);
    let returnScrollFrame = 0;
    const updateReturnToTop = () => {
      returnScrollFrame = 0;
      if (!returnToTop.classList.contains("is-launching")) returnToTop.classList.toggle("is-visible", window.scrollY > Math.min(520, window.innerHeight * .62));
    };
    window.addEventListener("scroll", () => {
      if (!returnScrollFrame) returnScrollFrame = window.requestAnimationFrame(updateReturnToTop);
    }, { passive: true });
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

  elements.year.textContent = new Date().getFullYear();
  updateSoundControl();
  resetShift(true);
  updateIdleTelemetry();
  loadLeaderboard();
})();
