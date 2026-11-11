// Units are centimetres. The tabletop is y = 0 and +z faces the visitor.
export function slab(THREE, width, depth, thickness, radius, bevel, materials) {
  const x = width / 2;
  const y = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, steps: 1, curveSegments: 5,
    bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3,
  });
  const points = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < points.count; i++) {
    uv.setXY(i, points.getX(i) / width + 0.5, points.getY(i) / depth + 0.5);
  }
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function canvasTexture(THREE, width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function flatPrint(THREE, width, depth, texture) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.87, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

function printGrain(ctx, width, height, background) {
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  let seed = 256;
  for (let i = 0; i < 14000; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const x = seed / 4294967296 * width;
    seed = (1664525 * seed + 1013904223) >>> 0;
    const y = seed / 4294967296 * height;
    ctx.fillStyle = i % 2 ? "#fff8e740" : "#6f482316";
    ctx.fillRect(x, y, 1 + i % 3, 1);
  }
}

export function makeDesk(THREE, grain) {
  const wood = new THREE.MeshPhysicalMaterial({
    map: grain, color: "#f7eadc", roughness: 0.50, clearcoat: 0.22, clearcoatRoughness: 0.55,
  });
  const endGrain = new THREE.MeshStandardMaterial({ color: "#553321", roughness: 0.60 });
  const base = slab(THREE, 147, 88, 3.0, 1.1, 0.34, [wood, endGrain]);
  base.position.y = -1.84;
  base.castShadow = false;
  const desk = new THREE.Group();
  desk.add(base);
  const apron = slab(THREE, 144.5, 84, 5.3, 0.8, 0.22, endGrain);
  apron.position.y = -5.82;
  apron.castShadow = false;
  desk.add(apron);
  return desk;
}

export function makeFolder(THREE, colorMap, bumpMap) {
  const width = 23.9;
  const depth = 30.4;
  const manila = new THREE.MeshStandardMaterial({
    color: "#fcf0de", map: colorMap, bumpMap, bumpScale: 0.022, roughness: 0.87,
  });
  const edge = new THREE.MeshStandardMaterial({ color: "#ad8350", roughness: 0.92 });
  const paperEdge = new THREE.MeshStandardMaterial({ color: "#e7dcc5", roughness: 0.91 });
  const folder = new THREE.Group();
  const base = slab(THREE, width, depth, 0.13, 0.33, 0.027, [manila, edge]);
  base.position.y = 0.105;
  folder.add(base);

  const tab = slab(THREE, 7.6, 2.1, 0.125, 0.34, 0.027, [manila, edge]);
  tab.position.set(6.5, 0.103, -15.65);
  folder.add(tab);

  for (let i = 0; i < 3; i++) {
    const sheet = slab(THREE, 21.6, 27.9, 0.029, 0.055, 0.012, paperEdge);
    sheet.position.set(0.28 + i * 0.06, 0.215 + i * 0.047, 0.12 - i * 0.055);
    sheet.rotation.y = 0.016 - i * 0.009;
    folder.add(sheet);
  }

  const pageTexture = canvasTexture(THREE, 864, 1116, (ctx, w, h) => {
    printGrain(ctx, w, h, "#f3ebdc");
    ctx.fillStyle = "#60483a";
    ctx.font = "19px monospace";
    ctx.fillText("PERSONAL PROFILE", 66, 81);
    ctx.textAlign = "right";
    ctx.fillText("ABU DHABI, UAE", w - 66, 81);
    ctx.textAlign = "left";
    ctx.fillStyle = "#9f8c71";
    ctx.fillRect(66, 105, w - 132, 2);
    ctx.fillStyle = "#35291e";
    ctx.font = "80px Baskerville, Georgia, serif";
    ctx.fillText("Qinrong Cui", 61, 229);
    ctx.fillStyle = "#7a453b";
    ctx.font = "italic 30px Baskerville, Georgia, serif";
    ctx.fillText("Graduate research in natural language processing", 66, 283);
    ctx.fillStyle = "#3d3228";
    ctx.font = "33px Baskerville, Georgia, serif";
    [
      "I study how to evaluate multimodal models,",
      "especially how well they understand images",
      "and generate video.",
    ].forEach((line, index) => ctx.fillText(line, 66, 383 + index * 51));
    ctx.fillStyle = "#9f8c71";
    ctx.fillRect(66, 555, w - 132, 2);
    ctx.fillStyle = "#7a453b";
    ctx.font = "21px monospace";
    ctx.fillText("EDUCATION", 66, 616);
    ctx.fillText("RESEARCH INTERESTS", 451, 616);
    ctx.fillStyle = "#3d3228";
    ctx.font = "27px Baskerville, Georgia, serif";
    ctx.fillText("MBZUAI", 66, 674);
    ctx.fillText("Multimodal language models", 451, 674);
    ctx.fillText("Northeastern University", 66, 772);
    ctx.fillText("Video generation evaluation", 451, 730);
    ctx.fillText("Benchmark development", 451, 786);
    ctx.font = "22px Baskerville, Georgia, serif";
    ctx.fillText("M.Sc. Natural Language Processing", 66, 709);
    ctx.fillText("B.S. Computer Science", 66, 807);
    ctx.fillStyle = "#9f8c71";
    ctx.fillRect(66, 914, w - 132, 2);
    ctx.fillStyle = "#60483a";
    ctx.font = "19px monospace";
    ctx.fillText("QINRONG CUI", 66, 967);
  });
  const page = flatPrint(THREE, 21.59, 27.89, pageTexture);
  page.position.set(0.4, 0.344, 0.01);
  page.rotation.z = 0.002;
  folder.add(page);

  const hinge = new THREE.Group();
  hinge.position.set(-width / 2, 0.41, 0);
  const lid = slab(THREE, width, depth, 0.13, 0.38, 0.029, [manila, edge]);
  lid.position.x = width / 2;
  hinge.add(lid);

  const labelTexture = canvasTexture(THREE, 520, 222, (ctx, w, h) => {
    printGrain(ctx, w, h, "#e5d7bb");
    ctx.strokeStyle = "#9e8461";
    ctx.lineWidth = 3;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = "#725442";
    ctx.font = "22px monospace";
    ctx.fillText("PERSONAL FILE", 35, 61);
    ctx.font = "58px Baskerville, Georgia, serif";
    ctx.fillText("Qinrong Cui", 34, 151);
  });
  const label = flatPrint(THREE, 11.5, 4.91, labelTexture);
  label.position.set(width - 7.1, 0.10, -9.1);
  label.rotation.z = -0.055;
  hinge.add(label);
  folder.add(hinge);
  return { folder, hinge };
}

export function makeCard(THREE, source) {
  const card = new THREE.Group();
  const edge = new THREE.MeshStandardMaterial({ color: "#ddd0b4", roughness: 0.92 });
  card.add(slab(THREE, 8.9, 5.08, 0.043, 0.035, 0.011, edge));
  const paper = canvasTexture(THREE, 896, 512, (ctx, w, h) => {
    printGrain(ctx, w, h, "#f3ead9");
    ctx.fillStyle = "#33291f";
    ctx.font = "26px Copperplate, Georgia, serif";
    ctx.fillText(source.querySelector(".card-phone").textContent.trim(), 53, 78);
    ctx.textAlign = "right";
    ctx.font = "34px Copperplate, Georgia, serif";
    ctx.fillText("MBZUAI", w - 53, 74);
    ctx.font = "19px Copperplate, Georgia, serif";
    ctx.fillText("NATURAL LANGUAGE PROCESSING", w - 53, 103);
    ctx.textAlign = "center";
    ctx.font = "59px Copperplate, Georgia, serif";
    ctx.fillText("QINRONG CUI", w / 2, 266);
    ctx.font = "29px Copperplate, Georgia, serif";
    ctx.fillText("GRADUATE RESEARCHER", w / 2, 306);
    ctx.font = "23px Copperplate, Georgia, serif";
    ctx.fillText("BEIJING / ABU DHABI", w / 2, 415);
    ctx.fillText(source.querySelector(".card-details a").textContent.trim(), w / 2, 450);
  });
  const front = flatPrint(THREE, 8.9, 5.08, paper);
  front.position.y = 0.035;
  card.add(front);
  const reverse = canvasTexture(THREE, 896, 512, (ctx, w, h) => {
    printGrain(ctx, w, h, "#f3ead9");
    ctx.fillStyle = "#33291f";
    ctx.font = "43px Copperplate, Georgia, serif";
    ctx.fillText("CONTACT", 65, 104);
    ctx.font = "23px Copperplate, Georgia, serif";
    [...source.querySelectorAll(".card-contact-list > div")].forEach((row, index) => {
      const y = 187 + index * 68;
      ctx.textAlign = "left";
      ctx.fillText(row.querySelector("dt").textContent.toUpperCase(), 65, y);
      ctx.textAlign = "right";
      ctx.fillText(row.querySelector("dd").textContent.trim(), w - 65, y);
    });
  });
  const back = flatPrint(THREE, 8.9, 5.08, reverse);
  back.position.y = -0.035;
  back.rotation.set(Math.PI / 2, Math.PI, 0, "YXZ");
  card.add(back);
  return card;
}

export function makeTelephone(THREE) {
  const rubber = new THREE.MeshPhysicalMaterial({
    color: "#282421", roughness: 0.55, clearcoat: 0.28, clearcoatRoughness: 0.45,
  });
  const keys = new THREE.MeshStandardMaterial({ color: "#635747", roughness: 0.64 });
  const phone = new THREE.Group();
  const base = slab(THREE, 18.8, 18, 3.1, 1.15, 0.51, rubber);
  base.position.y = 2.1;
  phone.add(base);
  const shoulders = slab(THREE, 16.8, 6.1, 1.95, 0.8, 0.37, rubber);
  shoulders.position.set(0, 4.3, -4.65);
  phone.add(shoulders);
  const handle = slab(THREE, 18.2, 4.5, 2.1, 1.65, 0.46, rubber);
  handle.position.set(0, 6.3, -4.9);
  phone.add(handle);
  for (const x of [-7.5, 7.5]) {
    const earpiece = slab(THREE, 4.7, 5.5, 1.05, 1.1, 0.29, rubber);
    earpiece.position.set(x, 5.25, -4.75);
    phone.add(earpiece);
  }
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 3; column++) {
      const key = slab(THREE, 1.33, 0.92, 0.19, 0.13, 0.06, keys);
      key.position.set((column - 1) * 1.82, 4.27, 0.28 + row * 1.35);
      phone.add(key);
    }
  }
  const cablePath = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-9.3, 5, -4.9), new THREE.Vector3(-18.3, 1.15, -3),
    new THREE.Vector3(-16.1, 0.64, 11.4), new THREE.Vector3(-9.6, 0.65, 7.6),
  );
  const coils = [];
  for (let index = 0; index <= 144; index++) {
    const progress = index / 144;
    const center = cablePath.getPoint(progress);
    const tangent = cablePath.getTangent(progress);
    const phase = progress * Math.PI * 32;
    const radius = 0.45 * Math.sin(Math.PI * progress) ** 0.32;
    center.x += tangent.z * radius * Math.cos(phase);
    center.z -= tangent.x * radius * Math.cos(phase);
    center.y += radius * Math.sin(phase);
    coils.push(center);
  }
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coils), 180, 0.13, 5, false), rubber);
  cord.receiveShadow = true;
  phone.add(cord);
  return phone;
}

export function makeRoomReflection(THREE) {
  const texture = canvasTexture(THREE, 512, 256, (ctx, w, h) => {
    const room = ctx.createLinearGradient(0, 0, 0, h);
    room.addColorStop(0, "#8c7963");
    room.addColorStop(0.5, "#735b43");
    room.addColorStop(1, "#221914");
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, w, h);
    const window = ctx.createRadialGradient(114, 89, 7, 114, 89, 95);
    window.addColorStop(0, "#fff5dc");
    window.addColorStop(0.44, "#d8b692");
    window.addColorStop(1, "#d8b69200");
    ctx.fillStyle = window;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff7e2";
    ctx.fillRect(82, 48, 25, 69);
    ctx.fillRect(113, 48, 25, 69);
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}
