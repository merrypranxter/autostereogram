// sirds-cpu.js
// the CPU is the true. the true is the slow. the slow is the accurate. the accurate is the magic.
//
// True single-image random-dot stereogram via the Thimbleby / Inglis / Witten
// row-sequential algorithm (Computers & Graphics, 1994). For each row, scan
// left to right maintaining a "same[]" linked-constraint array: pixels that
// must share a color are linked. Conflicts break the link (hidden-surface
// removal). Then a second left-to-right pass paints, copying linked pixels and
// seeding the rest from the wallpaper. This is the export-quality path the GPU
// approximation only mimics.
//
// generateSIRDS(depth, opts) -> ImageData
//   depth: Float32Array length w*h, z in [0,1] (1 = nearest)
//   opts.width, opts.height
//   opts.E         : pattern period px (eye separation), default 128
//   opts.mu        : depth scale, default 0.4
//   opts.pattern   : optional HTMLCanvasElement/ImageData wallpaper tile.
//                    if omitted, monochrome random dots are used.

function separation(z, E, mu) {
  // sep = E * (1 - mu*z) / (2 - mu*z)
  return Math.round((E * (1 - mu * z)) / (2 - mu * z));
}

function readPatternRGBA(pattern) {
  if (!pattern) return null;
  let imgData;
  if (pattern instanceof ImageData) {
    imgData = pattern;
  } else {
    const ctx = pattern.getContext("2d");
    imgData = ctx.getImageData(0, 0, pattern.width, pattern.height);
  }
  return imgData;
}

export function generateSIRDS(depth, opts = {}) {
  const width = opts.width;
  const height = opts.height;
  const E = opts.E || 128;
  const mu = opts.mu ?? 0.4;
  const patternData = readPatternRGBA(opts.pattern);

  const out = new Uint8ClampedArray(width * height * 4);

  // per-pixel constraint + color buffers, reused per row
  const same = new Int32Array(width);
  const rng = mulberry32((opts.seed || 1) >>> 0);

  for (let y = 0; y < height; y++) {
    // pass 1: build the linking constraints
    for (let x = 0; x < width; x++) same[x] = x; // each pixel initially its own

    for (let x = 0; x < width; x++) {
      const z = depth[y * width + x];
      const sep = separation(z, E, mu);
      const left = x - Math.floor(sep / 2);
      const right = left + sep;
      if (left >= 0 && right < width) {
        // visibility test: is the link occluded by something nearer?
        let visible = true;
        const t = 1; // step
        for (let xt = 1; xt < sep; xt++) {
          const zt = depth[y * width + (x - Math.floor(sep / 2) + xt)] || 0;
          const zCmp = z;
          // a nearer surface between the two eyes hides this link
          const sepT = separation(zt, E, mu);
          if (sepT < sep && Math.abs(xt - sep / 2) < (sep - sepT) / 2) {
            visible = false;
            break;
          }
        }
        if (visible) {
          // link left & right to the same color, resolving existing chains
          let l = left;
          while (same[l] !== l) l = same[l];
          let r = right;
          while (same[r] !== r) r = same[r];
          if (l !== r) {
            // link the higher index to the lower (left-anchored chains)
            if (l < r) same[r] = l;
            else same[l] = r;
          }
        }
      }
    }

    // pass 2: paint left to right, copying linked colors
    for (let x = 0; x < width; x++) {
      let rgba;
      if (same[x] !== x) {
        // copy the color of the pixel this one is linked to
        const src = same[x];
        const o = (y * width + src) * 4;
        rgba = [out[o], out[o + 1], out[o + 2]];
      } else {
        rgba = seedColor(patternData, x, y, E, rng);
      }
      const o = (y * width + x) * 4;
      out[o] = rgba[0];
      out[o + 1] = rgba[1];
      out[o + 2] = rgba[2];
      out[o + 3] = 255;
    }
  }

  return new ImageData(out, width, height);
}

function seedColor(patternData, x, y, E, rng) {
  if (patternData) {
    const pw = patternData.width;
    const ph = patternData.height;
    const px = ((x % E) % pw + pw) % pw;
    const py = ((y % ph) + ph) % ph;
    const o = (py * pw + px) * 4;
    return [patternData.data[o], patternData.data[o + 1], patternData.data[o + 2]];
  }
  // monochrome random dots fallback
  const v = rng() < 0.5 ? 0 : 255;
  return [v, v, v];
}

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
