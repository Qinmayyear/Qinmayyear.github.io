import * as THREE from "./vendor/three.module.min.js";
import { createTerminal } from "./crt.js";
import { makeCard, makeDesk, makeFolder, makeRoomReflection, makeTelephone } from "./props.js";

const desk = document.querySelector(".desk-story");
const backdrop = desk.querySelector(".desk-backdrop");
const view = desk.querySelector(".desk-render");
const inspect = desk.querySelector(".desk-inspect");
const arrival = desk.querySelector(".desk-arrival");
const cover = desk.querySelector(".cover");
const cardStage = cover.querySelector(".card-stage");
const cardFace = cardStage.querySelector(".business-card");
const motion = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 31rem)");
const textureUrls = {
  walnut: new URL("./walnut-albedo.webp", import.meta.url).href,
  manila: new URL("./manila-albedo.webp", import.meta.url).href,
  fiber: new URL("./manila-bump.webp", import.meta.url).href,
};

const clamp = (value) => Math.max(0, Math.min(1, value));
const lerp = (start, end, amount) => start + (end - start) * amount;
const smooth = (value, start, end) => {
  const amount = clamp((value - start) / (end - start));
  return amount * amount * (3 - 2 * amount);
};

// Map the live card to the four projected corners of the model.
function cardMatrix([a, b, c, d], width, height) {
  const dx1 = b.x - c.x;
  const dx2 = d.x - c.x;
  const dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y;
  const dy2 = d.y - c.y;
  const dy3 = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 0.0001) return "none";
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  return "matrix3d(" + [
    (b.x - a.x + g * b.x) / width, (b.y - a.y + g * b.y) / width, 0, g / width,
    (d.x - a.x + h * d.x) / height, (d.y - a.y + h * d.y) / height, 0, h / height,
    0, 0, 1, 0, a.x, a.y, 0, 1,
  ].map((value) => value.toFixed(7)).join(",") + ")";
}

const looks = {
  day: { color: "#ffe4bf", key: 2.85, fill: 0.88, reflection: 0.48, tint: 0.14, light: [-0.63, -0.61, 0.48] },
  dusk: { color: "#ffc180", key: 2.2, fill: 0.53, reflection: 0.31, tint: 0.35, light: [-0.82, -0.28, 0.49] },
  night: { color: "#ffd098", key: 2.15, fill: 0.37, reflection: 0.20, tint: 0.62, light: [-0.45, -0.35, 0.82] },
};

function localLook() {
  const date = new Date();
  const hour = date.getHours() + date.getMinutes() / 60;
  const times = [[0, "night"], [6, "night"], [8, "day"], [16, "day"], [18.5, "dusk"], [21, "night"], [24, "night"]];
  const index = times.findIndex(([end]) => end > hour);
  const [startHour, startLook] = times[index - 1];
  const [endHour, endLook] = times[index];
  const from = looks[startLook];
  const to = looks[endLook];
  const amount = smooth(hour, startHour, endHour);
  return {
    color: new THREE.Color(from.color).lerp(new THREE.Color(to.color), amount),
    key: lerp(from.key, to.key, amount),
    fill: lerp(from.fill, to.fill, amount),
    reflection: lerp(from.reflection, to.reflection, amount),
    tint: lerp(from.tint, to.tint, amount),
    light: from.light.map((value, axis) => lerp(value, to.light[axis], amount)),
  };
}

function createContactShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(48, 48, 12, 48, 48, 48);
  gradient.addColorStop(0, "#2a180c");
  gradient.addColorStop(0.7, "#2a180c66");
  gradient.addColorStop(1, "#2a180c00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (x, z, width, depth, opacity) => {
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.012, z);
    return shadow;
  };
}

