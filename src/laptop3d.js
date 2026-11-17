// WebGL laptop: two solid blocks (rounded plan corners, filleted edges, exact
// normals so nothing seams), a canvas screen, spring physics on the lid and the
// lean, supersampled AA.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ROWS, WIDE } from "./laptop.js";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const ACCENT = new THREE.Color("#ff5b35");

// laptop proportions (scene units). Lid and base share the same footprint, so
// shut it reads as one block with a hairline between the halves.
const W = 3.2, D = 2.2, R = 0.17;            // footprint + plan corner radius
const BT = 0.075, BF = 0.026;                // base thickness, edge fillet
const H = D, LT = 0.042, LF = 0.016;         // lid
const GAP = 0.007;                           // lid ↔ deck when shut
const SW = 2.98, SH = 1.9;                   // display
const LID_OPEN = -0.24, LID_SHUT = Math.PI / 2;

/* ── geometry helpers ───────────────────────── */
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A solid block w × t × d (thickness on y), plan corners of radius r and every
// edge rounded with fillet f. Built as a profile swept along the outline plus two
// flat caps, with analytic normals: perfectly smooth, no shading seams.
function block(w, t, d, r, f, { arc = 28, fil = 10 } = {}) {
  const ax = w / 2 - f, az = d / 2 - f, ay = t / 2 - f, rc = Math.max(1e-4, r - f);
  const ring = []; // core outline: point + outward normal
  [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]].forEach(([sx, sz, q]) => {
    const cx = sx * (ax - rc), cz = sz * (az - rc);
    for (let i = 0; i <= arc; i++) {
      const a = (q + i / arc) * Math.PI / 2;
      ring.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc, Math.cos(a), Math.sin(a)]);
    }
  });
  const prof = []; // [yc, angle]: top cap edge → side → bottom cap edge
  for (let j = 0; j <= fil; j++) prof.push([ay, Math.PI / 2 * (1 - j / fil)]);
  for (let j = 0; j <= fil; j++) prof.push([-ay, -Math.PI / 2 * (j / fil)]);

  const pos = [], nor = [], idx = [];
  const n = ring.length;
  for (const [yc, phi] of prof) {
    const c = Math.cos(phi), s = Math.sin(phi);
    for (const [x, z, nx, nz] of ring) {
      pos.push(x + f * c * nx, yc + f * s, z + f * c * nz);
      nor.push(c * nx, s, c * nz);
    }
  }
  for (let j = 0; j < prof.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n, c2 = a + n, d2 = b + n;
      idx.push(a, c2, b, b, c2, d2);
    }
  }
  // caps
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const [y, ny] of [[ay + f, 1], [-ay - f, -1]]) {
    const o = pos.length / 3;
    for (const [x, z] of ring) { pos.push(x, y, z); nor.push(0, ny, 0); }
    for (const [a, b, c] of tris) idx.push(o + a, o + b, o + c);
  }
  // face every triangle outward (winding from the analytic normals)
  const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const N = (i) => new THREE.Vector3(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
  for (let k = 0; k < idx.length; k += 3) {
    const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
    const fn = P(b).sub(P(a)).cross(P(c).sub(P(a)));
    if (fn.dot(N(a).add(N(b)).add(N(c))) < 0) { idx[k + 1] = c; idx[k + 2] = b; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function flatRect(w, h, r, segs = 32) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), segs);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

/* ── screen texture ─────────────────────────── */
function makeScreen(st) {
  const CW = 2560, CH = Math.round(CW * SH / SW);
  const c = document.createElement("canvas");
  c.width = CW; c.height = CH;
  const ctx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const FS = 66, LH = 108, PAD = 88, BAR = 128;
  const fit = (s, max) => {
    if (ctx.measureText(s).width <= max) return s;
    while (s.length && ctx.measureText(s + "…").width > max) s = s.slice(0, -1);
    return s + "…";
  };
  const colors = { cmd: "#f2ede3", out: "#f2ede3", dim: "#8f897e" };

  function draw(caretOn) {
    const g = ctx.createRadialGradient(CW * 0.3, 0, 0, CW * 0.3, 0, CW * 0.9);
    g.addColorStop(0, "#1f1b16"); g.addColorStop(0.6, "#12100d"); g.addColorStop(1, "#0d0c0a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);

    // title bar
    [["#ff5b35"], ["#3a362f"], ["#3a362f"]].forEach(([col], i) => {
      ctx.beginPath(); ctx.arc(PAD + i * 46, BAR / 2, 13, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    });
    ctx.font = `400 42px ${MONO}`; ctx.fillStyle = "#6f695e"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("~/joaohenriquecosta.dev", CW / 2, BAR / 2);
    ctx.fillStyle = "rgba(242,237,227,.07)"; ctx.fillRect(0, BAR, CW, 2);

    // lines, bottom-aligned with the prompt last
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.font = `400 ${FS}px ${MONO}`;
    const prefix = "~ $ ", pw = ctx.measureText(prefix).width, max = CW - PAD * 2;
    const rows = [...st.lines, { kind: "prompt", text: st.input }];
    let y = CH - PAD + 8 - (rows.length - 1) * LH;
    for (const { kind, text } of rows) {
      if (y > BAR + LH * 0.6) {
        ctx.font = `${kind === "cmd" || kind === "prompt" ? 500 : 400} ${FS}px ${MONO}`;
        let x = PAD;
        if (kind === "cmd" || kind === "prompt") {
          ctx.fillStyle = "#ff5b35"; ctx.fillText(prefix, x, y); x += pw;
        }
        const s = fit(text, max - (x - PAD));
        ctx.fillStyle = colors[kind] ?? colors.cmd;
        ctx.fillText(s, x, y);
        if (kind === "prompt" && caretOn) {
          const cx = x + ctx.measureText(s).width + 6;
          ctx.fillStyle = "#f2ede3"; ctx.fillRect(cx, y - FS * 0.82, FS * 0.56, FS * 1.04);
        }
      }
      y += LH;
    }

    // glass sheen
    const sh = ctx.createLinearGradient(0, 0, CW * 0.55, CH);
    sh.addColorStop(0, "rgba(255,255,255,.06)"); sh.addColorStop(0.45, "rgba(255,255,255,0)");
    ctx.fillStyle = sh; ctx.fillRect(0, 0, CW, CH);
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

function monogramTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.scale(512 / 40, 512 / 40);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(14, 7); ctx.lineTo(14, 24.5); ctx.bezierCurveTo(14, 28.9, 11.4, 32, 7, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 7); ctx.lineTo(22, 33); ctx.moveTo(22, 20); ctx.lineTo(33, 20); ctx.moveTo(33, 7); ctx.lineTo(33, 33); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.45, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* ── mount ──────────────────────────────────── */
export async function mount3d({ stage, st, on, toggle, reduced }) {
  await Promise.all([`400 66px ${MONO}`, `500 66px ${MONO}`].map((f) => document.fonts.load(f).catch(() => {})));

  const canvas = document.createElement("canvas");
  canvas.className = "laptop3d";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  // Supersample: never below 2x, so edges stay smooth even on 1x screens.
  renderer.setPixelRatio(Math.min(2.5, Math.max(2, devicePixelRatio || 1)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();

  const key = new THREE.DirectionalLight("#fff6ea", 1.4);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const glow = new THREE.PointLight("#ff8a5c", 0, 2.6, 2); // the screen spilling onto the deck
  scene.add(glow);

  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
  const target = new THREE.Vector3(0.12, 0.9, 0.1);

  /* materials */
  const body = new THREE.MeshPhysicalMaterial({ color: "#d3cec5", roughness: 0.4, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const deck = new THREE.MeshStandardMaterial({ color: "#bfbab0", roughness: 0.55 });
  const pad = new THREE.MeshStandardMaterial({ color: "#c6c1b8", roughness: 0.6 });
  const bezelMat = new THREE.MeshPhysicalMaterial({ color: "#0d0c0b", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const screen = makeScreen(st);
  screen.tex.anisotropy = aniso;
  const screenMat = new THREE.MeshBasicMaterial({ map: screen.tex, color: 0x000000, toneMapped: false });
  const logoTex = monogramTexture(); logoTex.anisotropy = aniso;
  const logoMat = new THREE.MeshPhysicalMaterial({ color: "#a39e94", roughness: 0.25, clearcoat: 0.6, alphaMap: logoTex, transparent: true });

  /* model */
  const laptop = new THREE.Group();
  scene.add(laptop);

  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, D * 1.45), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.06, 0.05);
  laptop.add(shadow);

  const base = new THREE.Mesh(block(W, BT, D, R, BF), body);
  base.position.y = BT / 2;
  laptop.add(base);

  const top = BT + 0.0006;
  const well = new THREE.Mesh(flatRect(W * 0.84, 0.98, 0.07), deck);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, top, -0.47);
  laptop.add(well);

  const trackpad = new THREE.Mesh(flatRect(1.18, 0.7, 0.07), pad);
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.set(0, top + 0.0004, 0.56);
  laptop.add(trackpad);

  // keys
  const keyMeshes = new Map(), keyList = [], geoCache = new Map();
  // keys sit low in the deck, so the shut lid clears them
  const KW = W * 0.8, KGAP = 0.034, KD = 0.142, KH = 0.014;
  const keyMat = new THREE.MeshStandardMaterial({ color: "#252320", roughness: 0.55 });
  ROWS.forEach((row, ri) => {
    const units = row.reduce((s, k) => s + (WIDE[k] ?? 1), 0);
    const u = (KW - KGAP * (row.length - 1)) / units;
    let x = -KW / 2;
    const z = -0.88 + ri * (KD + KGAP) + KD / 2;
    for (const k of row) {
      const w = u * (WIDE[k] ?? 1);
      const id = w.toFixed(4);
      if (!geoCache.has(id)) geoCache.set(id, new RoundedBoxGeometry(w, KH, KD, 4, 0.011));
      const m = new THREE.Mesh(geoCache.get(id), keyMat.clone());
      m.position.set(x + w / 2, top + KH / 2 - 0.011, z);
      m.userData = { y: m.position.y, v: 0 };
      laptop.add(m);
      keyList.push(m);
      if (!keyMeshes.has(k)) keyMeshes.set(k, []);
      keyMeshes.get(k).push(m);
      x += w + KGAP;
    }
  });

  // lid on a hinge along the back edge; shut, it covers the base exactly
  const hinge = new THREE.Group();
  hinge.position.set(0, BT + GAP, -D / 2);
  laptop.add(hinge);
  const lidGeo = block(W, LT, H, R, LF).rotateX(-Math.PI / 2); // stand it up: height on y, thickness on z
  const lid = new THREE.Mesh(lidGeo, body);
  lid.position.set(0, H / 2, -LT / 2);
  hinge.add(lid);
  const bezel = new THREE.Mesh(flatRect(W - 2 * LF - 0.012, H - 2 * LF - 0.012, R - LF), bezelMat);
  bezel.position.set(0, H / 2, 0.0008);
  hinge.add(bezel);
  const display = new THREE.Mesh(flatRect(SW, SH, 0.035), screenMat);
  display.position.set(0, H / 2 + 0.025, 0.0016);
  hinge.add(display);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.014, 32), new THREE.MeshBasicMaterial({ color: "#2b3138" }));
  cam.position.set(0, H - 0.062, 0.0016);
  hinge.add(cam);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), logoMat);
  logo.rotation.x = Math.PI; // faces the back, reads upright once the lid is shut
  logo.position.set(0, H / 2, -LT - 0.0008);
  hinge.add(logo);

  const hits = [base, lid, bezel, display, trackpad, well];

  /* framing */
  let dirty = true;
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // frame a sphere around the open laptop on both axes
    const R = 2, tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(R / tv, R / (tv * camera.aspect));
    const el = 0.4; // camera elevation (rad)
    camera.position.set(0, target.y + Math.sin(el) * dist, target.z + Math.cos(el) * dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(fit).observe(canvas);

  /* theme: softer shadow on paper */
  const theme = () => { shadowMat.opacity = document.documentElement.dataset.theme === "light" ? 0.28 : 0.6; dirty = true; };
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  theme();

  /* state */
  let caretOn = true, caretAt = 0;
  let lidA = LID_SHUT, lidV = 0, power = 0;
  let tx = 0, ty = 0, rx = 0, ry = 0;
  on((type, k) => {
    if (type === "term" || type === "input") { caretOn = true; caretAt = performance.now(); screen.draw(true); dirty = true; }
    if (type === "key") for (const m of keyMeshes.get(k?.toLowerCase()) ?? []) { m.userData.v = 1; }
    if (type === "visible") running(k);
    wake();
  });
  screen.draw(true);

  /* pointer: lean + hover + click */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(hits, false).length > 0;
  };
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") canvas.style.cursor = hit(e) ? "pointer" : ""; });
  canvas.addEventListener("click", (e) => { if (hit(e)) toggle(); });
  if (!reduced && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
      wake();
    }, { passive: true });
  }

  /* loop: runs while something moves, sleeps otherwise */
  let raf = 0, last = 0, live = true;
  const float = !reduced;
  function running(v) { live = v && !document.hidden; if (live) wake(); }
  document.addEventListener("visibilitychange", () => running(!document.hidden));
  function wake() { if (!raf && live) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = float;

    // lid: damped spring, a hair of overshoot when opening; closing, it lands on
    // the deck and stops there (never sinks into the base)
    const goal = st.open ? LID_OPEN : LID_SHUT;
    if (reduced) { lidA = goal; lidV = 0; }
    else {
      const k = 38, c = 2 * (st.open ? 0.78 : 1) * Math.sqrt(k);
      lidV += (k * (goal - lidA) - c * lidV) * dt;
      lidA += lidV * dt;
      if (lidA >= LID_SHUT) { lidA = LID_SHUT; lidV = Math.min(0, lidV); }
      if (Math.abs(goal - lidA) + Math.abs(lidV) > 1e-4) moving = true; else { lidA = goal; lidV = 0; }
    }
    hinge.rotation.x = lidA;

    // the screen is lit whenever you can see it: brightness follows the lid
    // angle, so it never shows as a black panel while opening or closing
    const o = THREE.MathUtils.clamp((LID_SHUT - 0.06 - lidA) / 0.5, 0, 1);
    const p = o * o * (3 - 2 * o);
    if (Math.abs(p - power) > 1e-4) moving = true;
    power = p;
    screenMat.color.setScalar(power);
    glow.intensity = power * 0.7;

    // lean toward the pointer
    const s = 1 - Math.exp(-dt * 4.5);
    rx += (tx - rx) * s; ry += (ty - ry) * s;
    if (Math.abs(tx - rx) + Math.abs(ty - ry) > 1e-4) moving = true;
    const t = now / 1000;
    laptop.rotation.set(0.04 + ry * 0.07, -0.34 + rx * 0.3, 0);
    laptop.position.y = float ? Math.sin(t * 0.9) * 0.03 : 0;
    // keep the light glued to the screen
    glow.position.copy(hinge.localToWorld(new THREE.Vector3(0, H * 0.55, 0.35)));

    // keys
    for (const m of keyList) {
      const d = m.userData;
      if (d.v <= 0) continue;
      d.v = Math.max(0, d.v - dt * 3.2);
      const e = d.v * d.v;
      m.position.y = d.y - 0.009 * Math.min(1, d.v * 2);
      m.material.emissive.copy(ACCENT).multiplyScalar(e * 1.6);
      m.material.color.set("#252320").lerp(ACCENT, e * 0.8);
      moving = true;
    }

    // caret blink
    if (power > 0.5 && now - caretAt > 530) { caretAt = now; caretOn = !caretOn; screen.draw(caretOn); }
    if (power > 0) moving = true;

    renderer.render(scene, camera);
    dirty = false;
    if (!canvas.classList.contains("is-ready")) canvas.classList.add("is-ready");
    if ((moving || dirty) && live) raf = requestAnimationFrame(frame);
  }

  fit();
  wake();
  return { canvas };
}
