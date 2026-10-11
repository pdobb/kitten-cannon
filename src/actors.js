import * as THREE from 'three';
import { shell } from './look.js';
import { BARREL_LEN, CANNON_X, PIVOT_X, PIVOT_Y } from './tune.js';

// Main coat, then the darker ear. White chest, muzzle, and socks stay.
// A restart picks a different pair so the kitten actually changes color.
const COATS = [
  [0x24222a, 0x141318],
  [0xd9822b, 0xa85e16],
  [0x8d939c, 0x5e646c],
  [0xb08968, 0x7a5a3a],
  [0x6b4632, 0x3f2918],
  [0xd9c2a8, 0xb39678],
  [0x4e5964, 0x2e363e],
  [0xe7e2da, 0xc4beb4],
];
const BELLY = 0xfff8f2;
const EAR = 0xf3a0b0;
const NOSE = 0xe56b86;
const WOOD = 0x8d522c;
const WOOD_DARK = 0x69381c;
const METAL = 0x5c6772;
const METAL_DARK = 0x2c333a;
const BRASS = 0xd1a85a;
const RED = 0xd23b2e;
const CREAM = 0xfff6e6;

const BALLOON_COLORS = [0xe23b3b, 0xf2c14e, 0x3d8fe0, 0x7ac943, 0xf28a2e];

