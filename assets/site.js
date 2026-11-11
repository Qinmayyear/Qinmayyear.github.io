(() => {
  const desk = document.querySelector(".desk-story");
  const arrival = desk.querySelector(".desk-arrival");
  const cover = arrival.querySelector(".cover");
  const folder = desk.querySelector(".file-folder");
  const terminalTravel = desk.querySelector(".terminal-travel");
  const backdrop = desk.querySelector(".desk-backdrop");
  const deskPhoto = backdrop.querySelector("img");
  const photoWidth = Number(deskPhoto.getAttribute("width"));
  const photoHeight = Number(deskPhoto.getAttribute("height"));
  const stage = cover.querySelector(".card-stage");
  const card = stage.querySelector(".business-card");
  const front = card.querySelector(".card-front");
  const back = card.querySelector(".card-back");
  const flipButton = stage.querySelector(".card-flip");
  const lightSources = cover.querySelectorAll("[data-card-light]");
  const grooveShadow = cover.querySelector("#groove-shadow");
  const grooveHighlight = cover.querySelector("#groove-highlight");
  const windowLight = { x: -0.63, y: -0.61, z: 0.48 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const deskMotion = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 31rem)");
  const compactDesk = window.matchMedia("(max-width: 42rem)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const degreesPerRadian = 180 / Math.PI;
  let scrollFrame = null;
  let lightFrame = null;
  let lastAzimuth;
  let lastElevation;
  let lastTerminalProgress;

  function renderCardLight() {
    lightFrame = null;
    const transform = getComputedStyle(card).transform;
    const rotation = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
    const face = rotation.m33 < 0 ? -1 : 1;

    // Project the room's light onto the card's current axes, including its reverse.
    const x = face * (rotation.m11 * windowLight.x + rotation.m12 * windowLight.y + rotation.m13 * windowLight.z);
    const y = rotation.m21 * windowLight.x + rotation.m22 * windowLight.y + rotation.m23 * windowLight.z;
    const z = face * (rotation.m31 * windowLight.x + rotation.m32 * windowLight.y + rotation.m33 * windowLight.z);
    const azimuth = ((Math.atan2(y, x) * degreesPerRadian + 360) % 360).toFixed(1);
    const angle = Math.atan2(z, Math.hypot(x, y)) * degreesPerRadian;
    const elevation = Math.min(68, Math.max(13, angle)).toFixed(1);

    if (elevation !== lastElevation) {
      // Keep flat paper transparent and tint only the lit and shaded groove edges.
      const flatLight = Math.sin(Number(elevation) / degreesPerRadian);
      const shadowFloor = (0.72 * flatLight - 0.025).toFixed(3);
      const highlightFloor = (-1.55 * flatLight - 0.035).toFixed(3);
      grooveShadow.setAttribute("values", "0 0 0 0 .39  0 0 0 0 .28  0 0 0 0 .19  -.72 0 0 0 " + shadowFloor);
      grooveHighlight.setAttribute("values", "0 0 0 0 1  0 0 0 0 .99  0 0 0 0 .95  1.55 0 0 0 " + highlightFloor);
    }
    if (azimuth !== lastAzimuth || elevation !== lastElevation) {
      for (const source of lightSources) {
        source.setAttribute("azimuth", azimuth);
        source.setAttribute("elevation", elevation);
      }
      lastAzimuth = azimuth;
      lastElevation = elevation;
    }

    card.style.setProperty("--ink-rim-x", (-x * 1.25).toFixed(2) + "px");
    card.style.setProperty("--ink-rim-y", (-y * 1.25).toFixed(2) + "px");
    card.style.setProperty("--window-x", (50 + x * 51).toFixed(1) + "%");
    card.style.setProperty("--window-y", (50 + y * 62).toFixed(1) + "%");
    card.style.setProperty("--window-glow", (0.24 + 0.63 * Math.max(0, z)).toFixed(3));

    if (card.getAnimations?.().some((animation) => animation.playState === "running")) {
      requestLightUpdate();
    }
  }

  function requestLightUpdate() {
    if (lightFrame === null && typeof DOMMatrixReadOnly === "function") {
      lightFrame = window.requestAnimationFrame(renderCardLight);
    }
  }

  function flipCard() {
    const flipped = card.classList.toggle("is-flipped");
    front.inert = flipped;
    back.inert = !flipped;
    flipButton.setAttribute("aria-expanded", String(flipped));
    requestLightUpdate();
  }

  flipButton.addEventListener("click", flipCard);
  card.addEventListener("click", (event) => {
    if (event.target.closest("a") || window.getSelection()?.type === "Range") return;

    flipButton.focus({ preventScroll: true });
    flipCard();
  });
  flipButton.hidden = false;

  function easeProgress(progress, start = 0, end = 1) {
    const fraction = Math.min(1, Math.max(0, (progress - start) / (end - start)));
    return fraction * fraction * (3 - 2 * fraction);
  }

  function renderTerminal(viewport) {
    const travelTop = terminalTravel.getBoundingClientRect().top;
    const travelHeight = terminalTravel.offsetHeight;
    const approach = viewport * 0.47;
    const remaining = Math.max(0, travelTop + travelHeight);
    const progress = Math.min(1, Math.max(0, 1 - remaining / (travelHeight + approach)));
    if ((progress === 0 || progress === 1) && progress === lastTerminalProgress) return;
    lastTerminalProgress = progress;

    const { clientWidth: width, clientHeight: height } = backdrop;
    const compact = compactDesk.matches;
    const fit = Math.max(width / photoWidth, height / photoHeight);
    const pan = easeProgress(progress, compact ? 0.07 : 0.12, 0.66);
    const zoom = 1 + 2.55 * easeProgress(progress, 0.14, 0.60) + 10.2 * easeProgress(progress, 0.59, 0.91);
    const scale = fit * zoom;
    const scaledWidth = photoWidth * scale;
    const scaledHeight = photoHeight * scale;
    // The CRT's glass sits against the top-right edge of the desk photograph.
    const startLeft = (width - scaledWidth) * (compact ? 0.53 : 0.50);
    const startTop = (height - scaledHeight) * (compact ? 0.40 : 0.38);
    const glassLeft = width * 0.52 - scaledWidth * 0.928;
    const glassTop = height * 0.48 - scaledHeight * 0.051;
    const left = Math.max(width - scaledWidth, Math.min(0, startLeft + (glassLeft - startLeft) * pan));
    const top = Math.max(height - scaledHeight, Math.min(0, startTop + (glassTop - startTop) * pan));
    const wake = easeProgress(progress, 0.84, 0.998);
    const consoleVisible = progress >= 0.865;
    const properties = {
      "--camera-visibility": progress > 0 && progress < 0.97 ? "visible" : "hidden",
      "--camera-left": left.toFixed(2) + "px",
      "--camera-top": top.toFixed(2) + "px",
      "--camera-scale": scale,
      "--glass-opacity": easeProgress(progress, 0.83, 0.97),
      "--console-light": easeProgress(progress, 0.865, 0.997),
      "--console-visibility": consoleVisible ? "visible" : "hidden",
      "--console-lift": (consoleVisible ? -remaining : 0).toFixed(1) + "px",
      "--wake-position": (-24 + 132 * wake).toFixed(1) + "%",
      "--wake-glow": 4 * wake * (1 - wake),
    };

    for (const [property, value] of Object.entries(properties)) {
      desk.style.setProperty(property, typeof value === "number" ? value.toFixed(3) : value);
    }
  }

  function updateScroll() {
    scrollFrame = null;
    const travel = Math.max(1, arrival.offsetHeight - cover.offsetHeight);
    const progress = easeProgress(-arrival.getBoundingClientRect().top / travel);
    const viewport = window.innerHeight;
    const folderBounds = folder.getBoundingClientRect();
    const opening = easeProgress((viewport * 0.88 - folderBounds.top) / (viewport * 0.60));
    const closing = easeProgress((viewport * 0.49 - folderBounds.bottom) / (viewport * 0.45));

    desk.style.setProperty("--desk-progress", progress.toFixed(3));
    folder.style.setProperty("--folder-progress", (opening * (1 - closing)).toFixed(3));
    arrival.classList.toggle("is-past-card", progress > 0.86);
    renderTerminal(viewport);
  }

  function requestScrollUpdate() {
    if (deskMotion.matches && scrollFrame === null) {
      scrollFrame = window.requestAnimationFrame(updateScroll);
    }
  }

  desk.classList.add("desk-motion");
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
  deskMotion.addEventListener("change", requestScrollUpdate);
  reducedMotion.addEventListener("change", requestLightUpdate);
  requestScrollUpdate();
  requestLightUpdate();

  card.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType !== "mouse") return;
    if (event.target.closest(".card-back a")) return;

    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty("--tilt-x", (-y * 8.5).toFixed(2) + "deg");
    card.style.setProperty("--tilt-y", (x * 8.5).toFixed(2) + "deg");
    requestLightUpdate();
  });

  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    requestLightUpdate();
  });

  const guestbook = desk.querySelector(".terminal-form");
  const guestName = guestbook.elements.namedItem("name");
  const guestMessage = guestbook.elements.namedItem("message");
  const log = desk.querySelector(".terminal-log");
  const emptyLog = desk.querySelector(".terminal-empty");
  const status = desk.querySelector(".terminal-status");
  const guestbookKey = "qinrong-terminal-notes-v1";
  const noteLimit = 8;
  let notes = [];

  try {
    const saved = JSON.parse(localStorage.getItem(guestbookKey));
    if (Array.isArray(saved)) {
      notes = saved.filter((note) => (
        typeof note?.name === "string" && typeof note.message === "string"
      )).slice(0, noteLimit);
    }
  } catch {
    status.textContent = "Saved notes are unavailable.";
  }

  function renderNotes() {
    const entries = notes.map((note) => {
      const entry = document.createElement("li");
      const name = document.createElement("strong");
      const message = document.createElement("p");
      name.textContent = note.name;
      message.textContent = note.message;
      entry.append(name, message);
      return entry;
    });
    log.replaceChildren(...entries);
    emptyLog.hidden = entries.length > 0;
  }

  guestbook.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = guestMessage.value.trim();
    if (!message) {
      status.textContent = "Enter a note first.";
      guestMessage.focus();
      return;
    }

    const name = guestName.value.trim() || "Visitor";
    const updated = [{ name, message }, ...notes].slice(0, noteLimit);
    try {
      localStorage.setItem(guestbookKey, JSON.stringify(updated));
    } catch {
      status.textContent = "This browser could not save your note.";
      return;
    }

    notes = updated;
    renderNotes();
    guestbook.reset();
    status.textContent = "Note saved on this device.";
  });

  renderNotes();
  guestbook.hidden = false;
})();
