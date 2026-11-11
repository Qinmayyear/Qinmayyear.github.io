const cornerSteps = 8;

function roundedOutline(width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centers = [
    [halfWidth - radius, halfHeight - radius],
    [-halfWidth + radius, halfHeight - radius],
    [-halfWidth + radius, -halfHeight + radius],
    [halfWidth - radius, -halfHeight + radius],
  ];

  return centers.flatMap(([x, y], corner) =>
    Array.from({ length: cornerSteps + 1 }, (_, step) => {
      const angle = (corner + step / cornerSteps) * Math.PI / 2;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    })
  );
}

// Each profile specifies depth, width, height, corner radius, and optional rise.
function profileGeometry(THREE, profiles, { back = true, front = true } = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const rings = profiles.map(([, width, height, radius]) =>
    roundedOutline(width, height, radius)
  );
  const count = rings[0].length;
  const stride = count + 1;

  rings.forEach((outline, layer) => {
    const [depth, , , , rise = 0] = profiles[layer];
    for (let side = 0; side <= count; side += 1) {
      const [x, y] = outline[side % count];
      positions.push(x, y + rise, depth);
      uvs.push(side / count, layer / (rings.length - 1));
    }
  });

  for (let layer = 0; layer < rings.length - 1; layer += 1) {
    for (let side = 0; side < count; side += 1) {
      const lower = layer * stride + side;
      const upper = lower + stride;
      indices.push(lower, lower + 1, upper + 1, lower, upper + 1, upper);
    }
  }

  function cap(layer, facingFront) {
    const [depth, width, height, , rise = 0] = profiles[layer];
    const center = positions.length / 3;
    positions.push(0, rise, depth);
    uvs.push(0.5, 0.5);
    for (const [x, y] of rings[layer]) {
      positions.push(x, y + rise, depth);
      uvs.push(x / width + 0.5, y / height + 0.5);
    }
    for (let side = 0; side < count; side += 1) {
      const from = center + 1 + side;
      const to = center + 1 + (side + 1) % count;
      indices.push(center, facingFront ? from : to, facingFront ? to : from);
    }
  }

  if (back) cap(0, false);
  if (front) cap(rings.length - 1, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addProfile(THREE, parent, material, profiles, y = 0, caps) {
  const part = new THREE.Mesh(profileGeometry(THREE, profiles, caps), material);
  part.position.y = y;
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function canvasTexture(THREE, width, height, draw, isColor = true) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function plasticGrain(THREE) {
  const texture = canvasTexture(THREE, 128, 128, (context, width, height) => {
    const noise = context.createImageData(width, height);
    let seed = 137;
    for (let pixel = 0; pixel < noise.data.length; pixel += 4) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const gray = 102 + (seed >>> 26);
      noise.data.set([gray, gray, gray, 255], pixel);
    }
    context.putImageData(noise, 0, 0);
  }, false);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

function createScreen(THREE, parent) {
  const width = 26.35;
  const height = 19.5;
  const centerY = 19.75;
  const edgeZ = 12.1;
  const bulge = 0.73;
  const outline = roundedOutline(width, height, 2.25);
  const positions = [0, centerY, edgeZ + bulge];
  const uvs = [0.5, 0.5];
  const indices = [];
  const rings = 12;

  for (let ring = 1; ring <= rings; ring += 1) {
    const scale = ring / rings;
    const depth = edgeZ + bulge * (1 - scale * scale);
    for (const [x, y] of outline) {
      positions.push(x * scale, centerY + y * scale, depth);
      uvs.push(0.5 + x * scale / width, 0.5 + y * scale / height);
    }
  }

  for (let side = 0; side < outline.length; side += 1) {
    const nextSide = (side + 1) % outline.length;
    indices.push(0, side + 1, nextSide + 1);
    for (let ring = 1; ring < rings; ring += 1) {
      const from = (ring - 1) * outline.length + side + 1;
      const to = (ring - 1) * outline.length + nextSide + 1;
      indices.push(from, from + outline.length, to + outline.length, from, to + outline.length, to);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const reflectedWindow = canvasTexture(THREE, 512, 384, (context, w, h) => {
    const tint = context.createRadialGradient(w * 0.29, h * 0.23, 0, w * 0.42, h * 0.35, w * 0.74);
    tint.addColorStop(0, "#4a493b");
    tint.addColorStop(0.42, "#2a2c23");
    tint.addColorStop(1, "#111411");
    context.fillStyle = tint;
    context.fillRect(0, 0, w, h);

    context.save();
    context.translate(100, 34);
    context.rotate(-0.17);
    const reflection = context.createLinearGradient(10, -25, 245, 185);
    reflection.addColorStop(0, "rgba(220, 213, 181, .25)");
    reflection.addColorStop(0.6, "rgba(177, 186, 166, .06)");
    reflection.addColorStop(1, "rgba(177, 186, 166, 0)");
    context.fillStyle = reflection;
    context.fillRect(0, 0, 127, 162);
    context.fillRect(137, 0, 124, 162);
    context.restore();

    const vignette = context.createRadialGradient(w * 0.5, h * 0.46, w * 0.24, w * 0.5, h * 0.46, w * 0.64);
    vignette.addColorStop(0, "rgba(8, 9, 7, 0)");
    vignette.addColorStop(1, "rgba(6, 7, 5, .76)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, w, h);
  });

  const phosphor = canvasTexture(THREE, 512, 384, (context, width, height) => {
    context.fillStyle = "#080500";
    context.fillRect(0, 0, width, height);
    context.font = '36px "Courier New", monospace';
    context.textBaseline = "middle";
    context.shadowColor = "#c47925";
    context.shadowBlur = 10;
    context.fillStyle = "#f6bc76";
    context.fillText("Guestbook_", 58, height * 0.49);
    context.shadowBlur = 0;
    context.fillStyle = "rgba(3, 3, 1, .31)";
    for (let line = 0; line < height; line += 4) {
      context.fillRect(0, line, width, 1);
    }
  });

  const material = new THREE.MeshPhysicalMaterial({
    map: reflectedWindow,
    roughness: 0.29,
    clearcoat: 0.65,
    clearcoatRoughness: 0.28,
    emissive: 0xffdfb3,
    emissiveMap: phosphor,
    emissiveIntensity: 0.16,
  });
  const screen = new THREE.Mesh(geometry, material);
  screen.name = "Convex CRT glass";
  parent.add(screen);
  return {
    center: new THREE.Vector3(0, centerY, edgeZ + bulge),
    width,
    height,
    setGlow(value) {
      material.emissiveIntensity = 0.16 + 1.24 * THREE.MathUtils.clamp(value, 0, 1);
    },
  };
}

function addMonitorVents(THREE, parent, material) {
  const shape = new THREE.Shape(roundedOutline(0.36, 1.06, 0.17).map(
    ([x, y]) => new THREE.Vector2(x, y)
  ));
  const slotsPerRow = 16;
  const rows = 3;
  const slots = new THREE.InstancedMesh(new THREE.ShapeGeometry(shape), material, slotsPerRow * rows * 2);
  const pose = new THREE.Object3D();
  let index = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < slotsPerRow; column += 1) {
        const z = -8.0 + column * 0.73;
        const halfWidth = 15.04 + (z + 9) * 0.066;
        pose.position.set(side * (halfWidth + 0.035), 24.85 - row * 1.47, z);
        pose.rotation.y = side * (Math.PI / 2 - Math.atan(0.066));
        pose.updateMatrix();
        slots.setMatrixAt(index, pose.matrix);
        index += 1;
      }
    }
  }
  slots.instanceMatrix.needsUpdate = true;
  slots.receiveShadow = true;
  parent.add(slots);
}

function labelPlate(THREE, parent, x, y, width, label) {
  const print = canvasTexture(THREE, 384, 64, (context, w, h) => {
    context.font = '500 27px "Courier New", monospace';
    context.textBaseline = "middle";
    context.fillStyle = "#4c4c3b";
    context.fillText(label, 4, h / 2);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 6),
    new THREE.MeshStandardMaterial({ map: print, transparent: true, depthWrite: false, roughness: 0.8 }));
  plate.position.set(x, y, 13.97);
  parent.add(plate);
}

function createKeyboard(THREE, parent, material, recess, grain) {
  const keyboard = new THREE.Group();
  keyboard.name = "Sculpted beige keyboard";
  keyboard.position.set(0, 1.15, 22.85);
  keyboard.rotation.x = 0.08;
  parent.add(keyboard);

  const shell = addProfile(THREE, keyboard, material, [
    [-0.45, 41.8, 13.6, 0.95],
    [-0.32, 42.5, 14.25, 1.0],
    [0.37, 42.85, 14.7, 1.18],
    [0.63, 42.6, 14.5, 1.12],
    [0.78, 41.9, 13.85, 0.96],
  ]);
  shell.rotation.x = -Math.PI / 2;
  const bed = addProfile(THREE, keyboard, recess, [
    [0.78, 41.15, 12.18, 0.57],
    [0.83, 41.08, 12.13, 0.52],
  ]);
  bed.rotation.x = -Math.PI / 2;
  bed.position.z = 0.13;
  bed.castShadow = false;

  const keys = [];
  const pitch = 1.79;
  function row(start, z, caps, depth = 1.61) {
    let x = start;
    for (const entry of caps) {
      const [label, units = 1, modifier = false, tall = 1] = Array.isArray(entry) ? entry : [entry];
      if (label !== null) {
        keys.push({
          label,
          x: x + units * pitch / 2,
          z: z + (tall - 1) * 0.92,
          width: units * pitch - 0.14,
          depth: depth * tall + (tall - 1) * 0.2,
          modifier,
        });
      }
      x += units * pitch;
    }
  }

  const left = -20.47;
  const nav = 7.1;
  const numeric = 13.45;
  row(left, -5.29, [["Esc", 1, true]], 1.22);
  row(-16.61, -5.29, ["F1", "F2", "F3", "F4"], 1.22);
  row(-8.54, -5.29, ["F5", "F6", "F7", "F8"], 1.22);
  row(-0.48, -5.29, ["F9", "F10", "F11", "F12"], 1.22);
  row(nav, -5.29, [["Prt", 1, true], ["Scr", 1, true], ["Pse", 1, true]], 1.22);
  row(left, -3.48, ["~", ..."1234567890", "-", "=", ["Back", 2, true]]);
  row(left, -1.64, [["Tab", 1.5, true], ..."QWERTYUIOP", "[", "]", ["\\", 1.5]]);
  row(left, 0.20, [["Caps", 1.75, true], ..."ASDFGHJKL", ";", "'", ["Enter", 2.25, true]]);
  row(left, 2.04, [["Shift", 2.25, true], ..."ZXCVBNM", ",", ".", "/", ["Shift", 2.75, true]]);
  row(left, 3.88, [["Ctrl", 1.5, true], [null, 1.15], ["Alt", 1.4, true], ["", 6.8],
    ["Alt", 1.4, true], [null, 1.25], ["Ctrl", 1.5, true]]);
  row(nav, -3.48, [["Ins", 1, true], ["Home", 1, true], ["PgUp", 1, true]]);
  row(nav, -1.64, [["Del", 1, true], ["End", 1, true], ["PgDn", 1, true]]);
  row(nav + pitch, 2.04, [["↑", 1, true]]);
  row(nav, 3.88, [["←", 1, true], ["↓", 1, true], ["→", 1, true]]);
  row(numeric, -3.48, [["Num", 1, true], "/", "*", "-"]);
  row(numeric, -1.64, ["7", "8", "9", ["+", 1, true, 2]]);
  row(numeric, 0.20, ["4", "5", "6"]);
  row(numeric, 2.04, ["1", "2", "3", ["Ent", 1, true, 2]]);
  row(numeric, 3.88, [["0", 2], "."]);

  const caps = new Map();
  const regularCap = new THREE.MeshStandardMaterial({
    color: 0xd7c9ac,
    roughness: 0.67,
    bumpMap: grain,
    bumpScale: 0.011,
  });
  const darkCap = new THREE.MeshStandardMaterial({
    color: 0xa99a80,
    roughness: 0.7,
    bumpMap: grain,
    bumpScale: 0.011,
  });
  for (const key of keys) {
    const size = [key.width, key.depth, key.modifier].join(",");
    if (!caps.has(size)) caps.set(size, []);
    caps.get(size).push(key);
  }

  const pose = new THREE.Object3D();
  pose.rotation.x = -Math.PI / 2;
  for (const group of caps.values()) {
    const { width, depth, modifier } = group[0];
    const geometry = profileGeometry(THREE, [
      [0.81, width, depth, 0.16],
      [0.98, width, depth, 0.18],
      [1.47, width - 0.27, depth - 0.27, 0.2],
      [1.57, width - 0.37, depth - 0.37, 0.18],
    ], { back: false });
    const instances = new THREE.InstancedMesh(geometry, modifier ? darkCap : regularCap, group.length);
    group.forEach((key, index) => {
      pose.position.set(key.x, 0, key.z);
      pose.updateMatrix();
      instances.setMatrixAt(index, pose.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.receiveShadow = true;
    keyboard.add(instances);
  }

  const artWidth = 42.5;
  const artDepth = 14.2;
  const legend = canvasTexture(THREE, 1536, 512, (context, width, height) => {
    const xScale = width / artWidth;
    const zScale = height / artDepth;
    context.textAlign = "left";
    context.textBaseline = "top";
    for (const key of keys) {
      if (!key.label) continue;
      const size = key.label.length > 1 ? 0.33 : 0.44;
      context.font = "600 " + size * zScale + "px Arial, sans-serif";
      context.fillStyle = key.modifier ? "#333229" : "#484438";
      context.fillText(key.label,
        (key.x - key.width / 2 + 0.35 + artWidth / 2) * xScale,
        (key.z - key.depth / 2 + 0.34 + artDepth / 2) * zScale);
    }
  });
  const legendPlane = new THREE.Mesh(new THREE.PlaneGeometry(artWidth, artDepth),
    new THREE.MeshStandardMaterial({ map: legend, roughness: 0.7, transparent: true, depthWrite: false }));
  legendPlane.rotation.x = -Math.PI / 2;
  legendPlane.position.y = 1.581;
  keyboard.add(legendPlane);

  const indicator = new THREE.MeshStandardMaterial({
    color: 0x777954,
    emissive: 0x929148,
    emissiveIntensity: 0.25,
  });
  for (let index = 0; index < 3; index += 1) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.19), indicator);
    lamp.position.set(15.0 + 1.75 * index, 0.88, -5.22);
    keyboard.add(lamp);
  }
}

export function createTerminal(THREE) {
  const group = new THREE.Group();
  group.name = "Beige CRT workstation";
  const grain = plasticGrain(THREE);
  const housing = new THREE.MeshStandardMaterial({
    color: 0xb9a78a,
    roughness: 0.68,
    bumpMap: grain,
    bumpScale: 0.028,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x9d8f76,
    roughness: 0.65,
    bumpMap: grain,
    bumpScale: 0.014,
  });
  const bezel = new THREE.MeshStandardMaterial({
    color: 0xc2b095,
    roughness: 0.62,
    bumpMap: grain,
    bumpScale: 0.022,
  });
  const groove = new THREE.MeshStandardMaterial({ color: 0x423b2e, roughness: 0.89 });
  const gasket = new THREE.MeshStandardMaterial({ color: 0x272821, roughness: 0.74 });

  const stand = addProfile(THREE, group, housing, [
    [0.0, 31.2, 24.2, 2.2],
    [0.35, 33.5, 26.6, 2.65],
    [1.15, 34.1, 27.1, 2.85],
    [1.95, 33.3, 26.35, 2.6],
    [2.52, 31.2, 24.2, 2.32],
  ]);
  stand.rotation.x = -Math.PI / 2;
  const pivot = addProfile(THREE, group, trim, [
    [2.48, 25.6, 20.8, 3.5],
    [3.1, 25.5, 20.7, 3.5],
    [4.25, 23.8, 19.8, 3.28],
  ]);
  pivot.rotation.x = -Math.PI / 2;

  addProfile(THREE, group, housing, [
    [-16.0, 26.1, 22.25, 2.04, 0.31],
    [-15.7, 27.85, 23.65, 2.1, 0.21],
    [-14.55, 29.35, 25.5, 2.28, 0.08],
    [-9.0, 30.08, 26.55, 2.3],
    [5.8, 32.03, 27.64, 2.24],
    [10.5, 32.7, 27.9, 2.19],
    [10.84, 32.52, 27.8, 2.12],
  ], 18.25, { front: false });
  addProfile(THREE, group, groove, [
    [10.69, 32.6, 27.8, 2.14],
    [11.12, 32.71, 27.8, 2.14],
  ], 18.25, { back: false, front: false });
  addProfile(THREE, group, bezel, [
    [11.00, 32.75, 27.85, 2.15],
    [11.34, 33.24, 28.24, 2.16],
    [12.37, 33.55, 28.54, 2.22],
    [13.41, 33.25, 28.2, 2.2],
    [13.86, 32.67, 27.58, 2.0],
    [13.92, 28.54, 22.13, 2.46, 1.34],
    [13.65, 27.86, 21.46, 2.32, 1.48],
    [12.4, 27.13, 20.38, 2.22, 1.5],
  ], 18.25, { back: false, front: false });
  const surround = addProfile(THREE, group, gasket, [
    [12.42, 27.17, 20.43, 2.22],
    [12.54, 26.83, 20.03, 2.27],
    [12.18, 26.31, 19.47, 2.25],
    [11.88, 26.28, 19.42, 2.25],
  ], 19.75, { back: false, front: false });
  surround.castShadow = false;

  group.userData.screen = createScreen(THREE, group);
  labelPlate(THREE, group, -9.15, 6.94, 9.6, "COLOR DISPLAY");
  addMonitorVents(THREE, group, groove);

  const controlRecess = addProfile(THREE, group, trim, [
    [13.84, 6.55, 1.22, 0.36],
    [14.01, 6.28, 1.04, 0.32],
  ], 6.85);
  controlRecess.position.x = 10.88;
  controlRecess.castShadow = false;
  for (const x of [9.35, 11.08]) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.43, 0.27, 24), gasket);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(x, 6.86, 14.05);
    group.add(dial);
  }
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xc19049,
    emissive: 0xffa839,
    emissiveIntensity: 0.56,
    roughness: 0.36,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 10), lampMaterial);
  lamp.scale.z = 0.42;
  lamp.position.set(13.06, 6.86, 14.07);
  group.add(lamp);

  createKeyboard(THREE, group, bezel, groove, grain);
  return group;
}
