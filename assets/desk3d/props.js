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

const stockClamp = (value) => Math.min(1, Math.max(0, value));
const stockEase = (value) => {
  const t = stockClamp(value);
  return t * t * (3 - 2 * t);
};

function paperPiece(THREE, width, depth, thickness, radius, materials, options = {}) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const { tab, place = (x, z) => [x, z], columns = 20, rows = 18 } = options;
  const xCuts = Array.from({ length: columns + 1 }, (_, index) => width * index / columns - halfWidth);
  for (const sign of [-1, 1]) {
    for (const step of [0.28, 0.63, 1]) xCuts.push(sign * (halfWidth - step * radius));
  }
  if (tab) {
    for (const step of [0, 0.35, 0.70, 1]) {
      xCuts.push(tab.start + tab.shoulder * step, tab.end - tab.shoulder * step);
    }
  }
  const cuts = xCuts.sort((a, b) => a - b).filter((cut, index, all) => index === 0 || cut - all[index - 1] > 0.001);
  const bands = [0, 0.013, ...Array.from({ length: rows - 1 }, (_, index) => (index + 1) / rows), 0.987, 1];
  const points = [];
  for (const blend of bands) {
    for (const x of cuts) {
      const round = Math.max(0, Math.abs(x) - halfWidth + radius);
      const inset = radius - Math.sqrt(Math.max(0, radius * radius - round * round));
      const extension = tab ? tab.depth * stockEase(Math.min(x - tab.start, tab.end - x) / tab.shoulder) : 0;
      const back = -halfDepth + inset - extension;
      const front = halfDepth - inset;
      const z = back + (front - back) * blend;
      points.push({ position: place(x, z), uv: [x / width + 0.5, 0.5 - z / depth] });
    }
  }

  const count = points.length;
  const stride = cuts.length;
  const end = bands.length - 1;
  const positions = [];
  const uvs = [];
  const surfaces = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();
  function vertex({ position: [x, z], uv }, side) {
    const index = surfaces.length;
    positions.push(x, 0, z);
    uvs.push(...uv);
    surfaces.push(side * thickness / 2);
    return index;
  }
  for (const side of [1, -1]) {
    const offset = side === 1 ? 0 : count;
    const start = indices.length;
    for (const point of points) vertex(point, side);
    for (let row = 0; row < end; row++) {
      for (let column = 0; column < stride - 1; column++) {
        const a = offset + row * stride + column;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (side === 1) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
    geometry.addGroup(start, indices.length - start, side === 1 ? 0 : 1);
  }

  const rim = [];
  for (let column = 0; column < stride; column++) rim.push(column);
  for (let row = 1; row <= end; row++) rim.push(row * stride + stride - 1);
  for (let column = stride - 2; column >= 0; column--) rim.push(end * stride + column);
  for (let row = end - 1; row > 0; row--) rim.push(row * stride);
  const sideStart = indices.length;
  for (let index = 0; index < rim.length; index++) {
    const first = points[rim[index]];
    const next = points[rim[(index + 1) % rim.length]];
    const a = vertex(first, 1);
    const b = vertex(next, 1);
    const c = vertex(first, -1);
    const d = vertex(next, -1);
    indices.push(a, b, c, b, d, c);
  }
  geometry.addGroup(sideStart, indices.length - sideStart, 2);
  const position = new THREE.Float32BufferAttribute(positions, 3);
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return {
    mesh,
    shape(heightAt) {
      for (let index = 0; index < position.count; index++) {
        position.setY(index, heightAt(position.getX(index), position.getZ(index)) + surfaces[index]);
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    },
  };
}

function folderSpine(THREE, depth, material) {
  const bends = 12;
  const bands = 18;
  const geometry = new THREE.PlaneGeometry(1, depth, bends, bands);
  const position = geometry.getAttribute("position");
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return {
    mesh,
    bend(angle, base, lid, reach) {
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      for (let row = 0; row <= bands; row++) {
        const z = (row / bands - 0.5) * depth;
        const [startX, startY] = base(z);
        const [endX, endY] = lid(z);
        const p1x = startX - reach;
        const p2x = endX - reach * cosine;
        const p2y = endY - reach * sine;
        for (let column = 0; column <= bends; column++) {
          const t = column / bends;
          const s = 1 - t;
          const x = s ** 3 * startX + 3 * s * s * t * p1x + 3 * s * t * t * p2x + t ** 3 * endX;
          const y = (s ** 3 + 3 * s * s * t) * startY + 3 * s * t * t * p2y + t ** 3 * endY;
          position.setXYZ(row * (bends + 1) + column, x, y, z);
        }
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}

export function makeFolder(THREE, colorMap, bumpMap) {
  const width = 23.9;
  const depth = 30.4;
  const manila = new THREE.MeshStandardMaterial({
    color: "#fcf0de", map: colorMap, bumpMap, bumpScale: 0.034, roughness: 0.88,
  });
  const inside = manila.clone();
  inside.color.set("#f9eee0");
  const edge = new THREE.MeshStandardMaterial({ color: "#ba945f", roughness: 0.93 });
  const paperEdge = new THREE.MeshStandardMaterial({ color: "#d8cbb3", roughness: 0.94 });
  const paper = new THREE.MeshStandardMaterial({ color: "#eee5d2", roughness: 0.92 });
  const folder = new THREE.Group();
  const baseHeight = (x, z) => {
    const foldOffset = (x + width / 2 - 0.24) / 0.23;
    const crease = Math.exp(-foldOffset * foldOffset);
    const perimeter = stockClamp(Math.abs(x) / (width / 2)) ** 5 * stockClamp(Math.abs(z) / (depth / 2)) ** 5;
    return 0.068 + 0.014 * crease + 0.049 * perimeter + 0.008 * Math.sin(0.37 * z + 0.18 * x);
  };
  const base = paperPiece(THREE, width, depth, 0.086, 0.34, [inside, manila, edge], {
    tab: { start: 2.42, end: 10.38, depth: 1.48, shoulder: 0.82 },
    columns: 26,
  });
  base.shape(baseHeight);
  folder.add(base.mesh);

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
  const printedPaper = new THREE.MeshStandardMaterial({ map: pageTexture, roughness: 0.92 });
  const sheets = [
    { x: 0.21, z: 0.16, yaw: -0.021, height: 0.148 },
    { x: 0.36, z: 0.22, yaw: 0.017, height: 0.177 },
    { x: 0.19, z: -0.10, yaw: -0.007, height: 0.204 },
    { x: 0.35, z: 0.03, yaw: 0.006, height: 0.233 },
  ];
  for (const [index, sheet] of sheets.entries()) {
    const top = index === sheets.length - 1;
    const piece = paperPiece(THREE, 21.59, 27.89, 0.019, 0.075,
      [top ? printedPaper : paper, paper, paperEdge], { columns: 16, rows: 16 });
    piece.shape((x, z) => {
      const curl = stockClamp((x + 3) / 14) ** 4 * stockClamp((z + 2) / 16) ** 4;
      return sheet.height + 0.031 * curl + 0.006 * Math.sin(x * 0.25 - z * 0.22);
    });
    piece.mesh.position.set(sheet.x, 0, sheet.z);
    piece.mesh.rotation.y = sheet.yaw;
    folder.add(piece.mesh);
  }

  const hinge = new THREE.Group();
  const seamX = -width / 2;
  hinge.position.x = seamX;
  const lid = paperPiece(THREE, width, depth, 0.081, 0.39, [manila, inside, edge], {
    place: (x, z) => [x + width / 2, z],
    columns: 26,
  });
  hinge.add(lid.mesh);

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
  const adhesive = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.93 });
  const labelAngle = -0.055;
  const label = paperPiece(THREE, 11.5, 4.91, 0.010, 0.08, [adhesive, paper, paperEdge], {
    columns: 12, rows: 8,
    place: (x, z) => [
      width - 7.1 + x * Math.cos(labelAngle) - z * Math.sin(labelAngle),
      -9.1 + x * Math.sin(labelAngle) + z * Math.cos(labelAngle),
    ],
  });
  label.mesh.castShadow = false;
  hinge.add(label.mesh);
  const foldMaterial = inside.clone();
  foldMaterial.side = THREE.DoubleSide;
  const spine = folderSpine(THREE, depth - 0.55, foldMaterial);
  folder.add(spine.mesh);
  folder.add(hinge);

  let lastAngle;
  hinge.userData.updateFold = () => {
    const angle = hinge.rotation.z;
    if (angle === lastAngle) return;
    lastAngle = angle;
    const opened = stockEase((angle / Math.PI - 0.60) / 0.40);
    hinge.position.y = 0.37 - 0.21 * opened;
    const lidHeight = (x, z) => {
      const rim = stockClamp(x / width) ** 5;
      const tip = stockClamp(Math.abs(z) / (depth / 2)) ** 5;
      const lift = 0.017 * Math.sin(0.29 * x - 0.14 * z) + 0.059 * rim * tip;
      const settled = 0.060 + x * Math.sin(0.012) - lift;
      return lift + (settled - lift) * opened;
    };
    lid.shape(lidHeight);
    label.shape((x, z) => lidHeight(x, z) + 0.049);

    const attach = 0.16;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    spine.bend(angle,
      (z) => [seamX + attach, baseHeight(seamX + attach, z)],
      (z) => {
        const y = lidHeight(attach, z);
        return [seamX + attach * cosine - y * sine, hinge.position.y + attach * sine + y * cosine];
      },
      0.49 - 0.385 * opened);
  };
  hinge.userData.updateFold();
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

export function makeRoomReflection(THREE, night = false) {
  const texture = canvasTexture(THREE, 512, 256, (ctx, w, h) => {
    const room = ctx.createLinearGradient(0, 0, 0, h);
    room.addColorStop(0, night ? "#384251" : "#8c7963");
    room.addColorStop(0.5, night ? "#2e2623" : "#735b43");
    room.addColorStop(1, night ? "#171213" : "#221914");
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, w, h);
    const glow = night
      ? ctx.createRadialGradient(91, 113, 1, 91, 113, 50)
      : ctx.createRadialGradient(114, 89, 7, 114, 89, 95);
    glow.addColorStop(0, night ? "#ffd99e" : "#fff5dc");
    glow.addColorStop(0.44, night ? "#b47849" : "#d8b692");
    glow.addColorStop(1, "#d8b69200");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = night ? "#ffd6a9" : "#fff7e2";
    if (night) {
      ctx.fillRect(73, 110, 36, 7);
    } else {
      ctx.fillRect(82, 48, 25, 69);
      ctx.fillRect(113, 48, 25, 69);
    }
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}
