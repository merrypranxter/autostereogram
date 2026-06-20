// main.js — autostereogram engine
// the depth is the input. the pattern is the input. the input is the art.
//
// Pipeline (WebGL2):
//   1. depth pass     : depth/<engine>.glsl + depth.frag  -> depth FBO (z in .r)
//   2. stereogram pass: stereogram.frag (per-pixel pattern-shift) -> scene FBO
//   3. post pass      : post-process.frag (convergence dots) -> screen
// Export uses sirds-cpu.js on the read-back depth for the true row-linking solve.

import { buildPattern } from "./pattern-sources.js";
import { generateSIRDS } from "./sirds-cpu.js";

const DEPTH_ENGINES = ["sdf-shape", "raymarch-depth", "noise-terrain"];

const state = {
  engine: "sdf-shape",
  shapeId: 0,
  pattern: "random_dots",
  aesthetic: "classic",
  E: 128,
  mu: 0.4,
  animate: false,
  guides: true,
  seed: 1,
};

const AESTHETIC_DEFAULTS = {
  classic: { pattern: "random_dots", palette: "classic" },
  lisa_frank: { pattern: "tiled_image", palette: "lisa_frank" },
  neon_noise: { pattern: "animated_noise", palette: "neon_noise" },
};

const canvas = document.getElementById("gl");
const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
if (!gl) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:monospace;padding:2rem">WebGL2 not available. the eye needs the GPU. try a current browser.</p>';
  throw new Error("WebGL2 required");
}

// ---- shared shader header ---------------------------------------------------
const HEADER = `#version 300 es
precision highp float;
uniform vec2  uResolution;
uniform float uTime;
uniform float uShapeId;
uniform float uAnimate;
uniform float uE;
uniform float uMu;
`;

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ---- gl helpers -------------------------------------------------------------
function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("shader compile:\n" + gl.getShaderInfoLog(sh) + "\n---\n" + src);
  }
  return sh;
}

function program(fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("link: " + gl.getProgramInfoLog(p));
  }
  return p;
}

function makeFBO(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}

function setCommonUniforms(p) {
  gl.uniform2f(gl.getUniformLocation(p, "uResolution"), canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(p, "uTime"), (performance.now() - t0) / 1000);
  gl.uniform1f(gl.getUniformLocation(p, "uShapeId"), state.shapeId);
  gl.uniform1f(gl.getUniformLocation(p, "uAnimate"), state.animate ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(p, "uE"), state.E);
  gl.uniform1f(gl.getUniformLocation(p, "uMu"), state.mu);
}

// fullscreen triangle
const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

