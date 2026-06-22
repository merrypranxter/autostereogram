// pattern-sources.js
// the pattern is the wallpaper. the wallpaper is the depth. the depth is the magic.
//
// Produces a single horizontally‑tileable wallpaper tile of width `E` pixels.
// The tile is sampled with REPEAT wrap in stereogram.frag (GPU) and read
// directly by sirds‑cpu.js (export). Four sources:
//
//   random_dots    — monochrome classic SIRDS noise
//   tiled_image    — vivid SIS texture (lisa_frank aesthetic by default)
//   animated_noise — living neon noise, reseeded per frame when animating
//   stripes        — bold vertical stripes cycling through the chosen palette
//
// Each builder returns an HTMLCanvasElement of size (E x tileHeight).

const PALETTES = {
  classic: ["#000000", "#ffffff"],
  lisa_frank: ["#ff00cc", "#00ffcc", "#ffff00", "#ff6600"],
  neon_noise: ["#0a001a", "#8338ec", "#ff006e", "#ffbe0b"],
};

// Reuse one canvas across pattern builds. During animation the wallpaper is
// regenerated every few frames; allocating a fresh canvas each time churns the
// GC and causes stutter. Only one pattern is ever live at a time, so sharing is
// safe (assigning width/height also clears it).
let sharedCanvas = null;
function makeCanvas(w, h) {
  if (!sharedCanvas) sharedCanvas = document.createElement("canvas");
  if (sharedCanvas.width !== w || sharedCanvas.height !== h) {
    sharedCanvas.width = w;
    sharedCanvas.height = h;
  }
  return sharedCanvas;
}

function pickWeighted(colors, rng) {
  return colors[Math.floor(rng() * colors.length)];
}

// small seedable PRNG (mulberry32) so dot fields are reproducible per seed
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// random_dots: per‑pixel 2‑color noise. the dots are the noise.
export function randomDots(E, tileHeight, { palette = "classic", seed = 1, density = 0.5 } = {}) {
  const colors = PALETTES[palette] || PALETTES.classic;
  const canvas = makeCanvas(E, tileHeight);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(E, tileHeight);
  const rng = mulberry32(seed);
  for (let i = 0; i < E * tileHeight; i++) {
    const hex = rng() < density ? colors[colors.length - 1] : colors[0];
    const [r, g, b] = hexToRgb(hex);
    const o = i * 4;
    img.data[o] = r;
    img.data[o + 1] = g;
    img.data[o + 2] = b;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// tiled_image: vivid generated SIS texture. lisa frank by default.
// the frank is the rainbow. the rainbow is the leopard. the leopard is the dolphin.
export function tiledImage(E, tileHeight, { palette = "lisa_frank", seed = 7 } = {}) {
  const colors = PALETTES[palette] || PALETTES.lisa_frank;
  const canvas = makeCanvas(E, tileHeight);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);

  // base gradient wash
  const g = ctx.createLinearGradient(0, 0, E, tileHeight);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, E, tileHeight);

  // confetti splats — wrap across the tile edge so it stays seamless
  const blobs = Math.floor((E * tileHeight) / 90);
  for (let i = 0; i < blobs; i++) {
    const x = rng() * E;
    const y = rng() * tileHeight;
    const rad = 2 + rng() * (E * 0.12);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    for (const dx of [-E, 0, E]) {
      ctx.beginPath();
      ctx.arc(x + dx, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

// animated_noise: neon noise reseeded per frame → the living wallpaper.
export function animatedNoise(E, tileHeight, { palette = "neon_noise", seed = 1, frame = 0 } = {}) {
  return randomDots(E, tileHeight, {
    palette,
    seed: (seed + frame * 2654435761) >>> 0,
    density: 0.6,
  });
}

// stripes: bold vertical stripes cycling through the chosen palette.
// Each stripe spans a configurable width (default 8px) and wraps across the tile edge.
export function stripes(E, tileHeight, { palette = "classic", seed = 1, stripeWidth = 8 } = {}) {
  const colors = PALETTES[palette] || PALETTES.classic;
  const canvas = makeCanvas(E, tileHeight);
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(seed);
  // determine number of stripes across the tile; ensures full coverage
  for (let x = 0; x < E; x += stripeWidth) {
    const color = colors[Math.floor(rng() * colors.length)];
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, Math.min(stripeWidth, E - x), tileHeight);
  }
  return canvas;
}

export function buildPattern(source, E, tileHeight, opts = {}) {
  switch (source) {
    case "tiled_image":
      return tiledImage(E, tileHeight, opts);
    case "animated_noise":
      return animatedNoise(E, tileHeight, opts);
    case "stripes":
      return stripes(E, tileHeight, opts);
    case "random_dots":
    default:
      return randomDots(E, tileHeight, opts);
  }
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export { PALETTES };
