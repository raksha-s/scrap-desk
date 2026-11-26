// Three.js stage: a persistent WebGL canvas behind the UI.
// - a soft paper/desk background shader (lit by the pointer, tinted per view)
// - the folder stack (your folder PNGs as textured planes, with soft shadows and tab labels)
// - every move is a smoothed pose (never a snap), so scrolling, opening and closing can interrupt each other.
// World units are CSS pixels (camera is set so z=0 maps 1:1 to the screen).

import * as THREE from 'three';
import { folderSkins } from '../engine/manifest';
import type { FolderSkin } from '../engine/types';

export interface StageFolder { id: string; name: string; skin: string; pages: number; peek: { src: string } | null }
export type StageView = 'home' | 'list' | 'folder' | 'page';

type Plane = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
interface Pose { topY: number; x: number; z: number; s: number; rot: number; a: number }
interface Geo { bx: number; by: number; bw: number; bh: number }
interface FolderItem {
  f: StageFolder; i: number; side: 1 | -1; skin: FolderSkin; group: THREE.Group;
  body: Plane; shadow: Plane; label: Plane; labelCanvas: HTMLCanvasElement; labelTex: THREE.CanvasTexture;
  aspectImg: number; cur: Pose; base: number; peekA: number; dispose(): void;
  img?: HTMLImageElement; hasContent?: boolean; shadowPad?: { x: number; y: number }; wanted?: string;
  papers?: Plane[] | null; flap?: Plane | null; peekMesh?: Plane | null;
  peek?: { rot: number; jx: number; tape: boolean };
}

THREE.ColorManagement.enabled = false; // pass colours straight through so the WebGL desk matches the CSS paper

const TINTS: Record<StageView, string> = { home: '#f6f1e7', list: '#f6f1e7', folder: '#efe6d6', page: '#d4d8d5' };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// the folder's front flap: everything below this line (in bbox-normalised coords) is drawn again on top of the contents
const FLAP: [number, number][] = [[0, 0.19], [0.008, 0.17], [0.02, 0.145], [0.035, 0.138], [0.33, 0.134], [0.345, 0.118], [0.353, 0.103], [0.365, 0.094], [0.377, 0.091], [0.965, 0.089], [0.985, 0.093], [1, 0.125], [1, 1], [0, 1]];

