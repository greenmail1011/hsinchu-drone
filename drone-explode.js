// 無人機足球｜零件拆解（捲動驅動 3D）
// 往下捲：球殼打開、零件逐層分離；往上捲：組回去。全部由捲動進度 p（0→1）決定，沒有獨立動畫狀態。
import * as THREE from './vendor/three.module.min.js';

const root = document.getElementById('drone-soccer');
const stage = root.querySelector('.ds-stage');
const canvas = root.querySelector('canvas');
const steps = [...root.querySelectorAll('.ds-step')];
const labelBox = root.querySelector('.ds-labels');
const bar = root.querySelector('.ds-bar i');

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const win = (p, s, e) => ease(clamp((p - s) / (e - s)));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  root.classList.add('ds-nogl');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x0a1020, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x5aa8ff, 1.6); rim.position.set(-6, 2, -4); scene.add(rim);
const warm = new THREE.PointLight(0xff8a3c, 6, 12); warm.position.set(0, -3, 3); scene.add(warm);

const ball = new THREE.Group(); scene.add(ball);

/* ---------- 材質 ---------- */
const M = {
  cage: new THREE.MeshStandardMaterial({ color: 0x2f86ff, roughness: 0.35, metalness: 0.1, emissive: 0x0b3a8a, emissiveIntensity: 0.55 }),
  joint: new THREE.MeshStandardMaterial({ color: 0x9cc6ff, roughness: 0.3, emissive: 0x1d5fd1, emissiveIntensity: 0.6 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.45, metalness: 0.6 }),
  motor: new THREE.MeshStandardMaterial({ color: 0xc9d2de, roughness: 0.25, metalness: 0.9 }),
  motorCap: new THREE.MeshStandardMaterial({ color: 0xf26b0f, roughness: 0.4, metalness: 0.3 }),
  prop: new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.5, transparent: true, opacity: 0.92 }),
  pcb: new THREE.MeshStandardMaterial({ color: 0x0f6b46, roughness: 0.6, metalness: 0.2 }),
  chip: new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.3, metalness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe8b84a, roughness: 0.3, metalness: 0.9 }),
  batt: new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.55, metalness: 0.2 }),
  battBand: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.6 }),
  led: new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2a1f, emissiveIntensity: 2.2, roughness: 0.4 })
};

/* ---------- 球殼：截角二十面體（足球紋路）的 90 條邊 ---------- */
const R = 1;
const ico = new THREE.IcosahedronGeometry(1, 0);
const pos = ico.getAttribute('position');
const verts = [], vkey = new Map(), faces = [];
for (let i = 0; i < pos.count; i += 3) {
  const f = [];
  for (let j = 0; j < 3; j++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i + j);
    const k = v.toArray().map((n) => n.toFixed(4)).join(',');
    if (!vkey.has(k)) { vkey.set(k, verts.length); verts.push(v); }
    f.push(vkey.get(k));
  }
  faces.push(f);
}
const P = (a, b) => verts[a].clone().lerp(verts[b], 1 / 3).normalize().multiplyScalar(R);
const segs = [], seen = new Set();
const addSeg = (u, v) => segs.push([u, v]);
faces.forEach(([a, b, c]) => {
  addSeg(P(a, b), P(a, c)); addSeg(P(b, a), P(b, c)); addSeg(P(c, a), P(c, b)); // 五邊形的邊
  [[a, b], [b, c], [c, a]].forEach(([x, y]) => {                               // 六邊形共用的邊
    const k = x < y ? x + '-' + y : y + '-' + x;
    if (!seen.has(k)) { seen.add(k); addSeg(P(x, y), P(y, x)); }
  });
});

function shell(list) {
  const g = new THREE.Group();
  const tube = new THREE.CylinderGeometry(0.02, 0.02, 1, 8, 1, true);
  const im = new THREE.InstancedMesh(tube, M.cage, list.length);
  const jm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.034, 10, 8), M.joint, list.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
  list.forEach(([u, v], i) => {
    const d = v.clone().sub(u), len = d.length();
    q.setFromUnitVectors(up, d.clone().normalize());
    m4.compose(u.clone().add(v).multiplyScalar(0.5), q, s.set(1, len, 1));
    im.setMatrixAt(i, m4);
    jm.setMatrixAt(i * 2, m4.clone().makeTranslation(u.x, u.y, u.z));
    jm.setMatrixAt(i * 2 + 1, m4.clone().makeTranslation(v.x, v.y, v.z));
  });
  g.add(im, jm);
  return g;
}
const mid = ([u, v]) => (u.y + v.y) / 2;
const shellTop = shell(segs.filter((s) => mid(s) >= 0));
const shellBot = shell(segs.filter((s) => mid(s) < 0));

