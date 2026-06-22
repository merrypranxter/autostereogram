# Autostereogram Examples and Guide

This project turns **simple depth functions** into eye‑popping `Magic Eye` art.  A stereogram is just a single image where horizontal offsets encode depth.  By hiding your depth cues and letting your visual cortex do the work, the hidden shape pops into 3D.

Below are curated examples to help you explore the new features introduced by this enhancement—namely the **wave depth engine** and the **stripes pattern source**—and to give you more control over the existing engines and patterns.

## Getting started

1. Clone and serve the repo.  Any static HTTP server will work:

   ```bash
   git clone https://github.com/merrypranxter/autostereogram.git
   cd autostereogram
   npx http-server -c-1
   ```

2. Open the site in a modern browser (WebGL 2 required).  The left panel contains controls for **depth engine**, **pattern**, **aesthetic**, and various numeric parameters.  The right side shows the generated stereogram.

### Key controls

- **Depth engine:** chooses the GLSL shader that encodes depth.  The original engines `sdf‑shape`, `raymarch‑depth` and `noise‑terrain` remain.  A new `wave‑depth` option produces smooth sinusoidal ripples.
- **Pattern source:** selects the wallpaper that gets shifted to encode depth.  New `stripes` pattern sits alongside `random dots`, `tiled image` and `animated noise`.
- **Aesthetic:** presets the pattern and color palette.  Changing the aesthetic will auto‑set the pattern and palette; you can then tweak the pattern manually.
- **Pattern period (E):** controls the separation between repeating wallpaper tiles.  Larger values make hidden shapes easier to resolve but reduce resolution of the depth field.
- **Depth scale (μ):** scales the perceived depth.  Smaller values compress the depth; larger values exaggerate it but can make the stereogram harder to fuse.
- **Animate:** toggles breathing animation.  When enabled and using `animated noise`, the pattern reseeds every few frames.
- **Guides:** show or hide the two dots at the top that help you converge your eyes.  Align the two dots into three (wall‑eyed) or cross the left over the right (cross‑eyed) to see the hidden depth.
- **Export:** renders a CPU‑computed stereogram and downloads it as a PNG.  The GPU preview is fast but introduces minor artifacts; the export uses `sirds-cpu.js` for a mathematically exact solve.

## Wave depth engine

The **wave** engine lives in `src/shaders/depth/wave-depth.glsl`.  It encodes a sinusoidal depth map across both axes:

```glsl
// depth/wave-depth.glsl
float depthAt(vec2 uv) {
    // centre the UV space and control frequency
    vec2 centered = uv * 2.0 - 1.0;
    float freq = 6.0;
    // combine sine waves in x and y for smooth ripples
    float wave = 0.5 + 0.25 * (sin(freq * centered.x) + sin(freq * centered.y));
    return clamp(wave, 0.0, 1.0);
}
```

Select **wave depth** from the *depth engine* dropdown to view these ripples.  Try adjusting **μ** and **E**:

- **μ ≈ 0.2 – 0.5:** yields gentle hills and valleys.  Larger values create deeper troughs but can be hard to fuse.
- **E ≈ 96 – 160px:** sets the distance between repeating waves.  Smaller E compresses the waves; larger E separates them.

To create your own depth engines, add a new GLSL file under `src/shaders/depth` that defines `float depthAt(vec2 uv)`.  Then append its filename (without extension) to the `DEPTH_ENGINES` array in `src/js/main.js`, and update the UI with a new `<option>` element in `index.html`.

## Stripes pattern

The **stripes** pattern generator renders bold vertical stripes using any palette.  You can choose the palette via the **aesthetic** menu or override it by editing the code directly.  Each call to `stripes()` picks colours pseudo‑randomly and draws columns of equal width across the tile.  The pattern is seamless across tile edges.

In the UI, select `stripes` under **pattern source** and set:

- **classic aesthetic:** black and white stripes reminiscent of optical test patterns.
- **lisa frank aesthetic:** neon rainbows for maximalist vibes.
- **neon noise aesthetic:** dark ground with electric colours.