function mesh(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

export function createKitten(look) {
  const root = new THREE.Group();
  const { mat, outline } = look;
  // look.mat caches one material per hex. Clone these so a new coat
  // does not repaint every mesh that happens to share the tuxedo black.
  const furMat = mat(0x24222a).clone();
  const darkMat = mat(0x141318).clone();
  let coatIndex = -1;

  function recolor() {
    let next = Math.floor(Math.random() * COATS.length);
    if (next === coatIndex) next = (next + 1) % COATS.length;
    coatIndex = next;
    furMat.color.setHex(COATS[next][0]);
    darkMat.color.setHex(COATS[next][1]);
  }

  recolor();

  const bodyGeo = new THREE.SphereGeometry(13, 16, 12);
  const body = mesh(bodyGeo, furMat, 0, 0, 0);
  body.scale.set(1.28, 0.9, 0.86);
  root.add(body);
  shell(body, root, outline, 0.08);

  const belly = mesh(new THREE.SphereGeometry(8.4, 12, 10), mat(BELLY), 3.2, -2.2, 6.2);
  belly.scale.set(1.12, 0.95, 0.72);
  root.add(belly);

  const head = mesh(new THREE.SphereGeometry(10, 16, 12), furMat, 16, 5, 1);
  root.add(head);
  shell(head, root, outline, 0.08);

  // Leather flying helmet, the early-1950s kind. The dome opens toward +X
  // so the face stays out. The camera sits on +Z, so the ear cup and the
  // near goggle are built on that side. Ears poke through the crown.
  const LEATHER = 0x7a4e2c;
  const LEATHER_DARK = 0x4a2e16;
  const capGeo = new THREE.SphereGeometry(11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.47);
  const cap = mesh(capGeo, mat(LEATHER), 12.4, 9.2, 1);
  root.add(cap);
  shell(cap, root, outline, 0.045);

  const brow = mesh(new THREE.SphereGeometry(3.4, 10, 8), mat(LEATHER_DARK), 20.4, 12.4, 5.2);
  brow.scale.set(1.5, 0.48, 0.85);
  root.add(brow);

  const flap = mesh(new THREE.SphereGeometry(6.4, 12, 10), mat(LEATHER), 13.6, 4.8, 8.2);
  flap.scale.set(0.9, 1.2, 0.62);
  root.add(flap);
  shell(flap, root, outline, 0.05);

  const cup = mesh(new THREE.CylinderGeometry(4.8, 4.8, 1.6, 16), mat(LEATHER_DARK), 13.8, 4.6, 11.6);
  cup.rotation.x = Math.PI / 2;
  root.add(cup);
  shell(cup, root, outline, 0.07);
  const pad = mesh(new THREE.CylinderGeometry(2.8, 2.8, 1.7, 14), mat(0x241c16), 13.8, 4.6, 12.3);
  pad.rotation.x = Math.PI / 2;
  root.add(pad);

  // Strap leaves the cup, runs forward, and buckles under the jaw.
  const strap = mesh(new THREE.CapsuleGeometry(0.72, 9, 3, 6), mat(LEATHER_DARK), 17.4, 1.4, 9.4);
  strap.rotation.z = -0.85;
  strap.rotation.y = 0.35;
  root.add(strap);
  const buckle = mesh(new THREE.BoxGeometry(2.4, 1.6, 0.7), mat(BRASS), 19.6, -0.6, 10.2);
  root.add(buckle);

  const lensMat = new THREE.MeshBasicMaterial({ color: 0xf0c36a });
  const goggle = new THREE.Group();
  const lens = mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.8, 14), lensMat, 0, 0, 0.5);
  lens.rotation.x = Math.PI / 2;
  const frame = mesh(new THREE.TorusGeometry(3.5, 0.68, 6, 16), mat(0x2a2118), 0, 0, 0);
  frame.rotation.x = Math.PI / 2;
  const glintLens = mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(CREAM), 1.2, 1.3, 1.1);
  goggle.add(lens, frame, glintLens);
  shell(frame, goggle, outline, 0.1);
  goggle.position.set(18.4, 14.4, 8.4);
  goggle.rotation.y = -0.7;
  goggle.rotation.z = -0.4;
  root.add(goggle);

  const band = mesh(new THREE.CapsuleGeometry(0.85, 12, 3, 6), mat(LEATHER_DARK), 13.2, 17.6, 2.2);
  band.rotation.z = Math.PI / 2;
  root.add(band);

  const earGeo = new THREE.ConeGeometry(4.2, 9, 5);
  const earInGeo = new THREE.ConeGeometry(2.3, 5, 5);
  const earL = mesh(earGeo, furMat, 13.2, 17.8, 5.4);
  const earR = mesh(earGeo, darkMat, 12.4, 16.6, -3.2);
  earR.scale.setScalar(0.82);
  root.add(earL, earR);
  shell(earL, root, outline, 0.1);
  const earIn = mesh(earInGeo, mat(EAR), 13.6, 16.8, 6.6);
  root.add(earIn);

  const eyeWhite = mesh(new THREE.SphereGeometry(3.3, 12, 10), mat(0xfffaf4), 21.2, 7.1, 7.2);
  const pupil = mesh(new THREE.SphereGeometry(1.65, 10, 8), mat(0x1c1720), 22.6, 6.7, 9);
  const glint = mesh(new THREE.SphereGeometry(0.62, 8, 6), mat(CREAM), 23.1, 8, 9.7);
  root.add(eyeWhite, pupil, glint);

  const muzzle = mesh(new THREE.SphereGeometry(4.4, 10, 8), mat(BELLY), 20.2, 3.2, 5.4);
  muzzle.scale.set(1.08, 0.7, 0.82);
  root.add(muzzle);

  const nose = mesh(new THREE.SphereGeometry(1.45, 8, 6), mat(NOSE), 25.2, 4.3, 4.2);
  nose.scale.set(1.15, 0.75, 0.85);
  root.add(nose);

  const cheek = mesh(new THREE.SphereGeometry(3.2, 8, 6), mat(BELLY), 18.2, 3.4, 7.4);
  cheek.scale.set(1.15, 0.82, 0.72);
  root.add(cheek);

  const whisker = new THREE.CylinderGeometry(0.18, 0.18, 8, 4);
  whisker.rotateZ(-Math.PI / 2);
  for (const [y, z, tilt] of [[5.4, 6.5, 0.25], [4.2, 6.8, 0], [3.1, 6.4, -0.22]]) {
    const w = mesh(whisker, mat(0x4a4038), 24, y, z);
    w.rotation.z = tilt;
    root.add(w);
  }

  const collar = mesh(new THREE.TorusGeometry(6.2, 1.05, 6, 14), mat(RED), 10, 3.2, 1);
  collar.rotation.y = Math.PI / 2;
  root.add(collar);
  const bell = mesh(new THREE.SphereGeometry(1.5, 8, 6), mat(BRASS), 12.2, -0.4, 6.2);
  root.add(bell);

  const tailGeo = new THREE.SphereGeometry(1, 8, 6);
  const blobs = [
    [-15, 1, 0, 3.3],
    [-19, 5, 1, 2.7],
    [-21, 10, 1, 2.2],
    [-19.5, 14.5, 1, 1.7],
  ];
  for (const [x, y, z, r] of blobs) {
    const t = mesh(tailGeo, furMat, x, y, z);
    t.scale.setScalar(r);
    root.add(t);
    shell(t, root, outline, 0.12);
  }

  const legGeo = new THREE.CapsuleGeometry(2.3, 6, 3, 6);
  const pawGeo = new THREE.SphereGeometry(2.5, 8, 6);
  for (const [x, z] of [[8, 5], [8, -4], [-7, 5], [-7, -4]]) {
    const leg = mesh(legGeo, furMat, x, -10, z);
    root.add(leg);
    // Front socks run higher, the usual tuxedo mittens.
    const sockH = x > 0 ? 6.4 : 4.2;
    const sock = mesh(new THREE.CylinderGeometry(2.45, 2.55, sockH, 8), mat(BELLY), x + 0.5, -14.2 + sockH * 0.15, z);
    root.add(sock);
    const paw = mesh(pawGeo, mat(BELLY), x + 1.2, -15.2, z);
    paw.scale.set(1.15, 0.58, 0.95);
    root.add(paw);
  }

  // Nose is local +X. rotation.z = aim angle points that nose along the barrel.
  return {
    mesh: root,
    eye: eyeWhite,
    recolor,
    coat() { return COATS[coatIndex][0]; },
  };
}

