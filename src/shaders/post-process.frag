// post-process.frag — final pass to screen
// optional fusion-aid: two convergence dots near the top. line one dot up over
// the other (wall-eyed) and the hidden image snaps into focus.
//
// main.js prepends: <#version + precision> + <shared uniform header>.
// Shared uniforms used: uResolution, uE (pattern period px).

uniform sampler2D uSceneTex;
uniform float uShowGuides; // 1.0 = draw convergence dots, 0.0 = off

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 col = texture(uSceneTex, vUv).rgb;

  if (uShowGuides > 0.5) {
    vec2 px = vUv * uResolution;
    float cx = uResolution.x * 0.5;
    float cy = uResolution.y * 0.92;        // near the top of the image
    float r = 6.0;
    // two dots separated by exactly one pattern period
    float d1 = length(px - vec2(cx - uE * 0.5, cy));
    float d2 = length(px - vec2(cx + uE * 0.5, cy));
    float dot = min(d1, d2);
    float mask = smoothstep(r + 1.5, r - 1.5, dot);
    // dark ring + light core so it shows on any wallpaper
    col = mix(col, vec3(0.05), mask);
    float core = smoothstep(r * 0.5 + 1.0, r * 0.5 - 1.0, dot);
    col = mix(col, vec3(0.95), core);
  }

  fragColor = vec4(col, 1.0);
}