If you want to adjust the stripe width programmatically, pass a `stripeWidth` parameter when building patterns.  For example:

```js
import { stripes } from './src/js/pattern-sources.js';

// build a 128px wide tile with 16px stripes using the neon palette
const tile = stripes(128, 128, { palette: 'neon_noise', seed: 12345, stripeWidth: 16 });
// upload the tile into WebGL as you would for randomDots or tiledImage
```

Changing the **seed** will randomize the color sequence.  Click **reseed pattern** in the UI to pick a new seed on the fly.

## Combining engines and patterns

Because depth and pattern are independent, you can mix and match them freely.  Here are a few fun recipes:

| Depth Engine | Pattern | E | μ | Description |
|--------------|---------|----|----|-------------|
| `wave-depth` | `stripes` (classic) | 128px | 0.4 | Classic zebra ripples that oscillate in and out of the page. |
| `sdf-shape` (torus) | `tiled_image` (lisa_frank) | 144px | 0.5 | A floating torus hidden behind psychedelic clouds. |
| `noise-terrain` | `animated_noise` | 96px | 0.35 | Organic fractal terrain with a living neon carpet. |
| `raymarch-depth` | `stripes` (neon_noise) | 160px | 0.6 | Sharp, ray‑marched objects rising through radiating stripes. |

Play with **μ** and **E** to fine‑tune the 3D illusion.  Smaller E reduces the pattern frequency (more compact) and increases difficulty; larger E enlarges the wallpaper but lowers depth resolution.  μ scales the depth offset; too small and the shape flattens, too large and the pattern cannot be fused.

## Programmatic generation (advanced)

If you wish to generate stereograms without the UI—for instance, to batch‑produce Magic Eye art or integrate into a creative pipeline—you can call the core functions directly from JavaScript.  Here's a minimal example:

```js
import { generateSIRDS } from './src/js/sirds-cpu.js';
import { stripes } from './src/js/pattern-sources.js';

// construct a depth array (floating‑point values between 0 and 1)
const width = 512;
const height = 512;
const depth = new Float32Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const u = x / width;
    const v = y / height;
    // simple wave depth similar to wave-depth.glsl
    depth[y * width + x] = 0.5 + 0.25 * (Math.sin(6 * (u - 0.5)) + Math.sin(6 * (v - 0.5)));
  }
}

// build a stripes wallpaper tile (E = 128, tile height = 128)
const wallpaper = stripes(128, 128, { palette: 'classic', stripeWidth: 8, seed: 42 });

// generate the stereogram as an ImageData
const stereogram = generateSIRDS(depth, {
  width,
  height,
  E: 128,
  mu: 0.4,
  pattern: wallpaper,
  seed: 42,
});

// draw into a canvas or export as desired
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
canvas.getContext('2d').putImageData(stereogram, 0, 0);
document.body.appendChild(canvas);
```

This example computes a wave depth on the CPU, builds a stripes pattern tile, and produces a CPU‑solved stereogram.  You can substitute any depth function or pattern builder.

## Further exploration

- **Add new shapes:** Extend `sdf-shape` by editing the signed‑distance functions in `src/shaders/depth/sdf-shape.glsl`.  For example, add a pyramid, spiral or custom glyph.  Then update the `<select id="shape">` options and increment the `shapeId` used in the shader.
- **Create your own depth engines:** Copy `wave-depth.glsl` and experiment with fractals, cellular automata or mathematical functions.  Each engine must define `float depthAt(vec2 uv)` returning values between 0 and 1.
- **Custom palettes:** Add new entries to the `PALETTES` object in `pattern-sources.js` to craft unique color schemes.  Patterns take a `palette` option which can be any key of `PALETTES`.
- **Animate any pattern:** To animate `stripes` or `tiled_image`, toggle the **Animate** checkbox and modify `refreshPattern()` in `src/js/main.js` to rebuild the pattern each frame.

By combining these tools with your imagination, you can produce endless variations of stereograms—from subtle landscapes to psychedelic explosions.  Have fun exploring!
