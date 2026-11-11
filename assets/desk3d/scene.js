import * as THREE from "./vendor/three.module.min.js";
import { createTerminal } from "./crt.js";
import { createLamp } from "./lamp.js";
import { createOfficeBackdrop } from "./room.js";
import { makeCard, makeDesk, makeFolder, makeRoomReflection, makeTelephone } from "./props.js";

const desk = document.querySelector(".desk-story");
const backdrop = desk.querySelector(".desk-backdrop");
const view = desk.querySelector(".desk-render");
const inspect = desk.querySelector(".desk-inspect");
const arrival = desk.querySelector(".desk-arrival");
const profile = desk.querySelector(".profile-scene");
const cover = desk.querySelector(".cover");
const cardStage = cover.querySelector(".card-stage");
const cardFace = cardStage.querySelector(".business-card");
const motion = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 31rem)");
const textureUrls = {
  walnut: new URL("./walnut-albedo.webp", import.meta.url).href,
  manila: new URL("./manila-albedo.webp", import.meta.url).href,
  fiber: new URL("./manila-bump.webp", import.meta.url).href,
  officeDay: new URL("../office.webp", import.meta.url).href,
  officeNight: new URL("./office-night.webp", import.meta.url).href,
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
  day: {
    color: "#ffe5c5", sky: "#f2e4d4", key: 2.95, fill: 0.92, reflection: 0.51,
    lamp: 0, room: 0, warmth: 0, light: [-0.63, -0.61, 0.48],
  },
  dusk: {
    color: "#ffbc83", sky: "#ded4cf", key: 1.40, fill: 0.65, reflection: 0.36,
    lamp: 0.61, room: 0.46, warmth: 0.74, light: [-0.69, -0.46, 0.57],
  },
  night: {
    color: "#a9c8ee", sky: "#b4c6df", key: 0.08, fill: 0.41, reflection: 0.25,
    lamp: 1, room: 1, warmth: 0, light: [-0.40, -0.50, 0.77],
  },
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
    sky: new THREE.Color(from.sky).lerp(new THREE.Color(to.sky), amount),
    key: lerp(from.key, to.key, amount),
    fill: lerp(from.fill, to.fill, amount),
    reflection: lerp(from.reflection, to.reflection, amount),
    lamp: lerp(from.lamp, to.lamp, amount),
    room: lerp(from.room, to.room, amount),
    warmth: lerp(from.warmth, to.warmth, amount),
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
  let walnut, manila, fiber, officeDay, officeNight;
  try {
    [walnut, manila, fiber, officeDay, officeNight] = await Promise.all(
      Object.values(textureUrls).map((url) => loader.loadAsync(url)),
    );
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  walnut.colorSpace = manila.colorSpace = THREE.SRGBColorSpace;
  officeDay.colorSpace = officeNight.colorSpace = THREE.SRGBColorSpace;
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
  const dayReflection = makeRoomReflection(THREE);
  const nightReflection = makeRoomReflection(THREE, true);
  const room = createOfficeBackdrop(THREE, officeDay, officeNight);
  scene.add(room.backdrop);
  const camera = new THREE.PerspectiveCamera(39, 1, 0.8, 450);

  const key = new THREE.DirectionalLight("#ffe4bf", 2.85);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -75, right: 75, top: 65, bottom: -65, near: 1, far: 205 });
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.045;
  key.shadow.radius = 2.6;
  key.position.set(-86, 74, -34);
  const fill = new THREE.HemisphereLight("#f2e4d4", "#62503c", 0.88);
  scene.add(key, fill, key.target, makeDesk(THREE, walnut));

  const terminal = createTerminal(THREE);
  terminal.position.set(45, 0, -24);
  terminal.rotation.y = -0.28;
  scene.add(terminal);
  const { screen } = terminal.userData;
  const terminalAim = terminal.localToWorld(screen.center.clone());

  const telephone = makeTelephone(THREE);
  telephone.position.set(-51, 0, 4);
  telephone.rotation.y = 0.34;
  scene.add(telephone);
  const { folder, hinge } = makeFolder(THREE, manila, fiber);
  folder.position.set(8, 0, 14);
  folder.rotation.y = -0.27;
  scene.add(folder);

  const lamp = createLamp(THREE);
  lamp.position.set(-26, 0, -22);
  lamp.rotation.y = 0.56;
  scene.add(lamp);
  const pool = new THREE.SpotLight("#ffd39a", 0, 104, 0.86, 0.82, 2);
  pool.position.copy(lamp.localToWorld(lamp.userData.bulb.clone()));
  pool.target.position.set(10, 0, 18);
  pool.shadow.mapSize.set(1024, 1024);
  pool.shadow.camera.near = 0.5;
  pool.shadow.camera.far = 105;
  pool.shadow.bias = -0.00052;
  pool.shadow.normalBias = 0.068;
  pool.shadow.radius = 2.5;
  const lampBounce = new THREE.PointLight("#ffba79", 0, 31, 2);
  lampBounce.position.copy(pool.position).add(new THREE.Vector3(0, -3.5, 1.1));
  scene.add(pool, pool.target, lampBounce);

  const held = new THREE.Group();
  const card = makeCard(THREE, cardFace);
  held.add(card);
  scene.add(held);
  const shadow = createContactShadow();
  const cardShadow = shadow(-29, 29, 12, 7.5, 0.35);
  scene.add(shadow(45, -17, 53, 46, 0.52), shadow(-51, 4, 25, 24, 0.5),
    shadow(8, 14, 31, 36, 0.48), shadow(-26, -22, 23, 15, 0.36), cardShadow);
  const coverRoom = document.createElement("div");
  coverRoom.className = "desk-cover-room";
  coverRoom.setAttribute("aria-hidden", "true");
  cover.prepend(coverRoom);

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
    key.castShadow = look.key > 1.5;
    fill.color.set(look.sky);
    fill.intensity = look.fill;
    scene.environment = look.room > 0.6 ? nightReflection : dayReflection;
    scene.environmentIntensity = look.reflection;
    pool.intensity = 4100 * look.lamp;
    pool.castShadow = look.lamp > 0.2;
    lampBounce.intensity = 62 * look.lamp;
    lamp.userData.setGlow(look.lamp);
    room.setLight(look.room, look.warmth);
    uniforms.setProperty("--desk3d-night", look.room.toFixed(4));
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
    const folderEye = new THREE.Vector3(lerp(14, 9, portrait),
      lerp(58, 82 * portraitDistance, portrait), lerp(46, 14 + 25 * portraitDistance, portrait));
    const folderAim = new THREE.Vector3(lerp(-1.5, 8.4, portrait), 0.08, 14);
    const deskEye = new THREE.Vector3(lerp(-33, -36, portrait), lerp(58, 55, portrait), lerp(92, 102, portrait));
    const deskAim = new THREE.Vector3(lerp(-7, -25, portrait), 7.6, lerp(7.5, 10, portrait));
    shotEye.set(-38, 31, 59).lerp(deskEye, pulledBack).lerp(folderEye, close);
    target.set(-27, 10, 33).lerp(deskAim, pulledBack).lerp(folderAim, close);
    const reading = smooth(1 - profile.getBoundingClientRect().top / height, 0.02, 0.52) *
      (1 - smooth(exit, 0.02, 0.28));
    target.y += 9 * reading;
    target.z -= 25 * reading;
    if (exit > 0) {
      const turn = smooth(exit, 0.12, 0.60);
      const crossing = smooth(exit, 0.59, 0.86);
      const screenDistance = lerp(53, Math.max(80, 36 / (0.708 * camera.aspect)), portrait);
      shotEye.lerp(crtEye(screenDistance, 14), turn);
      shotEye.z += (1 - portrait * 0.7) * 11 * Math.sin(Math.PI * turn);
      shotEye.lerp(crtEye(4.5, 0.5), crossing);
      target.lerp(terminalAim, turn);
    }
    camera.position.copy(shotEye);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const placing = smooth(entry, 0.21, 0.62);
    held.position.set(lerp(-27, -29, placing), lerp(13, 0.048, placing), lerp(35, 29, placing));
    held.rotation.set(lerp(0.59, 0, placing), lerp(-0.075, 0.21, placing), 0, "YXZ");
    card.rotation.z = cardFace.classList.contains("is-flipped") ? Math.PI : 0;
    const cardOpacity = 1 - smooth(entry, 0.62, 0.69);
    card.visible = entry >= 0.62;
    cardShadow.position.x = held.position.x;
    cardShadow.position.z = held.position.z;
    cardShadow.scale.setScalar(lerp(1.5, 0.93, placing));
    cardShadow.material.opacity = lerp(0.09, 0.43, placing);
    hinge.rotation.z = (Math.PI - 0.012) * smooth(entry, 0.71, 0.96) * (1 - smooth(exit, 0.025, 0.35));
    hinge.userData.updateFold?.();
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

    const signature = [entry, exit, reading, card.rotation.z].join("/");
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