export function createCannon(look) {
  const root = new THREE.Group();
  root.position.set(CANNON_X, 0, 0);
  const { mat, outline } = look;

  const wheelGeo = new THREE.CylinderGeometry(18, 18, 7, 12);
  const hubGeo = new THREE.CylinderGeometry(5, 5, 9, 8);
  const spokeGeo = new THREE.BoxGeometry(28, 2.2, 2);
  for (const z of [-22, 22]) {
    const wheel = mesh(wheelGeo, mat(WOOD_DARK), -4, 18, z);
    wheel.rotation.x = Math.PI / 2;
    root.add(wheel);
    shell(wheel, root, outline, 0.05);
    const hub = mesh(hubGeo, mat(BRASS), -4, 18, z);
    hub.rotation.x = Math.PI / 2;
    root.add(hub);
    for (let i = 0; i < 4; i++) {
      const spoke = mesh(spokeGeo, mat(WOOD), -4, 18, z);
      spoke.rotation.z = (i * Math.PI) / 4;
      root.add(spoke);
    }
  }

  const axle = mesh(new THREE.CylinderGeometry(2.2, 2.2, 40, 8), mat(METAL_DARK), -4, 18, 0);
  axle.rotation.x = Math.PI / 2;
  root.add(axle);

  const bed = mesh(new THREE.BoxGeometry(58, 14, 30), mat(WOOD), 2, 30, 0);
  root.add(bed);
  shell(bed, root, outline, 0.04);
  const cheekGeo = new THREE.BoxGeometry(16, 18, 4);
  root.add(mesh(cheekGeo, mat(WOOD_DARK), 8, 40, 16));
  root.add(mesh(cheekGeo, mat(WOOD_DARK), 8, 40, -16));

  const pivot = new THREE.Group();
  pivot.position.set(PIVOT_X, PIVOT_Y, 0);
  root.add(pivot);

  const barrelGeo = new THREE.CylinderGeometry(16, 11, BARREL_LEN, 14);
  const barrel = mesh(barrelGeo, mat(METAL), BARREL_LEN / 2, 0, 0);
  barrel.rotation.z = -Math.PI / 2;
  pivot.add(barrel);
  shell(barrel, pivot, outline, 0.045);

  const ringGeo = new THREE.TorusGeometry(14.2, 1.7, 6, 16);
  for (const t of [0.18, 0.78]) {
    const ring = mesh(ringGeo, mat(METAL_DARK), BARREL_LEN * t, 0, 0);
    ring.rotation.y = Math.PI / 2;
    pivot.add(ring);
  }

  // The bore faces the camera so it reads as a dark muzzle from the side.
  const mouth = mesh(new THREE.CircleGeometry(9.5, 14), mat(0x16191d), BARREL_LEN + 1, 0, 0);
  pivot.add(mouth);

  const tickGeo = new THREE.SphereGeometry(3.2, 8, 6);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xfff4c4 });
  const ticks = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    ticks.add(mesh(tickGeo, tickMat, BARREL_LEN + 20 + i * 26, 0, 0));
  }
  pivot.add(ticks);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(BARREL_LEN, 0, 0);
  pivot.add(muzzle);

  return { root, pivot, ticks, muzzle };
}

