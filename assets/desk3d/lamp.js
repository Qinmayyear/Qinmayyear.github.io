const halfWidth = 11.65;
const frontAngle = 0.09;
const rearAngle = 3.08;

function shadePoint(u, angle, inner = false) {
  const roll = Math.max(0, (Math.abs(u) - 0.74) / 0.26);
  const round = roll * roll;
  const depth = 6.3 - 1.72 * round;
  const rise = 5.6 - 2.12 * round;
  const front = Math.cos(angle);
  const lowerLip = 22.06 - 0.72 * front + 0.34 * round;
  return [
    (halfWidth - (inner ? 0.035 : 0)) * u,
    lowerLip + rise * Math.sin(angle) - (inner ? 0.13 : 0),
    0.55 + (depth - (inner ? 0.13 : 0)) * front,
  ];
}

function glassGeometry(THREE, inner) {
  const positions = [];
  const indices = [];
  const colors = [];
  const across = 40;
  const arc = 32;
  const deepGreen = new THREE.Color(0x203e2c);
  const litGreen = new THREE.Color(0x48654b);
  const green = new THREE.Color();

  for (let column = 0; column <= across; column += 1) {
    const u = column / across * 2 - 1;
    for (let row = 0; row <= arc; row += 1) {
      const angle = frontAngle + (rearAngle - frontAngle) * row / arc;
      positions.push(...shadePoint(u, angle, inner));
      if (!inner) {
        const thickness = Math.pow(Math.sin(angle), 0.58) * (0.54 + 0.4 * (1 - u * u));
        green.copy(deepGreen).lerp(litGreen, thickness);
        colors.push(green.r, green.g, green.b);
      }
      if (column < across && row < arc) {
        const current = column * (arc + 1) + row;
        const next = current + arc + 1;
        if (inner) {
          indices.push(current, current + 1, next, current + 1, next + 1, next);
        } else {
          indices.push(current, next, current + 1, current + 1, next, next + 1);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (!inner) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function shadeEnd(THREE, side) {
  const glass = [];
  const indices = [];
  const steps = 32;
  const first = shadePoint(side, frontAngle);
  const last = shadePoint(side, rearAngle);
  glass.push(halfWidth * side, (first[1] + last[1]) / 2, (first[2] + last[2]) / 2);
  for (let step = 0; step <= steps; step += 1) {
    const angle = frontAngle + (rearAngle - frontAngle) * step / steps;
    glass.push(...shadePoint(side, angle));
    if (step < steps) {
      const vertex = step + 1;
      if (side < 0) {
        indices.push(0, vertex, vertex + 1);
      } else {
        indices.push(0, vertex + 1, vertex);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(glass, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addMesh(THREE, parent, geometry, material, shadows = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  parent.add(mesh);
  return mesh;
}

function turnedPart(THREE, parent, profile, material, shadows) {
  const geometry = new THREE.LatheGeometry(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    64
  );
  return addMesh(THREE, parent, geometry, material, shadows);
}

function tube(THREE, parent, points, radius, material, shadows, sections = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return addMesh(THREE, parent, new THREE.TubeGeometry(curve, sections, radius, 10, false), material, shadows);
}

export function createLamp(THREE) {
  const lamp = new THREE.Group();
  lamp.name = "Green glass banker's lamp";

  const brass = new THREE.MeshStandardMaterial({
    color: 0x957043,
    metalness: 0.56,
    roughness: 0.37,
  });
  const polishedBrass = new THREE.MeshStandardMaterial({
    color: 0xb68e54,
    metalness: 0.59,
    roughness: 0.28,
  });
  const darkerBrass = new THREE.MeshStandardMaterial({
    color: 0x574330,
    metalness: 0.42,
    roughness: 0.47,
  });
  const felt = new THREE.MeshStandardMaterial({ color: 0x24251d, roughness: 0.99 });

  const foot = turnedPart(THREE, lamp, [
    [0, 0], [7.03, 0], [7.22, 0.10], [7.29, 0.24], [0, 0.24],
  ], felt);
  foot.position.z = -1.2;
  foot.scale.z = 0.76;
  const base = turnedPart(THREE, lamp, [
    [0, 0.22], [7.24, 0.22], [7.46, 0.31], [7.56, 0.46],
    [7.56, 0.68], [7.48, 0.86], [7.2, 0.96], [6.78, 1.05],
    [6.74, 1.19], [6.58, 1.31], [6.09, 1.46], [4.7, 1.65],
    [2.74, 1.78], [2.32, 1.86], [2.17, 2.07], [0, 2.07],
  ], brass);
  base.position.z = -1.2;
  base.scale.z = 0.76;
  const bead = turnedPart(THREE, lamp, [
    [7.37, 0.72], [7.54, 0.72], [7.57, 0.75], [7.5, 0.81], [7.35, 0.81],
  ], polishedBrass, false);
  bead.position.z = -1.2;
  bead.scale.z = 0.76;

  const stem = turnedPart(THREE, lamp, [
    [0, 1.94], [1.95, 1.94], [2.04, 2.10], [2.03, 2.28],
    [1.88, 2.46], [1.59, 2.58], [1.23, 2.76], [1.03, 3.15],
    [0.96, 3.51], [0.88, 3.67], [0.70, 3.85], [0.61, 4.48],
    [0.57, 7.28], [0.56, 11.67], [0.60, 13.70], [0.73, 14.02],
    [0.82, 14.11], [0.86, 14.3], [0.80, 14.55], [0.64, 14.72],
    [0.59, 15.43], [0, 15.50],
  ], brass);
  stem.position.z = -1.2;
  const stemCollars = turnedPart(THREE, lamp, [
    [0.85, 3.37], [0.95, 3.37], [1.00, 3.43], [0.96, 3.52],
    [0.86, 3.55], [0.8, 3.63],
  ], polishedBrass, false);
  stemCollars.position.z = -1.2;

  for (const side of [-1, 1]) {
    tube(THREE, lamp, [
      [0, 14.65, -1.2], [4.62 * side, 14.72, -1.2],
      [8.41 * side, 15.65, -1.05], [10.96 * side, 17.63, -0.59],
      [12.04 * side, 20.39, -0.02], [12.04 * side, 23.17, 0.56],
    ], 0.37, brass, true);
    const hinge = addMesh(THREE, lamp, new THREE.CylinderGeometry(0.68, 0.66, 0.47, 28), polishedBrass);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(side * 12.07, 23.17, 0.56);
    const screw = addMesh(THREE, lamp, new THREE.CylinderGeometry(0.34, 0.34, 0.13, 20), darkerBrass, false);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(side * 12.34, 23.17, 0.56);
    const groove = addMesh(THREE, lamp, new THREE.BoxGeometry(0.023, 0.064, 0.43), felt, false);
    groove.rotation.x = 0.36 * side;
    groove.position.set(side * 12.416, 23.17, 0.56);
  }

  const glazedGreen = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.28,
    clearcoat: 0.92,
    clearcoatRoughness: 0.22,
    emissive: 0x294830,
    emissiveIntensity: 0,
    shadowSide: THREE.DoubleSide,
  });
  const glassEdge = new THREE.MeshPhysicalMaterial({
    color: 0x456649,
    roughness: 0.26,
    clearcoat: 0.81,
    clearcoatRoughness: 0.26,
  });
  const glassInside = new THREE.MeshStandardMaterial({
    color: 0xc4b394,
    roughness: 0.46,
    emissive: 0xffbe68,
    emissiveIntensity: 0,
  });
  const hood = addMesh(THREE, lamp, glassGeometry(THREE, false), glazedGreen);
  hood.name = "Cased green glass";
  addMesh(THREE, lamp, glassGeometry(THREE, true), glassInside, false);
  for (const side of [-1, 1]) {
    addMesh(THREE, lamp, shadeEnd(THREE, side), glassEdge);
  }
  for (const angle of [frontAngle, rearAngle]) {
    const edge = Array.from({ length: 17 }, (_, index) =>
      shadePoint(index / 8 - 1, angle)
    );
    tube(THREE, lamp, edge, 0.105, glassEdge, false, 40);
  }

  const filamentGlass = new THREE.MeshStandardMaterial({
    color: 0xf4d9a8,
    roughness: 0.35,
    emissive: 0xffbd6b,
    emissiveIntensity: 0.035,
  });
  const bulb = addMesh(THREE, lamp, new THREE.CapsuleGeometry(0.49, 11.9, 8, 24), filamentGlass, false);
  bulb.rotation.z = Math.PI / 2;
  bulb.position.set(-0.7, 22.62, 1.29);
  const socket = addMesh(THREE, lamp, new THREE.CylinderGeometry(0.73, 0.64, 1.32, 24), darkerBrass, false);
  socket.rotation.z = Math.PI / 2;
  socket.position.set(-7.28, 22.62, 1.29);

  const chainStart = new THREE.Vector3(7.85, 22.02, 1.82);
  const chainEnd = new THREE.Vector3(8.16, 13.52, 2.08);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 9, 7), darkerBrass, 34);
  const pose = new THREE.Object3D();
  for (let index = 0; index < beads.count; index += 1) {
    pose.position.copy(chainStart).lerp(chainEnd, index / (beads.count - 1));
    pose.updateMatrix();
    beads.setMatrixAt(index, pose.matrix);
  }
  beads.instanceMatrix.needsUpdate = true;
  lamp.add(beads);
  const pull = turnedPart(THREE, lamp, [
    [0, -0.75], [0.15, -0.69], [0.27, -0.48], [0.32, -0.25],
    [0.26, -0.04], [0.14, 0.14], [0, 0.21],
  ], polishedBrass, false);
  pull.position.copy(chainEnd);

  lamp.userData.bulb = new THREE.Vector3(0, 21.18, 1.65);
  lamp.userData.setGlow = (value) => {
    const glow = THREE.MathUtils.clamp(value, 0, 1);
    glazedGreen.emissiveIntensity = glow * 0.48;
    glassInside.emissiveIntensity = glow * 0.78;
    filamentGlass.emissiveIntensity = 0.035 + glow * 2.1;
  };
  return lamp;
}
