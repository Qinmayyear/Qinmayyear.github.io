(() => {
  const cover = document.querySelector(".cover");
  const stage = cover.querySelector(".card-stage");
  const card = stage.querySelector(".business-card");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let scrollFrame = null;

  function updateScroll() {
    scrollFrame = null;
    const progress = Math.min(1, Math.max(0, window.scrollY / cover.offsetHeight));
    cover.style.setProperty("--scroll", progress.toFixed(3));
  }

  function requestScrollUpdate() {
    if (!reducedMotion.matches && scrollFrame === null) {
      scrollFrame = window.requestAnimationFrame(updateScroll);
    }
  }

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
  reducedMotion.addEventListener("change", requestScrollUpdate);
  requestScrollUpdate();

  stage.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType !== "mouse") return;

    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty("--tilt-x", (-y * 6).toFixed(2) + "deg");
    card.style.setProperty("--tilt-y", (x * 6).toFixed(2) + "deg");
  });

  stage.addEventListener("pointerleave", () => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
  });
})();