function crate(look) {
  const root = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(50, 46, 40), look.tnt, 0, 26, 0);
  root.add(box);
  shell(box, root, look.outline, 0.04);
  return { mesh: root, parts: {} };
}

function trampoline(look) {
  const root = new THREE.Group();
  const { mat, outline } = look;
  const legGeo = new THREE.CylinderGeometry(1.6, 1.8, 16, 6);
  for (const x of [-26, 26]) {
    root.add(mesh(legGeo, mat(0xc5ced6), x, 8, 8));
    root.add(mesh(legGeo, mat(0xc5ced6), x, 8, -8));
  }
  const frame = mesh(new THREE.BoxGeometry(64, 4, 28), mat(METAL_DARK), 0, 16, 0);
  root.add(frame);
  const bed = mesh(new THREE.BoxGeometry(58, 8, 24), mat(RED), 0, 21, 0);
  root.add(bed);
  shell(bed, root, outline, 0.05);
  const stripe = mesh(new THREE.BoxGeometry(58, 2, 6), mat(CREAM), 0, 25.2, 0);
  root.add(stripe);
  return { mesh: root, parts: { bed, stripe } };
}

// The camera sits on +Z and looks almost along the ground, so a flat disc
// would be a sliver. Berms and the tar body are tall enough to read in
// profile. The hit volume is still the spike box in propspec.js.
function tarPit(look) {
  const root = new THREE.Group();
  const { mat, outline } = look;
  // One low bank, not a pair of matching mounds. The black pool sits on
  // it and is the shape you read from the side.
  const bank = mesh(new THREE.SphereGeometry(18, 14, 10), mat(0x8a552c), -2, 5, 0);
  bank.scale.set(2.15, 0.38, 0.62);
  root.add(bank);
  shell(bank, root, outline, 0.04);
  const lip = mesh(new THREE.SphereGeometry(14, 12, 10), mat(0x5c3a22), 1, 6.2, 1.5);
  lip.scale.set(1.85, 0.28, 0.5);
  root.add(lip);
  const tar = mesh(new THREE.SphereGeometry(13, 14, 12), mat(0x14110e), 0, 8.2, 3);
  tar.scale.set(1.7, 0.4, 0.5);
  root.add(tar);
  shell(tar, root, outline, 0.035);
  const sheen = mesh(new THREE.SphereGeometry(4.2, 10, 8), mat(0x4e473f), -5, 11.2, 5);
  sheen.scale.set(2.2, 0.2, 0.35);
  root.add(sheen);

  const bubbles = [];
  const skin = mat(0x3f3832);
  const glint = mat(0x7a736a);
  for (const [x, z, r, y] of [[8, 4, 2.3, 15.5], [-7, 3.2, 1.7, 14.6], [0.5, 4.5, 1.25, 16.2]]) {
    const bubble = new THREE.Group();
    bubble.position.set(x, y, z);
    bubble.userData.baseY = y;
    const ball = mesh(new THREE.SphereGeometry(r, 8, 6), skin, 0, 0, 0);
    const spot = mesh(new THREE.SphereGeometry(r * 0.32, 6, 5), glint, -r * 0.28, r * 0.4, r * 0.15);
    bubble.add(ball, spot);
    root.add(bubble);
    bubbles.push(bubble);
  }
  return { mesh: root, parts: { bubbles } };
}

