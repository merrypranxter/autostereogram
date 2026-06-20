# math reference

> the shift is the secret. the secret is the depth. the depth is the magic.

## The depth map

A depth map is a scalar field `z(x, y) ∈ [0, 1]`, where `1` is **nearest** to the
viewer (pops out of the page) and `0` is **farthest** (the background plane).
Every depth engine in `src/shaders/depth/` resolves to a single function:

```glsl
float depthAt(vec2 uv); // uv in [0,1]^2  ->  z in [0,1]
```

## The separation equation

A repeating wallpaper of horizontal period `E` (the **eye separation**, in
pixels) hides depth by locally shifting where the pattern repeats. The
separation between the two points that the left and right eyes fuse is:

```
sep(z) = E · (1 − μ·z) / (2 − μ·z)
```

- `E` — pattern period ≈ interocular distance in screen pixels. ~128 is a
  comfortable default. Too large and the eyes cannot diverge enough to fuse;
  too small and the depth is shallow.
- `μ` — depth scale (relief intensity), default `0.4`. `0.2` is subtle, `0.8`
  is extreme.
- `z` — depth at the pixel.

At `z = 0`: `sep = E/2` (background repeats at half period under this
convention). As `z → 1`, `sep` shrinks — nearer points pull their repeats
closer together, and the brain reads that disparity as "closer."

## The GPU approximation (per-pixel)

`src/shaders/stereogram.frag`. For each output pixel we march **left** in steps
of the local separation until we fall inside the first tile `[0, E)`, then sample
the wallpaper there:

```
u = x
while (u >= E):
    z   = depth(u, y)
    u  -= sep(z)
color = pattern(u mod E, y)
```

Pixels that should share a pattern column converge to the same tile coordinate
(shifted by depth), so the repeats line up and fuse. This skips the strict
linking solve but is correct ~90% of the time and runs in real time. The GPU is
the fast. The fast is the approximation. The approximation is the 90%.

## The CPU true SIRDS (row-sequential)

`src/js/sirds-cpu.js`. The Thimbleby / Inglis / Witten algorithm
(*Displaying 3D Images: Algorithms for Single-Image Random-Dot Stereograms*,
Computers & Graphics 1994):

1. For each row, initialize a constraint array `same[x] = x`.
2. Scan left → right. At each `x`, compute `sep(z)`; the two fused points are
   `left = x − sep/2` and `right = left + sep`. If the link is **visible** (no
   nearer surface occludes it between the eyes), union `same[left]` and
   `same[right]` into one chain.
3. Scan left → right again and paint: linked pixels copy the color of their
   chain anchor; unlinked pixels are seeded from the wallpaper (or random dots).

This honors the hidden-surface constraint the GPU march ignores, giving clean
export-quality stills. The CPU is the true. The true is the slow. The slow is
the accurate. The accurate is the magic.

## Parameters at a glance

| param            | shallow | standard | deep / extreme |
| ---------------- | ------- | -------- | -------------- |
| `pattern_period` | 64      | **128**  | 256            |
| `depth_scale`    | 0.2     | **0.4**  | 0.8            |