/* ---------- 機身 ---------- */
const ARM = 0.6;
const frame = new THREE.Group();
[Math.PI / 4, -Math.PI / 4].forEach((r) => {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(ARM * 2 + 0.1, 0.035, 0.085), M.frame);
  arm.rotation.y = r; frame.add(arm);
});
frame.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 6), M.frame));
// 機架連到球殼的四支支柱
[0, 1, 2, 3].forEach((i) => {
  const a = Math.PI / 4 + (i * Math.PI) / 2;
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, R - ARM - 0.06, 6), M.frame);
  strut.rotation.z = Math.PI / 2; strut.rotation.y = -a;
  strut.position.set(Math.cos(a) * (ARM + (R - ARM) / 2), 0, Math.sin(a) * (ARM + (R - ARM) / 2));
  frame.add(strut);
});

const motors = [], props = [];
[0, 1, 2, 3].forEach((i) => {
  const a = Math.PI / 4 + (i * Math.PI) / 2;
  const x = Math.cos(a) * ARM, z = Math.sin(a) * ARM;
  const m = new THREE.Group();
  m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 24), M.motor));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), M.motorCap); cap.position.y = 0.07; m.add(cap);
  m.userData.home = new THREE.Vector3(x, 0.07, z); m.userData.dir = new THREE.Vector3(x, 0, z).normalize();
  motors.push(m);

  const p = new THREE.Group();
  [0, 1].forEach((k) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.042), M.prop);
    blade.position.x = (k ? -1 : 1) * 0.105; blade.rotation.x = (k ? -1 : 1) * 0.28; p.add(blade);
  });
  p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), M.prop));
  p.userData.home = new THREE.Vector3(x, 0.16, z); p.userData.dir = m.userData.dir; p.userData.cw = i % 2 ? 1 : -1; // A 槳／B 槳轉向相反
  props.push(p);
});

const fc = new THREE.Group();
fc.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.26), M.pcb));
[[0, 0, 0.09, 0.09], [-0.075, 0.07, 0.05, 0.04], [0.08, -0.07, 0.04, 0.06]].forEach(([x, z, w, d]) => {
  const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), M.chip); c.position.set(x, 0.02, z); fc.add(c);
});
[[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]].forEach(([x, z]) => {
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 10), M.gold); pad.position.set(x, 0.004, z); fc.add(pad);
});

const batt = new THREE.Group();
batt.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.17), M.batt));
const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.104, 0.174), M.battBand); band.position.x = -0.06; batt.add(band);

const led = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 10, 64), M.led); led.rotation.x = Math.PI / 2;

ball.add(shellTop, shellBot, frame, fc, batt, led, ...motors, ...props);

/* ---------- 零件位置 = f(捲動進度) ---------- */
const HOME = { fc: 0.045, batt: -0.085, led: -0.02 };
function layout(p, t) {
  const back = 1 - win(p, 0.86, 0.98);      // 最後一段：組回去
  const open = win(p, 0.12, 0.34) * back;   // 球殼打開
  const lift = win(p, 0.34, 0.54) * back;   // 螺旋槳、馬達
  const core = win(p, 0.54, 0.76) * back;   // 飛控、電池、燈條
  const all = win(p, 0.12, 0.76) * back;

  shellTop.position.y = open * 1.45;  shellTop.rotation.y = open * 0.5;
  shellBot.position.y = -open * 1.45; shellBot.rotation.y = -open * 0.5;

  motors.forEach((m) => m.position.copy(m.userData.home).addScaledVector(m.userData.dir, lift * 0.5).setY(m.userData.home.y + lift * 0.3));
  const spin = 1 - win(p, 0.1, 0.3) * (1 - win(p, 0.9, 1)); // 拆開時槳停下來，組回去再轉
  props.forEach((pr, i) => {
    pr.position.copy(pr.userData.home).addScaledVector(pr.userData.dir, lift * 0.5).setY(pr.userData.home.y + lift * 0.95);
    pr.rotation.y = pr.userData.cw * (spin * t * 38 + (1 - spin) * (0.6 + i * 0.4));
  });

  fc.position.y = HOME.fc + core * 0.62;
  batt.position.y = HOME.batt - core * 0.85;
  led.position.y = HOME.led - core * 0.42; led.scale.setScalar(1 + core * 0.25);
  M.led.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5;

  ball.rotation.y = t * 0.12 + p * Math.PI * 1.35;
  ball.rotation.x = 0.12 + all * 0.3;
  ball.rotation.z = Math.sin(t * 0.5) * 0.03 * (1 - all);
  ball.position.y = Math.sin(t * 1.3) * 0.035 * (1 - all); // 組裝時微微懸浮

  // 桌機：模型靠右，文字在左；手機：模型置中偏上
  const wide = stage.clientWidth > 860;
  const pull = Math.max(open, all);
  const dist = (wide ? 6.4 : 8.4) + pull * (wide ? 4.6 : 5.6);
  camera.position.set(0, 0.25 + pull * 0.6, dist);
  camera.lookAt(0, 0, 0);
  const off = wide ? -stage.clientWidth * 0.2 : 0, offY = wide ? 0 : stage.clientHeight * 0.13;
  camera.setViewOffset(stage.clientWidth, stage.clientHeight, off, offY, stage.clientWidth, stage.clientHeight);
}

