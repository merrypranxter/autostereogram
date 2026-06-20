// raymarch-depth.glsl — depth engine
// the scene is the world. the world is the depth. the depth is the magic.
//
// Defines `float depthAt(vec2 uv)` returning z in [0,1] (1 = nearest).
// Depth channel of a tiny raymarched 3D scene (sphere + ground), normalized
// so the nearest hit reads ~1 and the far plane reads ~0.
// Expects the shared uniform header from main.js.

float sdSphere3(vec3 p, float r) { return length(p) - r; }

float sceneSDF(vec3 p) {
  // a bobbing sphere over a soft ground plane
  float t = uAnimate > 0.5 ? uTime : 0.0;
  vec3 c = vec3(0.0, 0.15 + 0.12 * sin(t * 1.5), 0.0);
  float sphere = sdSphere3(p - c, 0.55);
  float ground = p.y + 0.65;
  return min(sphere, ground);
}

float depthAt(vec2 uv) {
  vec2 ndc = (uv - 0.5);
  ndc.x *= uResolution.x / uResolution.y;

  vec3 ro = vec3(0.0, 0.0, 2.4);              // camera
  vec3 rd = normalize(vec3(ndc * 1.1, -1.6)); // ray dir

  float tNear = 0.5;
  float tFar  = 5.0;
  float t = tNear;
  float hit = -1.0;

  for (int i = 0; i < 80; i++) {
    vec3 pos = ro + rd * t;
    float d = sceneSDF(pos);
    if (d < 0.002) { hit = t; break; }
    t += d;
    if (t > tFar) break;
  }

  if (hit < 0.0) return 0.0; // miss -> far / background

  // near hits -> high z (pop out). normalize within [tNear, tFar].
  float z = 1.0 - (hit - tNear) / (tFar - tNear);
  return clamp(z, 0.0, 1.0);
}
