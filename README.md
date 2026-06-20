# autostereogram

> **Magic Eye, in your browser.** A SIRDS — single-image random-dot stereogram —
> is a repeating-pattern field that hides a 3D depth map. The brain fuses the
> shifted repeats and sees something that isn't there. Depth is encoded as a
> horizontal shift of the pattern.
>
> _the pattern is the wallpaper. the wallpaper is the depth. the depth is the magic._

A real-time WebGL2 autostereogram generator with a CPU export path for
print-quality stills. Swappable depth engines, three pattern sources, live
parameter tuning.

---

## 👁 How to view (this is half the fun)

Autostereograms are viewed by **decoupling your focus from your convergence**.
Two ways:

### Wall-eyed (parallel / diverged) — the default here

1. Sit an arm's length from the screen.
2. Relax your eyes as if staring _through_ the screen at something far behind it.
3. There are **two small dots** near the top of the image. As your eyes diverge,
   they drift apart and you'll see **three** dots — lock onto the **middle** one.
4. Hold it. The flat noise resolves into depth and the hidden shape rises toward
   you. Don't refocus or it collapses.

### Cross-eyed (converged)

1. Cross your eyes slightly (look at a fingertip held between you and the screen).
2. Merge the two top dots into a middle one this way instead.
3. The shape appears — but **depth inverts**: what popped out now sinks in.

> the guide is the fun. the fun is the magic. the magic is the eye. the eye is the
> brain. the brain is the fusion.

Tip: the convergence dots can be toggled off in the panel once you've got it.

---

## Run it

It's a static site, but ES modules + `fetch()` need a real server (not
`file://`):

```bash
# any static server works; pick one
python3 -m http.server 8000
#   or
npx serve .
```

Then open <http://localhost:8000>. Tweak depth engine, shape, pattern, `E`, and
`μ` live. Hit **export true SIRDS (CPU)** to download a clean PNG.

---

## How it works

A two-pass GPU pipeline plus a CPU fallback for export:

1. **depth pass** — `src/shaders/depth.frag` + a swappable engine from
   `src/shaders/depth/` renders the depth map `z(x,y) ∈ [0,1]` to a framebuffer.
2. **stereogram pass** — `src/shaders/stereogram.frag` does the per-pixel
   pattern-shift approximation: march left in steps of the local separation,
   then sample the wallpaper. Fast, GPU-friendly, fuses ~90% of the time.
3. **post pass** — `src/shaders/post-process.frag` overlays the convergence dots.
4. **export** — `src/js/sirds-cpu.js` runs the true row-sequential
   Thimbleby–Inglis–Witten linking algorithm on the read-back depth, for
   occlusion-clean stills.

The separation equation:

```
sep(z) = E · (1 − μ·z) / (2 − μ·z)
```

Full derivation and the row-linking algorithm in
[`docs/math-reference.md`](docs/math-reference.md).

> the GPU is the fast. the fast is the approximation. the approximation is the 90%.
> the CPU is the true. the true is the slow. the slow is the accurate.

---

## Depth engines

| engine            | source                                  | what it hides            |
| ----------------- | --------------------------------------- | ------------------------ |
| `sdf-shape`       | `src/shaders/depth/sdf-shape.glsl`      | sphere, torus, box, glyph |
| `raymarch-depth`  | `src/shaders/depth/raymarch-depth.glsl` | depth of a 3D scene      |
| `noise-terrain`   | `src/shaders/depth/noise-terrain.glsl`  | fbm heightfield landscape |

Each engine defines `float depthAt(vec2 uv)`; `main.js` prepends a shared
uniform header and `depth.frag`'s `main()`. Drop in a new `.glsl` that defines
`depthAt` and register it in `DEPTH_ENGINES`.

## Pattern sources

| source           | look                                    |
| ---------------- | --------------------------------------- |
| `random_dots`    | monochrome classic SIRDS noise          |
| `tiled_image`    | vivid SIS texture (lisa frank default)  |
| `animated_noise` | living neon noise, reseeds per frame    |

See [`src/js/pattern-sources.js`](src/js/pattern-sources.js).

## Aesthetic regimes

- **classic_dots** — monochrome random dots, hidden shape, `E=128`.
- **lisa_frank_hidden** — vivid tiled pattern, hidden glyph (consumes
  `lisa_frank_aesthetic`).
- **breathing_glyph** — animated depth, slow pulse, wiggle-stereogram.

More in [`docs/visual-targets.md`](docs/visual-targets.md).

---

## Parameters

| param            | values                                   |
| ---------------- | ---------------------------------------- |
| `pattern_period` (`E`) | 64 (shallow) · **128** (standard) · 256 (deep) |
| `depth_scale` (`μ`)    | 0.2 (subtle) · **0.4** (standard) · 0.8 (extreme) |
| `pattern_source` | `random_dots` · `tiled_image` · `animated_noise` |
| `animate`        | breathing glyph on/off                   |

## Gotchas

- The pattern repeats **horizontally only**. `E` ≈ eye separation: too big →
  can't fuse, too small → shallow depth.
- The GPU shift is _not_ the strict SIRDS constraint — use the **CPU export**
  for clean prints.

## File tree

```
autostereogram/
├── README.md
├── repo_seed.txt
├── context.manifest.json
├── .gitignore
├── index.html
├── src/
│   ├── js/
│   │   ├── main.js              # WebGL2 engine, UI, export glue
│   │   ├── sirds-cpu.js         # true row-linking SIRDS (accurate)
│   │   └── pattern-sources.js   # noise | tiled image | animated noise
│   └── shaders/
│       ├── depth/
│       │   ├── sdf-shape.glsl
│       │   ├── raymarch-depth.glsl
│       │   └── noise-terrain.glsl
│       ├── depth.frag           # depth map z(x,y) ∈ [0,1] → FBO
│       ├── stereogram.frag      # per-pixel pattern lookup + depth shift
│       └── post-process.frag
└── docs/
    ├── math-reference.md
    └── visual-targets.md
```

## Ecosystem

A **consumer** repo: eats depth from `sdf_fields` / `raymarching` and patterns
from any `*_aesthetic` / `*_patterns` repo. Pairs with `op_art_style`, `moire`.

> the depth is the input. the pattern is the input. the input is the art. the art
> is the magic. the magic is the eye.