/* ---------- 標籤 ---------- */
const wp = (o) => o.getWorldPosition(new THREE.Vector3());
const extreme = (list, sign) => list.map(wp).sort((a, b) => sign * (b.clone().project(camera).x - a.clone().project(camera).x))[0];
const LABELS = [
  { t: '防護球殼', d: '足球紋路的框架，撞到也能繼續飛', at: () => shellTop.localToWorld(new THREE.Vector3(0, 0.99, 0)), s: 0.2, side: 1 },
  { t: '螺旋槳', d: 'A 槳、B 槳轉向相反，裝錯就飛不起來', at: () => extreme(props, 1), s: 0.4, side: 1 },
  { t: '馬達', d: '入門用有刷，進階賽事用無刷', at: () => extreme(motors, -1), s: 0.44, side: -1 },
  { t: '飛控板', d: '感測姿態、不斷修正，球才飛得穩', at: () => wp(fc), s: 0.6, side: 1 },
  { t: 'LED 燈條', d: '紅藍兩色分辨隊伍', at: () => { const c = wp(led), r = 0.3 * led.scale.x; const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); return c.addScaledVector(right, -r); }, s: 0.64, side: -1 },
  { t: '電池', d: '一局三分鐘，打完就換', at: () => wp(batt), s: 0.68, side: 1 }
].map((l) => {
  const el = document.createElement('div');
  el.className = 'ds-label' + (l.side < 0 ? ' left' : '');
  el.innerHTML = '<i></i><span><b>' + l.t + '</b><em>' + l.d + '</em></span>';
  labelBox.appendChild(el);
  return Object.assign(l, { el });
});
function placeLabels(p) {
  const w = stage.clientWidth, h = stage.clientHeight, out = win(p, 0.84, 0.9);
  LABELS.forEach((l) => {
    const v = l.at().project(camera);
    const o = clamp((p - l.s) / 0.06) * (1 - out);
    l.el.style.opacity = o;
    l.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
  });
}

/* ---------- 捲動 ---------- */
function progress() {
  const r = root.getBoundingClientRect();
  return clamp(-r.top / (r.height - window.innerHeight));
}
const STEP_AT = [0, 0.14, 0.36, 0.56, 0.78, 0.92, 1.01];
function showStep(p) {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) if (p >= STEP_AT[i]) idx = i;
  steps.forEach((s, i) => s.classList.toggle('on', i === idx));
  bar.style.transform = 'scaleX(' + p + ')';
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

let visible = false, shown = 0;
new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '200px' }).observe(root);
const clock = new THREE.Clock();
function frame_() {
  requestAnimationFrame(frame_);
  if (!visible) return;
  const target = progress();
  shown += (target - shown) * 0.14;             // 一點點阻尼，捲動才不會生硬
  if (Math.abs(target - shown) < 0.0004) shown = target;
  const t = clock.getElapsedTime();
  layout(shown, t);
  ball.updateMatrixWorld(true);
  renderer.render(scene, camera);
  placeLabels(shown);
  showStep(shown);
}
frame_();
root.classList.add('ds-ready');
window.__ds = { set: (p) => { shown = p; } };
