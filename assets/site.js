(() => {
  const desk = document.querySelector(".desk-story");
  const arrival = desk.querySelector(".desk-arrival");
  const cover = arrival.querySelector(".cover");
  const folder = desk.querySelector(".file-folder");
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
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const degreesPerRadian = 180 / Math.PI;
  let scrollFrame = null;
  let lightFrame = null;
  let lastAzimuth;
  let lastElevation;

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

  function easeProgress(progress) {
    const fraction = Math.min(1, Math.max(0, progress));
    return fraction * fraction * (3 - 2 * fraction);
  }

  function updateScroll() {
    scrollFrame = null;
    const travel = Math.max(1, arrival.offsetHeight - cover.offsetHeight);
    const progress = easeProgress(-arrival.getBoundingClientRect().top / travel);
    const viewport = window.innerHeight;
    const folderTop = folder.getBoundingClientRect().top;
    const opening = easeProgress((viewport * 0.88 - folderTop) / (viewport * 0.60));

    desk.style.setProperty("--desk-progress", progress.toFixed(3));
    folder.style.setProperty("--folder-progress", opening.toFixed(3));
    arrival.classList.toggle("is-past-card", progress > 0.86);
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
})();