// ---- asset loading ----------------------------------------------------------
async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path} (${res.status})`);
  return res.text();
}

let depthPrograms = {}; // engine -> program
let stereoProgram, postProgram;
let depthFbo, sceneFbo;
let patternTex;
let t0 = performance.now();

async function init() {
  const [depthFrag, stereoFrag, postFrag] = await Promise.all([
    fetchText("./src/shaders/depth.frag"),
    fetchText("./src/shaders/stereogram.frag"),
    fetchText("./src/shaders/post-process.frag"),
  ]);

  // one depth program per engine (engine source prepended)
  for (const eng of DEPTH_ENGINES) {
    const engSrc = await fetchText(`./src/shaders/depth/${eng}.glsl`);
    depthPrograms[eng] = program(HEADER + engSrc + "\n" + depthFrag);
  }
  stereoProgram = program(HEADER + stereoFrag);
  postProgram = program(HEADER + postFrag);

  resize();
  window.addEventListener("resize", resize);
  buildUI();
  refreshPattern();
  requestAnimationFrame(frame);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width === w && canvas.height === h && depthFbo) return;
  canvas.width = w;
  canvas.height = h;
  depthFbo = makeFBO(w, h);
  sceneFbo = makeFBO(w, h);
}

// ---- pattern texture --------------------------------------------------------
function uploadPattern(srcCanvas) {
  if (!patternTex) patternTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, patternTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  patternAspect = srcCanvas.height / srcCanvas.width;
  lastPatternCanvas = srcCanvas;
}

let patternAspect = 1.0;
let lastPatternCanvas = null;

function refreshPattern(frameIdx = 0) {
  const palette = AESTHETIC_DEFAULTS[state.aesthetic].palette;
  const tileH = Math.round(state.E * 1.0);
  const c = buildPattern(state.pattern, state.E, tileH, {
    palette,
    seed: state.seed,
    frame: frameIdx,
  });
  uploadPattern(c);
}

// ---- render passes ----------------------------------------------------------
function drawFullscreen() {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function renderDepth() {
  const p = depthPrograms[state.engine];
  gl.useProgram(p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFbo.fbo);
  gl.viewport(0, 0, canvas.width, canvas.height);
  setCommonUniforms(p);
  drawFullscreen();
}

function renderStereogram() {
  gl.useProgram(stereoProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo.fbo);
  gl.viewport(0, 0, canvas.width, canvas.height);
  setCommonUniforms(stereoProgram);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, depthFbo.tex);
  gl.uniform1i(gl.getUniformLocation(stereoProgram, "uDepthTex"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, patternTex);
  gl.uniform1i(gl.getUniformLocation(stereoProgram, "uPatternTex"), 1);
  gl.uniform1f(gl.getUniformLocation(stereoProgram, "uPatternAspect"), patternAspect);

  drawFullscreen();
}

function renderPost() {
  gl.useProgram(postProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  setCommonUniforms(postProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneFbo.tex);
  gl.uniform1i(gl.getUniformLocation(postProgram, "uSceneTex"), 0);
  gl.uniform1f(gl.getUniformLocation(postProgram, "uShowGuides"), state.guides ? 1 : 0);
  drawFullscreen();
}

let frameIdx = 0;
function frame() {
  if (state.animate && state.pattern === "animated_noise" && frameIdx % 4 === 0) {
    refreshPattern(frameIdx);
  }
  renderDepth();
  renderStereogram();
  renderPost();
  frameIdx++;
  requestAnimationFrame(frame);
}

// ---- CPU export (true SIRDS) ------------------------------------------------
function exportTrueSIRDS() {
  renderDepth(); // ensure depth FBO is current
  const w = canvas.width;
  const h = canvas.height;
  const pixels = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFbo.fbo);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // FBO is bottom-up; flip into a top-down depth array
  const depth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = ((h - 1 - y) * w + x) * 4;
      depth[y * w + x] = pixels[src] / 255;
    }
  }

  const img = generateSIRDS(depth, {
    width: w,
    height: h,
    E: state.E,
    mu: state.mu,
    pattern: lastPatternCanvas,
    seed: state.seed,
  });

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").putImageData(img, 0, 0);
  out.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `autostereogram-${state.engine}-${state.pattern}-E${state.E}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ---- UI ---------------------------------------------------------------------
function buildUI() {
  bindSelect("engine", (v) => (state.engine = v));
  bindSelect("shape", (v) => (state.shapeId = Number(v)));
  bindSelect("aesthetic", (v) => {
    state.aesthetic = v;
    state.pattern = AESTHETIC_DEFAULTS[v].pattern;
    syncPatternSelect();
    refreshPattern();
  });
  bindSelect("pattern", (v) => {
    state.pattern = v;
    refreshPattern();
  });
  bindRange("E", (v) => {
    state.E = Number(v);
    refreshPattern();
    label("E", `${state.E}px`);
  });
  bindRange("mu", (v) => {
    state.mu = Number(v);
    label("mu", state.mu.toFixed(2));
  });
  bindCheckbox("animate", (v) => (state.animate = v));
  bindCheckbox("guides", (v) => (state.guides = v));
  const ex = document.getElementById("export");
  if (ex) ex.addEventListener("click", exportTrueSIRDS);
  const rs = document.getElementById("reseed");
  if (rs)
    rs.addEventListener("click", () => {
      state.seed = (Math.random() * 1e9) | 0;
      refreshPattern();
    });
}

function syncPatternSelect() {
  const sel = document.getElementById("pattern");
  if (sel) sel.value = state.pattern;
}
function bindSelect(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", (e) => fn(e.target.value));
}
function bindRange(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", (e) => fn(e.target.value));
}
function bindCheckbox(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", (e) => fn(e.target.checked));
}
function label(id, text) {
  const el = document.getElementById(id + "-val");
  if (el) el.textContent = text;
}

init().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:#ff006e;font-family:monospace;padding:1rem;white-space:pre-wrap">${err.message}</pre>`
  );
});
