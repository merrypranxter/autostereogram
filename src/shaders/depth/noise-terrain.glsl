// noise-terrain.glsl — depth engine
// the terrain is the land. the land is the depth. the depth is the magic.
//
// Defines `float depthAt(vec2 uv)` returning z in [0,1].
// fbm heightfield -> rolling terrain that fuses as a landscape.
// Expects the shared uniform header from main.js.

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i + vec2(0.0, 0.0));
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    v += amp * vnoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

float depthAt(vec2 uv) {
  vec2 p = uv * 5.0;
  if (uAnimate > 0.5) {
    p += vec2(uTime * 0.15, uTime * 0.05); // drifting landscape
  }
  float h = fbm(p);
  // gentle contrast so ridges read as relief without breaking fusion
  h = smoothstep(0.15, 0.95, h);
  return clamp(h, 0.0, 1.0);
}
