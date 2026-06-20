// sdf-shape.glsl — depth engine
// the shape is the secret. the secret is the depth. the depth is the magic.
//
// Defines `float depthAt(vec2 uv)` returning z in [0,1] (1 = nearest / pops out).
// Expects the shared uniform header (uResolution, uTime, uShapeId, uAnimate)
// to be prepended by main.js before this source.
//
// uShapeId: 0 = sphere, 1 = torus, 2 = rounded box, 3 = "EYE" glyph bars

float sdSphere(vec2 p, float r) {
  return length(p) - r;
}

float sdTorus2D(vec2 p, float R, float r) {
  // cross-section of a torus laid flat -> ring whose height bulges
  return abs(length(p) - R) - r;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

// crude blocky glyph field so a recognizable shape hides in the dots
float sdGlyphEYE(vec2 p) {
  // three vertical bars of an abstract eye/diamond
  float d = 1e9;
  d = min(d, sdRoundBox(p - vec2(-0.45, 0.0), vec2(0.06, 0.30), 0.04));
  d = min(d, sdRoundBox(p - vec2( 0.45, 0.0), vec2(0.06, 0.30), 0.04));
  d = min(d, sdSphere(p, 0.18));
  return d;
}

float depthAt(vec2 uv) {
  // center, correct aspect so shapes are not squashed
  vec2 p = (uv - 0.5);
  p.x *= uResolution.x / uResolution.y;
  p *= 1.6; // zoom out a touch

  float anim = uAnimate > 0.5 ? (0.85 + 0.15 * sin(uTime * 1.2)) : 1.0;

  float d;
  if (uShapeId < 0.5) {
    d = sdSphere(p, 0.55 * anim);
  } else if (uShapeId < 1.5) {
    d = sdTorus2D(p, 0.42 * anim, 0.16);
  } else if (uShapeId < 2.5) {
    d = sdRoundBox(p, vec2(0.50, 0.40) * anim, 0.12);
  } else {
    d = sdGlyphEYE(p / anim);
  }

  // inside (d < 0) -> rounded relief that pops toward viewer
  float inside = clamp(-d, 0.0, 1.0);
  // dome falloff for a smooth fusable bulge
  float z = sqrt(clamp(inside * 1.8, 0.0, 1.0));
  return clamp(z, 0.0, 1.0);
}
