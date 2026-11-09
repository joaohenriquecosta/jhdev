// WebGL business card: embossed letters (normal-mapped, metal tipping),
// chip, iridescent hologram, debossed mirror on the back, spring physics
// for hover/drag and a "tre flip" (kickflip + 360 shove-it + half turn) on click.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MM_W = 85.6, MM_H = 53.98;            // ISO/IEC 7810 ID-1
const TEX_W = 2048, TEX_H = Math.round(TEX_W * MM_H / MM_W);
const S = TEX_W / MM_W;                      // px per mm
const W = 3.4, H = W * MM_H / MM_W, D = 0.028, R = 0.14;

const FONT_MONO = '"Geist Mono Variable", ui-monospace, monospace';
const FONT_SANS = '"Geist Variable", ui-sans-serif, system-ui, sans-serif';
const FONT_SERIF = '"Instrument Serif", Georgia, serif';

const COPY = {
  pt: {
    emboss: "APROVADO 2X NA USP",
    path: "ENG. CIVIL  →  ENG. DE PRODUÇÃO",
    valid: ["VÁLIDO", "ATÉ"],
    role: "Hub Smart Home · Southbridge",
    sig: "ASSINATURA AUTORIZADA",
    base: "base",
    fine: [
      "Cartão pessoal e intransferível. Se encontrado, devolva com um e-mail para",
      "contato@joaohenriquecosta.dev · uso sujeito a café e boas conversas.",
    ],
  },
  en: {
    emboss: "ADMITTED 2X TO USP",
    path: "CIVIL ENG.  →  PRODUCTION ENG.",
    valid: ["VALID", "THRU"],
    role: "Hub Smart Home · Southbridge",
    sig: "AUTHORISED SIGNATURE",
    base: "based",
    fine: [
      "Personal and non-transferable. If found, please return it by emailing",
      "contato@joaohenriquecosta.dev · use subject to coffee and good conversation.",
    ],
  },
};
const NAME = "JOÃO HENRIQUE S COSTA";

/* ── canvas helpers ─────────────────────────── */
const mk = () => {
  const c = document.createElement("canvas");
  c.width = TEX_W; c.height = TEX_H;
  return [c, c.getContext("2d", { willReadFrequently: true })];
};
const mm = (v) => v * S;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(mm(x), mm(y), mm(w), mm(h), mm(r));
}

function monogram(ctx, x, y, size, color, width) {
  const k = mm(size) / 40;
  ctx.save();
  ctx.translate(mm(x), mm(y));
  ctx.scale(k, k);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(14, 7); ctx.lineTo(14, 24.5); ctx.bezierCurveTo(14, 28.9, 11.4, 32, 7, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 7); ctx.lineTo(22, 33); ctx.moveTo(22, 20); ctx.lineTo(33, 20); ctx.moveTo(33, 7); ctx.lineTo(33, 33); ctx.stroke();
  ctx.restore();
}