// Open clam. The mouth faces -X, the side the kitten arrives from.
// Positive rotation.z swings local +X toward +Y, so a lobe built along
// local -X swings down. The upper lobe uses the opposite angle.
// The red face sits at local +Z because the camera is on +Z.
const TRAP_OPEN = 0.72;

function venus(look) {
  const root = new THREE.Group();
  const { mat, outline } = look;
  const leafGreen = mat(0x2f8a3a);
  const leafDark = mat(0x1e6a2c);
  const inside = mat(0x9a2430);
  const throatColor = mat(0x5c1420);
  const cilia = mat(0xf4f0e0);

  const leafGeo = new THREE.SphereGeometry(6, 10, 8);
  for (let i = 0; i < 5; i++) {
    const ang = -1.05 + i * 0.52;
    const holder = new THREE.Group();
    holder.position.set(0, 4, (i - 2) * 2.5);
    holder.rotation.z = ang;
    const leaf = mesh(leafGeo, i % 2 ? leafGreen : leafDark, 11, 0, 0);
    leaf.scale.set(1.9, 0.34, 0.55);
    holder.add(leaf);
    root.add(holder);
  }

  const petiole = mesh(new THREE.CylinderGeometry(2.1, 3.2, 34, 7), leafDark, 3, 20, 0);
  petiole.rotation.z = -0.18;
  root.add(petiole);

  const head = new THREE.Group();
  head.position.set(6, 44, 0);
  root.add(head);

  const rib = mesh(new THREE.CylinderGeometry(1.7, 1.7, 14, 6), leafDark, 0, 0, 1);
  rib.rotation.x = Math.PI / 2;
  head.add(rib);

  function lobe(sign) {
    const pivot = new THREE.Group();
    pivot.rotation.z = sign > 0 ? -TRAP_OPEN : TRAP_OPEN;

    const body = mesh(new THREE.SphereGeometry(12, 14, 12), leafGreen, -14, 0, -1.2);
    body.scale.set(1.22, 0.4, 0.82);
    pivot.add(body);
    shell(body, pivot, outline, 0.06);

    const inner = mesh(new THREE.SphereGeometry(9, 12, 10), inside, -15, sign * -1.7, 3.4);
    inner.scale.set(1.08, 0.24, 0.55);
    pivot.add(inner);

    const throat = mesh(new THREE.SphereGeometry(3.4, 8, 6), throatColor, -16.5, sign * -2.2, 4.4);
    throat.scale.set(1.15, 0.4, 0.5);
    pivot.add(throat);

    const toothGeo = new THREE.ConeGeometry(0.85, 6.4, 5);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = -7 - t * 18;
      const y = sign * (-3.1 - Math.sin(t * Math.PI) * 1.2);
      const z = 3.2 + Math.sin(t * Math.PI) * 2.4;
      const tooth = mesh(toothGeo, cilia, x, y, z);
      // Cone tip is +Y. A half turn around Z points the upper comb into
      // the gap. The X lean is opposite on that comb: a half turn flips
      // it, and the camera sits on +Z.
      tooth.rotation.x = sign > 0 ? -0.5 : 0.5;
      if (sign > 0) tooth.rotation.z = Math.PI;
      tooth.rotation.z += (t - 0.5) * 0.42 * sign;
      pivot.add(tooth);
    }

    const hairGeo = new THREE.CylinderGeometry(0.22, 0.16, 5.2, 4);
    for (const t of [0.32, 0.52, 0.7]) {
      const hair = mesh(hairGeo, cilia, -8 - t * 12, sign * -3.3, 4.6);
      hair.rotation.x = sign > 0 ? -0.85 : 0.85;
      if (sign > 0) hair.rotation.z = Math.PI;
      pivot.add(hair);
    }

    return pivot;
  }

  const upper = lobe(1);
  const lower = lobe(-1);
  head.add(upper, lower);
  return { mesh: root, parts: { head, upper, lower, open: TRAP_OPEN } };
}