// Taller back panel: the strip between the folder's top edge and its front flap is stretched by `ext` px,
// everything above (tab) and below (flap, body) keeps its exact pixels. UVs map into the folder PNG's bounding box.
const BAND = [0.064, 0.080];
function sliceGeometry(fw: number, fh: number, ext: number, g: Geo) {
  const hs = [BAND[0] * fh, (BAND[1] - BAND[0]) * fh + ext, (1 - BAND[1]) * fh];
  const H = hs[0] + hs[1] + hs[2], vs = [0, BAND[0], BAND[1], 1];
  const ys = [H / 2, H / 2 - hs[0], H / 2 - hs[0] - hs[1], -H / 2];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { pos.push((c ? 0.5 : -0.5) * fw, ys[r], 0); uv.push(g.bx + (c ? g.bw : 0), 1 - (g.by + vs[r] * g.bh)); }
  for (let r = 0; r < 3; r++) { const a = r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  return geo;
}
const FULL = { bx: 0, by: 0, bw: 1, bh: 1 };
const FLAP_Y = 0.089;   // front-flap top edge on the plain side (fraction of folder height)

const BG_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BG_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec3 uTint; uniform vec2 uMouse; uniform vec2 uRes; uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 px = vUv * uRes;
  float g = n(px/3.0)*0.5 + n(px/9.0)*0.3 + n(px/41.0)*0.2;
  float fib = n(vec2(px.x/2.2, px.y/38.0)) * 0.5 + n(vec2(px.x/50.0, px.y/2.0)) * 0.5;
  vec3 col = uTint * (0.972 + g*0.034 + fib*0.012);
  float d = distance(vUv * vec2(uRes.x/uRes.y, 1.0), uMouse * vec2(uRes.x/uRes.y, 1.0));
  col += (1.0 - smoothstep(0.0, 0.85, d)) * 0.05;
  float soft = n(px/260.0 + uTime*0.02);
  col *= 0.985 + soft*0.02;
  float v = smoothstep(1.25, 0.3, length((vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0)));
  col *= mix(0.9, 1.0, v);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Stage {
  onFlip?: () => void;

  private canvas: HTMLCanvasElement;
  private reduced: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 10, 8000);
  private fov = 26;
  private bgUniforms: { uTint: { value: THREE.Color }; uMouse: { value: THREE.Vector2 }; uRes: { value: THREE.Vector2 }; uTime: { value: number } };
  private bg: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private items: FolderItem[] = [];
  private view: StageView = 'home';
  private sel = 0;
  private focus = 0;
  private focusT = 0;
  private flipIndex = 0;
  private hover = -1;
  private ptr = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6 };
  private tint = new THREE.Color(TINTS.home);
  private tintTarget?: THREE.Color;
  private last = performance.now();
  private time = 0;
  private raf = 0;
  private loader = new THREE.TextureLoader();
  private paper?: THREE.CanvasTexture;
  private dead = false;
  private W = 1; private H = 1; private small = false;
  private fw = 0; private fh = 0; private fhx = 0; private ext = 0; private step = 1;
  private topY = 0; private fvTop = 0; private fvScale = 1; private pvScale = 1;
  private onResize = () => this.resize();
  private onVisibility = () => { this.last = performance.now(); };

  /** Throws when the browser has no WebGL; use createStage. */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0xf6f1e7, 1);

    // background
    this.bgUniforms = { uTint: { value: new THREE.Color(TINTS.home) }, uMouse: { value: new THREE.Vector2(0.5, 0.6) }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } };
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: this.bgUniforms, depthTest: false, depthWrite: false }));
    this.bg.frustumCulled = false; this.bg.renderOrder = -100;
    this.scene.add(this.bg);

    this.resize();
    addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.tick);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Stops drawing and frees everything. The canvas can be handed to a new Stage afterwards. */
  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const it of this.items) { this.scene.remove(it.group); this.disposeItem(it); }
    this.items = [];
    this.paper?.dispose(); this.bg.geometry.dispose(); this.bg.material.dispose();
    this.renderer.dispose();
  }

  // ---------- build ----------
  setFolders(folders: StageFolder[]) {
    for (const it of this.items) { this.scene.remove(it.group); this.disposeItem(it); }
    this.items = folders.map((f, i) => this.makeFolder(f, i));
    this.items.forEach((it) => this.scene.add(it.group));
    this.focusT = clamp(this.focusT, 0, Math.max(0, folders.length - 1));
    this.layoutSizes();
    this.snap();
    this.flipIndex = this.focusIndex;
  }

  private disposeItem(it: FolderItem) { it.dispose(); it.body.geometry.dispose(); it.shadow.geometry.dispose(); it.label.geometry.dispose(); }

  private makeFolder(f: StageFolder, i: number): FolderItem {
    const stage = this;
    const skin = folderSkins[f.skin]; const g = skin.geo;
    const group = new THREE.Group();
    const side: 1 | -1 = i % 2 ? -1 : 1; // mirrored folders carry their tab on the right
    const tex = this.loader.load(skin.file, (t) => { t.generateMipmaps = true; if (stage.dead || it.skin !== skin) return; it.img = t.image; this.buildShadow(it, t); if (it.hasContent && !it.flap) { this.buildFlap(it); this.sizeItem(it); } });
    tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const body = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    body.scale.x = side;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0, color: 0x000000 }));
    shadow.scale.x = side;
    const labelCanvas = document.createElement('canvas'); labelCanvas.width = 1024; labelCanvas.height = 128;
    const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.NoColorSpace; labelTex.anisotropy = 4;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    group.add(shadow, body, label);
    const it: FolderItem = {
      f, i, side, skin, group, body, shadow, label, labelCanvas, labelTex, aspectImg: skin.w / skin.h,
      cur: { topY: 0, x: 0, z: 0, s: 1, rot: 0, a: 0 },
      base: (hash(i + 1.7) - 0.5) * 0.014, peekA: 0,
      dispose() { stage.clearContent(it); body.material.map?.dispose(); labelTex.dispose(); body.material.dispose(); shadow.material.map?.dispose(); shadow.material.dispose(); label.material.dispose(); },
    };
    this.drawLabel(it);
    this.buildContent(it);
    return it;
  }


  // ---- what's inside a folder that has pages: white sheets, the most recent photo, and the folder's own front flap on top ----
  setContent(i: number, { peek, pages }: Pick<StageFolder, 'peek' | 'pages'>) { const it = this.items[i]; if (!it) return; it.f.peek = peek; it.f.pages = pages; this.buildContent(it); }

  private buildContent(it: FolderItem) {
    this.clearContent(it);
    it.hasContent = (it.f.pages || 0) > 0 || !!it.f.peek?.src;
    if (!it.hasContent) return;
    this.buildPapers(it);
    this.buildPeek(it, it.f.peek);
    if (it.img) this.buildFlap(it);
    this.sizeItem(it);
  }

  private clearContent(it: FolderItem) {
    if (it.papers) { it.papers.forEach((m) => { it.group.remove(m); m.material.dispose(); m.geometry.dispose(); }); it.papers = null; }
    if (it.flap) { it.group.remove(it.flap); it.flap.material.map?.dispose(); it.flap.material.dispose(); it.flap.geometry.dispose(); it.flap = null; }
    this.buildPeek(it, null);
  }

  private paperTexture() {
    if (this.paper) return this.paper;
    const c = document.createElement('canvas'); c.width = 520; c.height = 220; const x = c.getContext('2d')!;
    x.save(); x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 10; x.shadowOffsetY = 3; x.fillStyle = '#fdfbf6'; x.fillRect(16, 16, 488, 260); x.restore();
    const g = x.createLinearGradient(0, 16, 0, 110); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,100,70,.08)'); x.fillStyle = g; x.fillRect(16, 16, 488, 260);
    x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(16, 16, 488, 2.5);
    x.strokeStyle = 'rgba(90,70,40,.05)'; x.lineWidth = 1;
    for (let k = 0; k < 30; k++) { const yy = 26 + k * 5.2; x.beginPath(); x.moveTo(16 + hash(k) * 50, yy); x.lineTo(504 - hash(k + 9) * 70, yy + (hash(k + 3) - 0.5) * 2); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
    return (this.paper = t);
  }

  private buildPapers(it: FolderItem) {
    const n = Math.min(3, it.f.pages || 0); if (!n) return;
    const tex = this.paperTexture(); it.papers = [];
    for (let k = n - 1; k >= 0; k--) {           // back sheet first
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 }));
      m.userData = { k, lift: 13 + k * 8, dx: (hash(it.i * 5 + k) - 0.5) * 20, rot: (hash(it.i * 9 + k + 1) - 0.5) * 0.026 };
      it.group.add(m); it.papers.push(m);
    }
  }

  private buildFlap(it: FolderItem) {
    const g = it.skin.geo, img = it.img; if (!img) return;
    const sx = img.width * g.bx, sy = img.height * g.by, sw = img.width * g.bw, sh = img.height * g.bh;
    const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh);
    const x = c.getContext('2d')!; x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.beginPath();
    FLAP.forEach(([px, py], n) => (n ? x.lineTo(px * c.width, py * c.height) : x.moveTo(px * c.width, py * c.height)));
    x.closePath(); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 }));
    m.scale.x = it.side; it.group.add(m); it.flap = m;
  }

  private buildPeek(it: FolderItem, peek: StageFolder['peek']) {
    if (it.peekMesh) { it.group.remove(it.peekMesh); it.peekMesh.material.map?.dispose(); it.peekMesh.material.dispose(); it.peekMesh.geometry.dispose(); it.peekMesh = null; }
    if (!peek?.src) return;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 }));
    mesh.visible = false; it.group.add(mesh); it.peekMesh = mesh;
    it.peek = { rot: (hash(it.i * 3.1 + 0.5) - 0.5) * 0.2, jx: hash(it.i * 7.7 + 2), tape: it.i % 2 === 0 };
    const img = new Image(); img.decoding = 'async';
    img.onload = () => {
      if (this.dead || it.peekMesh !== mesh) return; // replaced meanwhile
      const CW = 400, CH = 470, PX = 40, PY = 52;
      const c = document.createElement('canvas'); c.width = CW + PX * 2; c.height = CH + PY + 40;
      const x = c.getContext('2d')!;
      x.save(); x.shadowColor = 'rgba(0,0,0,.38)'; x.shadowBlur = 26; x.shadowOffsetY = 10; x.fillStyle = '#fbfaf5'; x.fillRect(PX, PY, CW, CH); x.restore();
      const rx = PX + 22, ry = PY + 22, rw = CW - 44, rh = 342;
      const sc = Math.max(rw / img.naturalWidth, rh / img.naturalHeight), sw = rw / sc, sh = rh / sc;
      x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
      x.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * 0.28, sw, sh, rx, ry, rw, rh); // bias toward the top, where faces are
      x.fillStyle = 'rgba(255,232,190,.10)'; x.fillRect(rx, ry, rw, rh); x.restore();
      x.strokeStyle = 'rgba(0,0,0,.14)'; x.lineWidth = 2; x.strokeRect(rx, ry, rw, rh);
      if (it.peek!.tape) { // a scrap of kraft tape, like the reference
        x.save(); x.translate(PX + CW * 0.36, PY + 4); x.rotate(-0.14); x.fillStyle = 'rgba(206,164,108,.92)';
        x.beginPath(); x.moveTo(-60, -17); for (let k = 0; k <= 4; k++) x.lineTo(-60 + (k % 2 ? 5 : 0), -17 + k * 8.5); x.lineTo(-60, 17); x.lineTo(60, 17);
        for (let k = 4; k >= 0; k--) x.lineTo(60 - (k % 2 ? 5 : 0), -17 + k * 8.5); x.lineTo(60, -17); x.closePath(); x.fill(); x.restore();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
      mesh.material.map = t; mesh.material.needsUpdate = true; mesh.userData.aspect = c.width / c.height; mesh.userData.cw = c.width; mesh.userData.ch = c.height; mesh.userData.cardH = CH;
      mesh.visible = true;
    };
    img.src = peek.src;
  }

  private buildShadow(it: FolderItem, tex: THREE.Texture) {
    // soft silhouette of the folder (tiny canvas, GPU-upscaled = blur)
    const img = tex.image as HTMLImageElement; const g = it.skin.geo;
    const sw = img.width * g.bw, sh = img.height * g.bh, sx = img.width * g.bx, sy = img.height * g.by;
    const W = 120, H = Math.round(W * sh / sw), P = 16;
    const c = document.createElement('canvas'); c.width = W + P * 2; c.height = H + P * 2;
    const x = c.getContext('2d')!;
    x.drawImage(img, sx, sy, sw, sh, P, P, W, H);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    it.shadow.material.map?.dispose();
    it.shadow.material.map = t; it.shadow.material.opacity = 0.34; it.shadow.material.needsUpdate = true;
    it.shadowPad = { x: (W + P * 2) / W, y: (H + P * 2) / H };
    this.sizeItem(it);
  }

  private drawLabel(it: FolderItem) {
    const c = it.labelCanvas, x = c.getContext('2d')!;
    x.clearRect(0, 0, c.width, c.height);
    const dark = it.skin.dark; x.fillStyle = dark ? '#f6ecdb' : '#2a2118'; x.textBaseline = 'middle'; x.textAlign = 'center';
    const text = (it.f.name || 'Unnamed Folder').toUpperCase();
    let size = 72;
    const spacing = 0.12;
    const width = (s: number, t: string) => { x.font = `600 ${s}px "IBM Plex Mono", ui-monospace, monospace`; return x.measureText(t).width + t.length * s * spacing; };
    while (size > 34 && width(size, text) > c.width - 40) size -= 2;
    let t = text; while (width(size, t) > c.width - 40 && t.length > 3) t = t.slice(0, -2);
    if (t !== text) t = t.trim() + '…';
    x.font = `600 ${size}px "IBM Plex Mono", ui-monospace, monospace`;
    // manual letter-spacing (works everywhere)
    const total = width(size, t) - t.length * size * spacing + (t.length - 1) * size * spacing;
    let px = c.width / 2 - total / 2; x.textAlign = 'left';
    for (const ch of t) { x.fillText(ch, px, c.height / 2 + 3); px += x.measureText(ch).width + size * spacing; }
    it.labelTex.needsUpdate = true;
  }
  refreshLabels() { this.items.forEach((it) => this.drawLabel(it)); }

  // ---------- editing one folder ----------
  rename(i: number, name: string) { const it = this.items[i]; if (!it) return; it.f.name = name; this.drawLabel(it); }

  // swap the folder's picture once the new one has loaded, so it never blinks
  recolor(i: number, skinId: string) {
    const it = this.items[i]; if (!it) return; const skin = folderSkins[skinId]; it.wanted = skinId;
    this.loader.load(skin.file, (t) => {
      if (this.dead || this.items[i] !== it || it.wanted !== skinId) { t.dispose(); return; }    // a later pick won
      t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
      it.body.material.map?.dispose(); it.body.material.map = t;
      it.f.skin = skinId; it.skin = skin; it.img = t.image as HTMLImageElement;
      this.buildShadow(it, t); this.buildContent(it); this.drawLabel(it); this.sizeItem(it);
    });
  }

  // ---------- sizing ----------
  resize() {
    const W = this.canvas.clientWidth || innerWidth, H = this.canvas.clientHeight || innerHeight;
    this.W = W; this.H = H;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.position.z = (H / 2) / Math.tan((this.fov * Math.PI) / 360);
    this.camera.updateProjectionMatrix();
    this.bgUniforms.uRes.value.set(W, H);
    this.layoutSizes();
  }

  layoutSizes() {
    const { W, H } = this; const small = W < 720;
    const geo = this.items[0]?.skin.geo || { bw: .76, bh: .659 };
    const sk = this.items[0]?.skin || { w: 1100, h: 993 };
    this.small = small;
    this.fw = small ? W * 0.92 : Math.min(860, W * 0.64);
    this.fh = this.fw / ((geo.bw * sk.w) / (geo.bh * sk.h));
    this.ext = Math.round(this.fh * 0.075);          // extra back-panel height
    this.fhx = this.fh + this.ext;                   // drawn folder height
    this.step = clamp(this.fh * 0.22, small ? 52 : 70, 150);
    this.topY = clamp(H * (small ? 0.27 : 0.285), 150, 290);
    this.fvTop = small ? 124 : 158;
    this.fvScale = Math.min(1.28, (W * 0.97) / this.fw);
    this.pvScale = Math.min(1.3, Math.max(0.9, (W * 0.9) / this.fw));
    this.items.forEach((it) => this.sizeItem(it));
  }

  private sizeItem(it: FolderItem) {
    const { fw, fh, fhx, ext } = this; const g = it.skin.geo;
    it.body.geometry.dispose(); it.body.geometry = sliceGeometry(fw, fh, ext, g);
    if (it.flap) { it.flap.geometry.dispose(); it.flap.geometry = sliceGeometry(fw, fh, ext, FULL); }
    const pad = it.shadowPad || { x: 1.2, y: 1.3 };
    it.shadow.geometry.dispose(); it.shadow.geometry = new THREE.PlaneGeometry(fw * pad.x, fhx * pad.y);
    const tabW = (g.tabR - g.tabL) * fw, tabH = g.tabH * fh;
    it.label.geometry.dispose(); it.label.geometry = new THREE.PlaneGeometry(tabW * 0.92, tabW * 0.92 / 8);
    const cx = ((g.tabL + g.tabR) / 2 - 0.5) * fw * it.side;
    it.label.position.set(cx, fhx / 2 - tabH * 0.52, 1);
  }

  // ---------- state ----------
  setView(v: StageView, sel = this.sel) { this.view = v; this.sel = sel; this.tintTarget = new THREE.Color(TINTS[v] || TINTS.home); }
  focusTo(i: number) { this.focusT = clamp(Math.round(i), 0, Math.max(0, this.items.length - 1)); }
  focusBy(d: number) { this.focusTo(Math.round(this.focusT) + d); }
  scrollPx(dy: number) { if (this.items.length) this.focusT = clamp(this.focusT + dy / this.step, -0.25, this.items.length - 0.75); }
  settle() { this.focusT = clamp(Math.round(this.focusT), 0, Math.max(0, this.items.length - 1)); }
  get focusIndex() { return clamp(Math.round(this.focusT), 0, Math.max(0, this.items.length - 1)); }
  setPointer(x: number, y: number) { this.ptr.tx = x / this.W; this.ptr.ty = y / this.H; }
  snap() { this.items.forEach((it) => Object.assign(it.cur, this.target(it))); this.focus = this.focusT; }

  private target(it: FolderItem): Pose {
    const { H, W } = this; const i = it.i; const d = i - this.focus;
    let topY: number, s = 1, x = 0, z = 0, rot = it.base, a = 1;
    if (this.view === 'home' || this.view === 'list') {
      topY = d >= 0 ? this.topY + d * this.step : this.topY + d * this.step * 1.8 - 14;
      a = d < -0.85 ? 0 : d < 0 ? 1 + d * 1.15 : 1;
      const near = Math.max(0, 1 - Math.abs(d));
      let lift = near * 14 + (this.hover === i && this.view === 'home' ? 9 : 0);
      topY -= lift; z = near * 46; s = 1 + near * 0.018;
      if (this.view === 'list') { a = 0; topY += 90; }
    } else if (this.view === 'folder') {
      if (i === this.sel) { topY = this.fvTop; s = this.fvScale; z = 80; rot = 0; }
      else { topY = H * 1.05 + d * 30; a = 0; rot = it.base * 4; }
    } else { // page
      if (i === this.sel) { topY = H * (this.small ? 0.5 : 0.34); s = this.pvScale; x = this.small ? W * 0.12 : W * 0.17; z = -60; rot = -0.07; }
      else { topY = H * 1.1; a = 0; }
    }
    return { topY, x, z, s, rot, a };
  }

  // ---------- picking ----------
  hitTest(cx: number, cy: number): number {
    if (this.view !== 'home') return -1;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; const c = it.cur; if (c.a < 0.45) continue;
      const w = this.fw * c.s, h = this.fhx * c.s; const left = this.W / 2 + c.x - w / 2, top = c.topY;
      if (cx < left || cx > left + w || cy < top || cy > top + h) continue;
      const g = it.skin.geo; const fx = (cx - left) / w; const fxe = it.side === 1 ? fx : 1 - fx;
      const inNotch = (cy - top) < g.tabH * this.fh * c.s && (fxe < g.tabL || fxe > g.tabR);
      if (inNotch) continue;
      return i;
    }
    return -1;
  }
  setHover(i: number) { this.hover = i; }

  // ---------- frame ----------
  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    const k = (r: number) => (this.reduced ? 1 : 1 - Math.exp(-dt * r));

    if (this.focusIndex !== this.flipIndex) { this.flipIndex = this.focusIndex; this.onFlip?.(); }   // a different folder is now in front
    this.focus += (this.focusT - this.focus) * k(9);
    this.ptr.x += (this.ptr.tx - this.ptr.x) * k(6); this.ptr.y += (this.ptr.ty - this.ptr.y) * k(6);
    const kk = k(10);
    this.tint.lerp(this.tintTarget || this.tint, k(4));
    this.bgUniforms.uTint.value.copy(this.tint);
    this.bgUniforms.uMouse.value.set(this.ptr.x, 1 - this.ptr.y);
    this.bgUniforms.uTime.value = this.time;
    this.renderer.setClearColor(this.tint, 1);

    const { W, H } = this; const mx = this.ptr.x - 0.5, my = this.ptr.y - 0.5;
    for (const it of this.items) {
      const t = this.target(it), c = it.cur;
      c.topY += (t.topY - c.topY) * kk; c.x += (t.x - c.x) * kk; c.z += (t.z - c.z) * kk;
      c.s += (t.s - c.s) * kk; c.rot += (t.rot - c.rot) * kk; c.a += (t.a - c.a) * k(8);
      const g = it.group;
      g.visible = c.a > 0.01;
      if (!g.visible) continue;
      const near = Math.max(0, 1 - Math.abs(it.i - this.focus));
      const cy = H / 2 - (c.topY + (this.fhx * c.s) / 2);
      g.position.set(c.x + mx * -10 * (0.4 + near), cy + my * 6 * (0.4 + near), c.z);
      g.scale.setScalar(c.s);
      g.rotation.set(-my * 0.05 * (0.3 + near), mx * 0.07 * (0.3 + near), c.rot);
      const op = clamp(c.a, 0, 1);
      it.peekA += ((this.view === 'home' ? 1 : 0) - it.peekA) * k(8);
      const tabPx = it.skin.geo.tabH * this.fh;                         // the tab sits above the folder's real top edge
      const edgeY = this.fhx / 2 - tabPx;                                // folder's back-panel top edge, in folder space
      const pa = op * clamp(it.peekA, 0, 1);
      const base = it.i * 6;
      if (it.papers) {                                                  // white sheets, full length, standing inside the pocket
        const sheetW = this.fw * 0.93, sc2 = sheetW / 488, mw = 520 * sc2, mh = 220 * sc2;
        const flapPlain = this.fhx / 2 - (FLAP_Y * this.fh + this.ext);  // flap's top edge on the plain side (folder space)
        it.papers.forEach((m, j) => {
          const u = m.userData, top = flapPlain + 30 + u.k * 7;           // back sheets stand a little taller
          m.scale.set(mw, mh, 1); m.position.set(u.dx, top - (mh / 2 - 16 * sc2), -0.6); m.rotation.z = u.rot;
          m.material.opacity = pa; m.renderOrder = base + 2 + j * 0.01;
        });
      }
      const pm = it.peekMesh;
      if (pm && pm.visible && pm.userData.cw) {                         // the most recent photo, rising out of the pocket
        const sc = clamp(this.fw * 0.25, 104, 230) / 400;
        const cardH = pm.userData.cardH * sc;
        const protrude = clamp(c.topY + tabPx * c.s - 186, 30, Math.min(cardH * 0.58, this.step * 0.9));
        pm.scale.set(pm.userData.cw * sc, pm.userData.ch * sc, 1);
        const frac = it.side === 1 ? 0.60 + it.peek!.jx * 0.14 : 0.40 - it.peek!.jx * 0.14;   // side away from its own tab
        pm.position.set((frac - 0.5) * this.fw, edgeY + protrude - cardH / 2 - 10 * sc, -0.5);
        pm.rotation.z = it.peek!.rot;
        pm.material.opacity = pa; pm.renderOrder = base + 3;
      }
      if (it.flap) { it.flap.material.opacity = op; it.flap.renderOrder = base + 4; it.flap.position.z = 0.8; }   // front flap hides the bottoms
      it.body.material.opacity = op; it.label.material.opacity = op * (this.view === 'page' ? 0 : 1);
      it.shadow.material.opacity = (it.shadowPad ? 0.34 : 0) * op * (0.5 + near * 0.5);
      it.shadow.position.set(0, -this.fh * 0.012 - 10 - near * 6, -1);
      it.body.renderOrder = base + 1; it.shadow.renderOrder = base; it.label.renderOrder = base + 5;
    }
    this.renderer.render(this.scene, this.camera);
  };
}
