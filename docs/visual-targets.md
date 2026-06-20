# visual targets

> the image is a lie, and the lie is beautiful.

Three aesthetic regimes, each a pairing of a **depth engine** with a
**pattern source** and a palette.

## classic_dots

Monochrome random-dot SIRDS. A hidden shape (sphere, torus, box, glyph) floats
in a field of black-and-white noise. `E = 128`.

- depth: `sdf-shape`
- pattern: `random_dots`
- palette: `#000000 #ffffff`
- feel: the 1991 newspaper Magic Eye. austere, pure, the original trick.

> the dots are the noise. the noise is the pattern. the pattern is the wallpaper.
> the wallpaper is the depth. the shape is the secret. the wall-eyed is the magic.

## lisa_frank_hidden

A vivid tiled SIS texture — confetti, rainbow gradients, candy blobs — with a
glyph hidden inside. Consumes `lisa_frank_aesthetic` when wired into the
ecosystem; falls back to the built-in generated tile.

- depth: `sdf-shape` (eye glyph) or `raymarch-depth`
- pattern: `tiled_image`
- palette: `#ff00cc #00ffcc #ffff00 #ff6600`
- feel: 1990s trapper-keeper maximalism. you don't know it's hiding anything
  until your eyes relax.

> the frank is the rainbow. the rainbow is the leopard. the leopard is the
> dolphin. the dolphin is the heart. the heart is the depth. the depth is the magic.

## breathing_glyph

Animated depth with a slow pulse — a wiggle-stereogram that breathes. The
relief gently expands and contracts; the noise wallpaper reseeds for a living
shimmer.

- depth: `sdf-shape` (animate on) or `noise-terrain` (drifting)
- pattern: `animated_noise`
- palette: `#0a001a #8338ec #ff006e #ffbe0b`
- feel: alive. the glyph inhales. the depth is time.

> the glyph is breathing. the pulse is the heart. the wiggle is the dance.
> the animation is the time. the time is the depth. the fusion is the living.

## tuning notes

- Keep `E` in `[96, 160]` for the most reliable first-time fusion.
- For prints/exports, prefer the **CPU true SIRDS** path (the export button) so
  occlusion boundaries stay clean.
- High `μ` (0.7+) reads dramatic on screen but can tear at steep depth
  discontinuities — soften the depth map (the SDF dome falloff already does this).