// One set of parts for every balloon. The field holds hundreds of them.
let balloonParts = null;
let balloonShine = null;

function balloonGeometries() {
  if (balloonParts) return balloonParts;
  balloonParts = {
    bomb: new THREE.SphereGeometry(12, 14, 12),
    fuse: new THREE.CylinderGeometry(0.7, 0.7, 8, 5),
    spark: new THREE.SphereGeometry(1.6, 6, 6),
    bag: new THREE.SphereGeometry(16, 16, 12),
    knot: new THREE.SphereGeometry(2.2, 6, 5),
    string: new THREE.CylinderGeometry(0.35, 0.35, 16, 4),
    shine: new THREE.SphereGeometry(4, 8, 6),
  };
  return balloonParts;
}

function balloon(look, salt) {
  const root = new THREE.Group();
  const { mat, outline } = look;
  const geo = balloonGeometries();
  const color = BALLOON_COLORS[Math.abs(salt) % BALLOON_COLORS.length];
  const bomb = mesh(geo.bomb, mat(0x2a2a2a), 0, -14, 0);
  root.add(bomb);
  shell(bomb, root, outline, 0.06);
  const fuse = mesh(geo.fuse, mat(0xc2a15a), 2, -4, 3);
  fuse.rotation.z = 0.5;
  root.add(fuse);
  const spark = mesh(geo.spark, mat(0xffb703), 4, 0, 4);
  root.add(spark);
  const bag = mesh(geo.bag, mat(color), 0, 18, 0);
  bag.scale.set(0.92, 1.08, 0.92);
  root.add(bag);
  shell(bag, root, outline, 0.06);
  const knot = mesh(geo.knot, mat(color), 0, 2, 0);
  root.add(knot);
  const string = mesh(geo.string, mat(0x4a4038), 0, -6, 0);
  root.add(string);
  if (!balloonShine) balloonShine = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
  const shine = mesh(geo.shine, balloonShine, -5, 24, 8);
  root.add(shine);
  return { mesh: root, parts: { spark } };
}

export function createProp(type, look, salt) {
  if (type === 'tnt') return crate(look);
  if (type === 'trampoline') return trampoline(look);
  if (type === 'spikes') return tarPit(look);
  if (type === 'venus') return venus(look);
  return balloon(look, salt);
}

export function createStake(look) {
  const root = new THREE.Group();
  const { mat } = look;
  const pole = mesh(new THREE.BoxGeometry(4, 78, 3), mat(0xf4f0e4), 0, 39, 0);
  root.add(pole);
  for (let i = 0; i < 5; i++) {
    const band = mesh(new THREE.BoxGeometry(5.5, 7, 4), mat(i % 2 ? RED : 0xf7f3ea), 0, 18 + i * 12, 0);
    root.add(band);
  }
  const flag = mesh(new THREE.BoxGeometry(30, 16, 2), mat(RED), 18, 70, 0);
  root.add(flag);
  root.visible = false;
  return root;
}

export function createParticles(look, parent) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const pool = [];
  for (let i = 0; i < 280; i++) {
    const material = new THREE.MeshBasicMaterial({
      map: look.soft,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, material);
    m.visible = false;
    m.renderOrder = 2;
    parent.add(m);
    pool.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0 });
  }

  function spawn(x, y, color, count, speed, life, size) {
    let made = 0;
    for (let i = 0; i < pool.length && made < count; i++) {
      const p = pool[i];
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.85);
      p.vx = Math.cos(a) * s;
      p.vy = Math.abs(Math.sin(a)) * s * 0.8 + speed * 0.15;
      p.life = life * (0.7 + Math.random() * 0.5);
      p.max = p.life;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, 24);
      p.mesh.scale.setScalar(size * (0.55 + Math.random()));
      p.mesh.material.color.set(color);
      p.mesh.material.opacity = 1;
      made += 1;
    }
  }

  function update(dt) {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 40 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      const u = p.life / p.max;
      p.mesh.material.opacity = Math.max(0, u);
      p.mesh.scale.multiplyScalar(1 + dt * 0.8);
    }
  }

  return { spawn, update };
}