async function start() {
  if (!motion.matches || !window.WebGL2RenderingContext) return;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  const loader = new THREE.TextureLoader();
  let walnut, manila, fiber;
  try {
    [walnut, manila, fiber] = await Promise.all(Object.values(textureUrls).map((url) => loader.loadAsync(url)));
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  walnut.colorSpace = manila.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [walnut, manila, fiber]) {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  for (const texture of [manila, fiber]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.9, 3.7);
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  scene.environment = makeRoomReflection(THREE);
  const camera = new THREE.PerspectiveCamera(39, 1, 0.8, 450);

  const key = new THREE.DirectionalLight("#ffe4bf", 2.85);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -75, right: 75, top: 65, bottom: -65, near: 1, far: 205 });
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.045;
  key.shadow.radius = 2.6;
  const fill = new THREE.HemisphereLight("#f2e4d4", "#62503c", 0.88);
  scene.add(key, fill, key.target, makeDesk(THREE, walnut));

  const terminal = createTerminal(THREE);
  terminal.position.set(46, 0, -20);
  terminal.rotation.y = -0.22;
  scene.add(terminal);
  const { screen } = terminal.userData;
  const terminalAim = terminal.localToWorld(screen.center.clone());

  const telephone = makeTelephone(THREE);
  telephone.position.set(-53, 0, -19);
  telephone.rotation.y = 0.17;
  scene.add(telephone);
  const { folder, hinge } = makeFolder(THREE, manila, fiber);
  folder.position.set(2.2, 0, 3.5);
  folder.rotation.y = 0.11;
  scene.add(folder);

  const held = new THREE.Group();
  const card = makeCard(THREE, cardFace);
  held.add(card);
  scene.add(held);
  const shadow = createContactShadow();
  const cardShadow = shadow(-40, 19, 12, 7.5, 0.35);
  scene.add(shadow(46, -13, 53, 46, 0.52), shadow(-53, -19, 25, 24, 0.5),
    shadow(2, 4, 31, 36, 0.48), cardShadow);

  const setting = inspect.querySelector("select");
  const target = new THREE.Vector3();
  const shotEye = new THREE.Vector3();
  const crtEye = (distance, height) => terminal.localToWorld(screen.center.clone().add(new THREE.Vector3(0, height, distance)));
  const corners = [
    new THREE.Vector3(-4.45, 0.035, -2.54), new THREE.Vector3(4.45, 0.035, -2.54),
    new THREE.Vector3(4.45, 0.035, 2.54), new THREE.Vector3(-4.45, 0.035, 2.54),
  ];
  let frame = { arrival: 0, terminal: 0 };
  let width = 0;
  let height = 0;
  let savedRender = "";
  let lost = false;
  let lightTimer;
  const uniforms = desk.style;

  function light() {
    const look = setting.value === "local" ? localLook() : looks[setting.value];
    key.color.set(look.color);
    key.intensity = look.key;
    const [x, y, z] = look.light;
    key.position.set(104 * x, 113 * z + 20, 93 * y);
    fill.intensity = look.fill;
    scene.environmentIntensity = look.reflection;
    uniforms.setProperty("--desk3d-room-tint", "rgb(29 19 14 / " + look.tint + ")");
    desk.dispatchEvent(new CustomEvent("desk3d-light", { detail: { x, y, z } }));
    savedRender = "";
  }

  function render(next) {
    frame = next;
    if (lost || !motion.matches) return;
    const { arrival: entry, terminal: exit } = frame;
    const visibility = smooth(entry, 0.12, 0.49);
    uniforms.setProperty("--desk3d-visibility", visibility.toFixed(4));
    if (!visibility) {
      uniforms.setProperty("--desk3d-card-opacity", "1");
      uniforms.setProperty("--desk3d-attitude", "1");
      uniforms.removeProperty("--desk3d-card-matrix");
      desk.classList.remove("desk3d-card-down");
      return;
    }
    if (width !== backdrop.clientWidth || height !== backdrop.clientHeight) {
      width = backdrop.clientWidth;
      height = backdrop.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, width < 620 ? 1.45 : 1.85));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      savedRender = "";
    }

    const portrait = smooth(camera.aspect, 1.13, 0.55);
    const close = smooth(entry, 0.70, 0.985);
    const pulledBack = smooth(entry, 0.12, 0.52);
    const portraitDistance = Math.max(1, 0.48 / camera.aspect);
    const folderEye = new THREE.Vector3(lerp(-12, 2.6, portrait),
      lerp(43, 79 * portraitDistance, portrait), lerp(34, 4.2 + 25 * portraitDistance, portrait));
    const folderAim = new THREE.Vector3(lerp(-8, 2.6, portrait), 0.08, 4.2);
    const deskEye = new THREE.Vector3(lerp(-31, -36, portrait), lerp(49, 56, portrait), lerp(79, 99, portrait));
    const deskAim = new THREE.Vector3(lerp(-11, -28, portrait), 4, lerp(5, 10, portrait));
    shotEye.set(-37, 29, 48).lerp(deskEye, pulledBack).lerp(folderEye, close);
    target.set(-30, 10, 24).lerp(deskAim, pulledBack).lerp(folderAim, close);
    if (exit > 0) {
      const turn = smooth(exit, 0.12, 0.60);
      const crossing = smooth(exit, 0.59, 0.86);
      const screenDistance = lerp(53, Math.max(80, 36 / (0.708 * camera.aspect)), portrait);
      shotEye.lerp(crtEye(screenDistance, 14), turn).lerp(crtEye(4.5, 0.5), crossing);
      target.lerp(terminalAim, turn);
    }
    camera.position.copy(shotEye);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const placing = smooth(entry, 0.21, 0.62);
    held.position.set(lerp(-30, -41, placing), lerp(13, 0.048, placing), lerp(23, 18, placing));
    held.rotation.set(lerp(0.59, 0, placing), lerp(-0.075, 0.15, placing), 0, "YXZ");
    card.rotation.z = cardFace.classList.contains("is-flipped") ? Math.PI : 0;
    const cardOpacity = 1 - smooth(entry, 0.62, 0.69);
    card.visible = entry >= 0.62;
    cardShadow.position.x = held.position.x;
    cardShadow.position.z = held.position.z;
    cardShadow.scale.setScalar(lerp(1.5, 0.93, placing));
    cardShadow.material.opacity = lerp(0.09, 0.43, placing);
    hinge.rotation.z = (Math.PI - 0.012) * smooth(entry, 0.71, 0.96) * (1 - smooth(exit, 0.025, 0.35));
    screen.setGlow(0.17 + 0.83 * smooth(exit, 0.42, 0.80));

    uniforms.setProperty("--desk3d-card-opacity", cardOpacity.toFixed(4));
    desk.classList.toggle("desk3d-card-down", cardOpacity === 0);
    uniforms.setProperty("--desk3d-attitude", (1 - smooth(entry, 0.12, 0.40)).toFixed(4));
    if (cardOpacity > 0) {
      held.updateMatrixWorld(true);
      const stageWidth = cardStage.offsetWidth;
      const stageHeight = stageWidth * 4 / 7;
      const left = cardStage.offsetLeft;
      const top = cardStage.offsetTop + cover.getBoundingClientRect().top;
      const merge = smooth(entry, 0.15, 0.58);
      const points = corners.map((corner, index) => {
        const projected = held.localToWorld(corner.clone()).project(camera);
        return {
          x: lerp(index === 1 || index === 2 ? stageWidth : 0, (projected.x + 1) * width / 2 - left, merge),
          y: lerp(index > 1 ? stageHeight : 0, (1 - projected.y) * height / 2 - top, merge),
        };
      });
      uniforms.setProperty("--desk3d-card-matrix", cardMatrix(points, stageWidth, stageHeight));
    }

    const signature = [entry, exit, card.rotation.z].join("/");
    if (signature !== savedRender && exit < 0.98) {
      renderer.render(scene, camera);
      savedRender = signature;
    }
  }

  view.append(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", () => {
    lost = true;
    desk.classList.remove("desk3d-ready");
    inspect.hidden = true;
  });
  desk.addEventListener("desk3d-frame", (event) => render(event.detail));
  setting.addEventListener("change", () => {
    light();
    render(frame);
    clearInterval(lightTimer);
    if (setting.value === "local") {
      lightTimer = setInterval(() => {
        if (!document.hidden && !lost) {
          light();
          render(frame);
        }
      }, 60000);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && setting.value === "local") {
      light();
      render(frame);
    }
  });

  for (const button of inspect.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const base = window.scrollY + arrival.getBoundingClientRect().top;
      const length = arrival.offsetHeight - cover.offsetHeight;
      const shot = button.dataset.deskView;
      const terminalTop = desk.querySelector("#terminal").getBoundingClientRect().top + window.scrollY;
      const runway = desk.querySelector(".terminal-travel").offsetHeight + window.innerHeight * 0.47;
      const top = {
        card: base,
        desk: base + length * 0.64,
        folder: base + length * 0.99,
        crt: terminalTop - runway * 0.40,
      }[shot];
      window.scrollTo({ top, behavior: "smooth" });
    });
  }

  desk.classList.add("desk3d-ready");
  inspect.hidden = false;
  light();
  desk.dispatchEvent(new Event("desk3d-ready"));
}

start().catch((error) => console.warn("The desk illustration is available while the 3D scene loads.", error));
