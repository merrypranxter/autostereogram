// stereogram.frag — GPU per-pixel pattern-shift approximation
// the GPU is the fast. the fast is the approximation. the approximation is the 90%.
//
// For each output pixel we march LEFT in steps of the local separation until we
// land inside the first pattern tile, then sample the wallpaper there. Pixels
// that should "share" a pattern column end up sampling the same tile coordinate,
// shifted by depth -> the brain fuses the repeats and sees relief.
//
//   sep = E * (1 - mu*z) / (2 - mu*z)        // separation in pixels
//   sample pattern at (u mod E) once u < E
//
// This skips the strict Thimbleby-Inglis-Witten linking solve (see sirds-cpu.js
// for the true row-sequential path) but fuses correctly the vast majority of
// the time and runs in real time.
//
// main.js prepends: <#version + precision> + <shared uniform header>.
// Shared uniforms used here: uResolution, uE (pattern period px), uMu (depth scale).

uniform sampler2D uDepthTex;    // z in .r
uniform sampler2D uPatternTex;  // wallpaper tile, sampled with REPEAT wrap
uniform float uPatternAspect;   // patternTexHeightPx / E, to keep tile square-ish

in vec2 vUv;
out vec4 fragColor;

const int MAX_STEPS = 64;

void main() {
  float E = max(uE, 1.0);
  float xPix = vUv.x * uResolution.x;
  float yPix = vUv.y;

  float u = xPix;

  // march left until within the first tile [0, E)
  for (int i = 0; i < MAX_STEPS; i++) {
    if (u < E) break;
    float sampleX = clamp(u / uResolution.x, 0.0, 1.0);
    float z = texture(uDepthTex, vec2(sampleX, yPix)).r;
    float sep = E * (1.0 - uMu * z) / (2.0 - uMu * z);
    sep = max(sep, 1.0);
    u -= sep;
  }

  // sample the wallpaper. x normalized into one tile, y by pattern aspect.
  float pu = u / E;                       // REPEAT wrap handles fract
  float pv = (vUv.y * uResolution.y) / (E * uPatternAspect);
  vec3 col = texture(uPatternTex, vec2(pu, pv)).rgb;

  fragColor = vec4(col, 1.0);
}