// Fine sine-wave security pattern, like the printing on old bank cards.
function guilloche(ctx, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.1;
  for (let i = 0; i < 46; i++) {
    ctx.beginPath();
    for (let x = 0; x <= TEX_W; x += 8) {
      const y = TEX_H * 0.5 + (i - 23) * 26 + Math.sin(x / 120 + i * 0.35) * 60 + Math.sin(x / 47 + i) * 9;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Embossed text: one call draws the same glyphs into colour, roughness/metal
// and height canvases so the relief, the foil tipping and the shading line up.
function emboss(layers, text, x, y, size, spacing) {
  const { color, rm, height } = layers;
  const font = `600 ${mm(size)}px ${FONT_MONO}`;
  for (const ctx of [color, rm, height]) { ctx.font = font; ctx.letterSpacing = `${mm(spacing)}px`; ctx.textBaseline = "alphabetic"; }

  // foil tipping: warm gold with a soft vertical sheen
  const g = color.createLinearGradient(0, mm(y - size), 0, mm(y));
  g.addColorStop(0, "#f4dfa6"); g.addColorStop(0.45, "#c99a45"); g.addColorStop(1, "#8f6a2c");
  color.fillStyle = g;
  color.fillText(text, mm(x), mm(y));

  rm.fillStyle = "rgb(0,72,255)"; // G = roughness, B = metalness
  rm.fillText(text, mm(x), mm(y));

  // height: blurred halo + crisp core = rounded, pressed-metal profile
  height.save();
  height.fillStyle = "#fff";
  height.shadowColor = "#fff"; height.shadowBlur = mm(0.55);
  height.fillText(text, mm(x), mm(y));
  height.shadowBlur = 0; height.globalAlpha = 0.85;
  height.fillText(text, mm(x), mm(y));
  height.restore();
}

function heightToNormal(heightCanvas, strength) {
  const [out, octx] = mk();
  const src = heightCanvas.getContext("2d").getImageData(0, 0, TEX_W, TEX_H).data;
  const hgt = new Float32Array(TEX_W * TEX_H);
  for (let i = 0, j = 0; i < hgt.length; i++, j += 4) hgt[i] = src[j] / 255;
  const img = octx.createImageData(TEX_W, TEX_H);
  const d = img.data;
  d.fill(255);
  for (let i = 0; i < hgt.length; i++) { d[i * 4] = 128; d[i * 4 + 1] = 128; }
  for (let y = 1; y < TEX_H - 1; y++) {
    const r0 = (y - 1) * TEX_W, r1 = y * TEX_W, r2 = (y + 1) * TEX_W;
    for (let x = 1; x < TEX_W - 1; x++) {
      const dx = hgt[r0 + x + 1] + 2 * hgt[r1 + x + 1] + hgt[r2 + x + 1] - hgt[r0 + x - 1] - 2 * hgt[r1 + x - 1] - hgt[r2 + x - 1];
      const dy = hgt[r2 + x - 1] + 2 * hgt[r2 + x] + hgt[r2 + x + 1] - hgt[r0 + x - 1] - 2 * hgt[r0 + x] - hgt[r0 + x + 1];
      if (dx === 0 && dy === 0) continue;
      const nx = -dx * strength, ny = dy * strength, l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const k = (r1 + x) * 4;
      d[k] = (nx * l * 0.5 + 0.5) * 255; d[k + 1] = (ny * l * 0.5 + 0.5) * 255; d[k + 2] = (l * 0.5 + 0.5) * 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function drawFront(t) {
  const [cColor, color] = mk(), [cRm, rm] = mk(), [cH, height] = mk(), [cIri, iri] = mk();
  const layers = { color, rm, height };

  // pearl base
  const bg = color.createLinearGradient(0, 0, TEX_W, TEX_H);
  bg.addColorStop(0, "#efe6d3"); bg.addColorStop(0.55, "#e2d5bb"); bg.addColorStop(1, "#cfbf9f");
  color.fillStyle = bg; color.fillRect(0, 0, TEX_W, TEX_H);
  guilloche(color, "#b9a684", 0.22);
  const glow = color.createRadialGradient(mm(70), mm(8), 0, mm(70), mm(8), mm(60));
  glow.addColorStop(0, "rgba(255,91,53,.10)"); glow.addColorStop(1, "rgba(255,91,53,0)");
  color.fillStyle = glow; color.fillRect(0, 0, TEX_W, TEX_H);

  rm.fillStyle = "rgb(0,150,0)"; rm.fillRect(0, 0, TEX_W, TEX_H); // satin plastic
  height.fillStyle = "#000"; height.fillRect(0, 0, TEX_W, TEX_H);
  iri.fillStyle = "#000"; iri.fillRect(0, 0, TEX_W, TEX_H);

  // printed header
  monogram(color, 6.2, 4.6, 8.4, "#1a1813", 3.4);
  color.fillStyle = "#1a1813";
  color.font = `500 ${mm(2.5)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.12)}px`;
  color.textAlign = "right";
  color.font = `500 ${mm(2.6)}px ${FONT_SANS}`; color.letterSpacing = "0px";
  color.fillStyle = "#4a453b";
  color.fillText(t.role, mm(MM_W - 6), mm(10.4));
  color.textAlign = "left";

  // EMV chip
  const cx = 8.2, cy = 16.2, cw = 11.6, ch = 8.9;
  const chip = color.createLinearGradient(mm(cx), mm(cy), mm(cx + cw), mm(cy + ch));
  chip.addColorStop(0, "#f1d998"); chip.addColorStop(0.5, "#b8904a"); chip.addColorStop(1, "#e9cd85");
  roundRectPath(color, cx, cy, cw, ch, 1.4); color.fillStyle = chip; color.fill();
  color.strokeStyle = "rgba(70,48,12,.55)"; color.lineWidth = mm(0.18);
  color.beginPath();
  color.moveTo(mm(cx), mm(cy + ch / 3)); color.lineTo(mm(cx + cw * 0.36), mm(cy + ch / 3));
  color.moveTo(mm(cx), mm(cy + ch * 2 / 3)); color.lineTo(mm(cx + cw * 0.36), mm(cy + ch * 2 / 3));
  color.moveTo(mm(cx + cw), mm(cy + ch / 3)); color.lineTo(mm(cx + cw * 0.64), mm(cy + ch / 3));
  color.moveTo(mm(cx + cw), mm(cy + ch * 2 / 3)); color.lineTo(mm(cx + cw * 0.64), mm(cy + ch * 2 / 3));
  color.rect(mm(cx + cw * 0.36), mm(cy + ch * 0.22), mm(cw * 0.28), mm(ch * 0.56));
  color.moveTo(mm(cx + cw / 2), mm(cy)); color.lineTo(mm(cx + cw / 2), mm(cy + ch * 0.22));
  color.moveTo(mm(cx + cw / 2), mm(cy + ch * 0.78)); color.lineTo(mm(cx + cw / 2), mm(cy + ch));
  color.stroke();
  roundRectPath(rm, cx, cy, cw, ch, 1.4); rm.fillStyle = "rgb(0,95,255)"; rm.fill();
  roundRectPath(height, cx - 0.2, cy - 0.2, cw + 0.4, ch + 0.4, 1.5); height.fillStyle = "rgb(40,40,40)"; height.fill();

  // hologram patch
  const hx = 61.5, hy = 14.6, hw = 17.6, hh = 12.2;
  color.save();
  roundRectPath(color, hx, hy, hw, hh, 1.2); color.clip();
  const holo = color.createLinearGradient(mm(hx), mm(hy), mm(hx + hw), mm(hy + hh));
  ["#d8dde6", "#f3d7e6", "#d6eef0", "#efe9c9", "#dcd6f2", "#d8dde6"].forEach((c, i, a) => holo.addColorStop(i / (a.length - 1), c));
  color.fillStyle = holo; color.fillRect(mm(hx), mm(hy), mm(hw), mm(hh));
  color.strokeStyle = "rgba(255,255,255,.7)"; color.lineWidth = mm(0.12);
  for (let r = 1; r < 14; r++) { color.beginPath(); color.arc(mm(hx + hw * 0.3), mm(hy + hh * 0.55), mm(r * 0.9), 0, Math.PI * 2); color.stroke(); }
  color.fillStyle = "rgba(40,40,60,.55)";
  color.font = `italic ${mm(7.4)}px ${FONT_SERIF}`; color.letterSpacing = "0px";
  color.fillText("2×", mm(hx + hw * 0.5), mm(hy + hh * 0.72));
  color.font = `600 ${mm(2.1)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.3)}px`;
  color.fillText("USP", mm(hx + 1.6), mm(hy + 3.4));
  color.restore();
  roundRectPath(rm, hx, hy, hw, hh, 1.2); rm.fillStyle = "rgb(0,38,255)"; rm.fill();
  roundRectPath(iri, hx, hy, hw, hh, 1.2); iri.fillStyle = "#fff"; iri.fill();
  roundRectPath(height, hx, hy, hw, hh, 1.2); height.fillStyle = "rgb(18,18,18)"; height.fill();

  // embossed lines
  emboss(layers, t.emboss, 7.6, 35.2, 4.6, 0.32);
  color.fillStyle = "#6b6456";
  color.font = `500 ${mm(1.9)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.14)}px`;
  color.fillText(t.path, mm(7.8), mm(39.4));

  color.font = `500 ${mm(1.35)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.08)}px`;
  color.fillText(t.valid[0], mm(46.5), mm(43.6)); color.fillText(t.valid[1], mm(46.5), mm(45.4));
  emboss(layers, "∞", 53, 45.6, 3.8, 0);

  emboss(layers, NAME, 7.6, 49.6, 3.5, 0.26);

  // brand mark, bottom right
  color.textAlign = "right"; color.letterSpacing = "0px";
  color.fillStyle = "#1a1813";
  color.font = `${mm(8.2)}px ${FONT_SERIF}`;
  color.fillText("USP", mm(MM_W - 6.2), mm(50.2));
  color.fillStyle = "#c23d1c";
  color.font = `italic ${mm(5.2)}px ${FONT_SERIF}`;
  const uspW = color.measureText("USP").width;
  color.font = `${mm(8.2)}px ${FONT_SERIF}`;
  const w2 = color.measureText("USP").width;
  color.font = `italic ${mm(5.2)}px ${FONT_SERIF}`;
  color.fillText("2×", mm(MM_W - 6.2) - w2 - mm(1), mm(46.4));
  void uspW;
  color.textAlign = "left";

  return { color: cColor, rm: cRm, height: cH, iri: cIri };
}

function drawBack(t, frontHeight) {
  const [cColor, color] = mk(), [cRm, rm] = mk(), [cH, height] = mk();

  const bg = color.createLinearGradient(0, 0, TEX_W, TEX_H);
  bg.addColorStop(0, "#e9dfca"); bg.addColorStop(1, "#d6c8ab");
  color.fillStyle = bg; color.fillRect(0, 0, TEX_W, TEX_H);
  guilloche(color, "#b9a684", 0.12);
  rm.fillStyle = "rgb(0,150,0)"; rm.fillRect(0, 0, TEX_W, TEX_H);
  height.fillStyle = "#000"; height.fillRect(0, 0, TEX_W, TEX_H);

  // magnetic stripe
  const ms = color.createLinearGradient(0, mm(4.5), 0, mm(14));
  ms.addColorStop(0, "#1b1a17"); ms.addColorStop(0.5, "#2a2722"); ms.addColorStop(1, "#141310");
  color.fillStyle = ms; color.fillRect(0, mm(4.6), TEX_W, mm(9.4));
  rm.fillStyle = "rgb(0,60,90)"; rm.fillRect(0, mm(4.6), TEX_W, mm(9.4));

  // signature panel
  const sx = 6, sy = 18.2, sw = 50, sh = 8.6;
  color.save();
  roundRectPath(color, sx, sy, sw, sh, 0.6); color.clip();
  color.fillStyle = "#fbf8f1"; color.fillRect(mm(sx), mm(sy), mm(sw), mm(sh));
  color.strokeStyle = "rgba(194,61,28,.18)"; color.lineWidth = mm(0.35);
  for (let x = -20; x < sw + 20; x += 1.6) { color.beginPath(); color.moveTo(mm(sx + x), mm(sy)); color.lineTo(mm(sx + x + 6), mm(sy + sh)); color.stroke(); }
  color.fillStyle = "#1f2a5c";
  color.font = `italic ${mm(6.4)}px ${FONT_SERIF}`; color.letterSpacing = "0px";
  color.fillText("J. H. Costa", mm(sx + 3), mm(sy + 6.6));
  color.restore();
  color.fillStyle = "#7a7365";
  color.font = `500 ${mm(1.3)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.1)}px`;
  color.fillText(t.sig, mm(sx), mm(sy - 1.1));
  // "CVV" box
  roundRectPath(color, sx + sw + 2, sy, 13, sh, 0.6); color.fillStyle = "#fbf8f1"; color.fill();
  color.fillStyle = "#1a1813";
  color.font = `italic ${mm(5.4)}px ${FONT_SERIF}`;
  color.fillText("2×", mm(sx + sw + 4.2), mm(sy + 6.3));

  // contact rows
  const rows = [["email", "contato@joaohenriquecosta.dev"], ["linkedin", "/in/joaohenrique-costa"], ["github", "@joaohenriquecosta"], [t.base, "São Carlos, SP — BR"]];
  rows.forEach(([k, v], i) => {
    const y = 33 + i * 4.3;
    color.fillStyle = "#c23d1c";
    color.font = `600 ${mm(1.55)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.14)}px`;
    color.fillText(k.toUpperCase(), mm(6), y * S);
    color.fillStyle = "#1a1813";
    color.font = `500 ${mm(2.35)}px ${FONT_MONO}`; color.letterSpacing = `${mm(0.02)}px`;
    color.fillText(v, mm(20), y * S);
  });
  monogram(color, MM_W - 15, 31.5, 9, "rgba(26,24,19,.85)", 3.2);

  color.fillStyle = "#8a8375";
  color.font = `400 ${mm(1.25)}px ${FONT_SANS}`; color.letterSpacing = "0px";
  t.fine.forEach((line, i) => color.fillText(line, mm(6), mm(50.2 + i * 1.75)));

  // debossed mirror of the front embossing (that is how real cards look)
  height.save();
  height.translate(TEX_W, 0); height.scale(-1, 1);
  height.drawImage(frontHeight, 0, 0);
  height.restore();

  return { color: cColor, rm: cRm, height: cH };
}

/* ── geometry ───────────────────────────────── */
function cardShape() {
  const s = new THREE.Shape(), x = -W / 2, y = -H / 2;
  s.moveTo(x + R, y);
  s.lineTo(x + W - R, y); s.absarc(x + W - R, y + R, R, -Math.PI / 2, 0, false);
  s.lineTo(x + W, y + H - R); s.absarc(x + W - R, y + H - R, R, 0, Math.PI / 2, false);
  s.lineTo(x + R, y + H); s.absarc(x + R, y + H - R, R, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + R); s.absarc(x + R, y + R, R, Math.PI, Math.PI * 1.5, false);
  return s;
}
function faceGeometry(shape) {
  const g = new THREE.ShapeGeometry(shape, 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, (p.getY(i) + H / 2) / H);
  return g;
}

/* ── springs & easing ───────────────────────── */
class Spring {
  constructor(v = 0, k = 90, c = 13) { this.x = v; this.v = 0; this.target = v; this.k = k; this.c = c; }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h; this.x += this.v * h; }
  }
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const inOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outBack = (x) => { const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/* ── main ───────────────────────────────────── */
export async function mountCard({ stage, button, shadow, getLang, reduced }) {
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return null;

  await Promise.all([
    `600 40px ${FONT_MONO}`, `500 40px ${FONT_MONO}`, `500 40px ${FONT_SANS}`, `400 40px ${FONT_SANS}`,
    `40px ${FONT_SERIF}`, `italic 40px ${FONT_SERIF}`,
  ].map((f) => document.fonts.load(f).catch(() => {})));

  const canvas = document.createElement("canvas");
  canvas.className = "card3d";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.7);
  key.position.set(2.5, 3, 5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.12));
  const rim = new THREE.DirectionalLight(0xff7a52, 0.9);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };

  const shape = cardShape();
  const body = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 32 });
  body.translate(0, 0, -D / 2);
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0xc9b996, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const face = faceGeometry(shape);
  const zFace = D / 2 + 0.0045;

  const frontMat = new THREE.MeshPhysicalMaterial({
    roughness: 1, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.32,
    iridescence: 1, iridescenceIOR: 1.6,
    normalScale: new THREE.Vector2(1, 1),
  });
  const backMat = new THREE.MeshPhysicalMaterial({
    roughness: 1, metalness: 1, clearcoat: 0.35, clearcoatRoughness: 0.36,
    normalScale: new THREE.Vector2(1, 1),
  });

  const card = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body, edgeMat);
  const front = new THREE.Mesh(face, frontMat); front.position.z = zFace;
  const back = new THREE.Mesh(face, backMat); back.rotation.y = Math.PI; back.position.z = -zFace;
  card.add(bodyMesh, front, back);
  const pivot = new THREE.Group();
  pivot.add(card);
  scene.add(pivot);

  let owned = new Set();
  function paint() {
    const t = COPY[getLang()] ?? COPY.pt;
    const f = drawFront(t);
    const b = drawBack(t, f.height);
    const old = owned; owned = new Set();
    const frm = tex(f.rm, false), brm = tex(b.rm, false);
    const maps = {
      front: { map: tex(f.color, true), roughnessMap: frm, metalnessMap: frm, normalMap: tex(heightToNormal(f.height, 2.6), false), iridescenceMap: tex(f.iri, false) },
      back: { map: tex(b.color, true), roughnessMap: brm, metalnessMap: brm, normalMap: tex(heightToNormal(b.height, 0.9), false) },
    };
    Object.assign(frontMat, maps.front); frontMat.needsUpdate = true;
    Object.assign(backMat, maps.back); backMat.needsUpdate = true;
    for (const m of [maps.front, maps.back]) Object.values(m).forEach((x) => owned.add(x));
    old.forEach((x) => x.dispose());
  }
  paint();

  // the back holds the mirrored front relief; a negative scale turns it into a deboss
  backMat.normalScale.set(-1, -1);

  /* sizing */
  const fit = () => {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, canvas.clientHeight || r.width * 0.92);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const wantW = W / 0.7; // card fills ~70% of the width at rest
    const dist = (wantW / camera.aspect) / 2 / Math.tan(vFov / 2);
    camera.position.set(0, 0, Math.max(dist, (H / 0.6) / 2 / Math.tan(vFov / 2)));
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(stage);
  fit();

  /* state */
  const yaw = new Spring(0, 70, 11), pitch = new Spring(0, 70, 11), roll = new Spring(0, 60, 10);
  const lift = new Spring(0, 120, 12);
  let restYaw = 0;
  let hoverX = 0, hoverY = 0, lastPointerAt = -1e9;
  let dragging = null, flip = null;
  const keyTarget = new THREE.Vector3(2.5, 3, 5);

  const setFace = () => {
    const facing = Math.round(restYaw / Math.PI) % 2 !== 0;
    button.setAttribute("aria-pressed", String(facing));
  };

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" && !dragging) return;
    const r = canvas.getBoundingClientRect();
    hoverX = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.7)));
    hoverY = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.7)));
    lastPointerAt = performance.now();
  }, { passive: true });

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), vx: 0, vy: 0, lt: performance.now() };
    canvas.classList.add("is-grabbing");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const now = performance.now(), dt = Math.max(1, now - dragging.lt);
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    const k = 0.0105;
    yaw.x += dx * k; yaw.target = yaw.x;
    pitch.x = Math.max(-1.1, Math.min(1.1, pitch.x + dy * k * 0.8)); pitch.target = pitch.x;
    roll.target = Math.max(-0.25, Math.min(0.25, -dx * 0.004));
    dragging.vx = (dx * k) / (dt / 1000); dragging.vy = (dy * k * 0.8) / (dt / 1000);
    dragging.x = e.clientX; dragging.y = e.clientY; dragging.lt = now;
  });
  const release = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const moved = Math.hypot(e.clientX - dragging.x0, e.clientY - dragging.y0);
    const quick = performance.now() - dragging.t0 < 450;
    canvas.classList.remove("is-grabbing");
    if (moved < 6 && quick && e.type === "pointerup") {
      dragging = null;
      kickflip();
      return;
    }
    // carry the throw, then settle on the nearest face
    yaw.v = dragging.vx * 0.9; pitch.v = dragging.vy * 0.9;
    const projected = yaw.x + yaw.v * 0.22;
    restYaw = Math.round(projected / Math.PI) * Math.PI;
    roll.target = 0;
    dragging = null;
    setFace();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  function kickflip() {
    if (flip) return;
    flip = { t0: performance.now(), dur: reduced ? 650 : 1650, dir: Math.random() < 0.5 ? 1 : -1 };
  }
  button.addEventListener("click", (e) => { e.preventDefault(); kickflip(); });

  addEventListener("langchange", paint);

  /* loop */
  const qFlip = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  let last = performance.now(), visible = true, raf = 0;

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    const idle = now - lastPointerAt > 2600 && !dragging;
    const hx = idle ? (reduced ? 0 : Math.sin(t * 0.55) * 0.32) : hoverX * 0.5;
    const hy = idle ? (reduced ? 0 : Math.cos(t * 0.43) * 0.14) : hoverY * 0.36;

    if (!dragging) {
      yaw.target = restYaw + hx;
      pitch.target = hy;
      roll.target = idle ? (reduced ? 0 : Math.sin(t * 0.37) * 0.035) : -hoverX * 0.05;
    }
    yaw.step(dt); pitch.step(dt); roll.step(dt);

    qFlip.identity();
    let bob = reduced ? 0 : Math.sin(t * 1.15) * 0.035;
    if (flip) {
      const p = clamp01((now - flip.t0) / flip.dur);
      if (reduced) {
        qFlip.setFromAxisAngle(AY, Math.PI * inOutCubic(p));
      } else {
        const d = flip.dir;
        // pop: anticipate, launch, hang, land
        const up = p < 0.08 ? -0.18 * Math.sin((p / 0.08) * Math.PI) : Math.sin(Math.PI * seg(p, 0.08, 0.92)) ** 0.85;
        lift.x = up * 0.62; lift.v = 0;
        const eY = smoother(seg(p, 0.14, 0.96));            // half turn: lands on the other face
        const eX = inOutCubic(seg(p, 0.08, 0.82));          // kickflip around the long axis
        const eZ = outBack(seg(p, 0.1, 0.9));               // 360 shove-it, settles with a hint of overshoot
        qa.setFromAxisAngle(AY, Math.PI * eY * d);
        qb.setFromAxisAngle(AX, Math.PI * 2 * eX);
        qc.setFromAxisAngle(AZ, Math.PI * 2 * eZ * -d);
        qFlip.copy(qa).multiply(qb).multiply(qc);
        flip.d = d;
      }
      if (p >= 1) {
        const d = reduced ? 1 : flip.d;
        restYaw += Math.PI * d; yaw.x += Math.PI * d; yaw.target += Math.PI * d;
        qFlip.identity();
        if (!reduced) { lift.x = 0; lift.v = -3.2; pitch.v += 2.6; roll.v += 1.4 * d; }
        flip = null;
        setFace();
      }
    } else {
      lift.target = 0;
      lift.step(dt);
    }

    euler.set(pitch.x, 0, roll.x);
    qa.setFromAxisAngle(AY, yaw.x);
    pivot.quaternion.copy(qa).multiply(qFlip).multiply(qb.setFromEuler(euler));
    pivot.position.set(0, lift.x * 0.7 + bob, lift.x * 0.25);

    // key light glides with the pointer so the foil and hologram catch it
    keyTarget.set(2.5 + hx * 4, 3 - hy * 4, 5);
    key.position.lerp(keyTarget, 1 - Math.exp(-dt * 4));

    if (shadow) {
      const l = Math.max(0, lift.x);
      shadow.style.transform = `scale(${1 - l * 0.35}, ${1 - l * 0.25})`;
      shadow.style.opacity = String(1 - l * 0.55);
    }

    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  stage.classList.add("is-gl");
  raf = requestAnimationFrame(frame);
  return { kickflip };
}
