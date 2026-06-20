// depth.frag — depth-map pass main
// render depth map z(x,y) in [0,1] -> FBO (stored in the red channel).
// the depth is the secret. the secret is the shape. the shape is the world.
//
// main.js composes the full shader as:
//   <#version + precision> + <shared uniform header> + <depth/<engine>.glsl> + this
// so `depthAt(vec2)` is provided by the selected engine, and the shared
// uniforms (uResolution, uTime, uShapeId, uAnimate) are already declared.

float depthAt(vec2 uv); // provided by the prepended engine source

in vec2 vUv;
out vec4 fragColor;

void main() {
  float z = clamp(depthAt(vUv), 0.0, 1.0);
  // store depth in r; keep g/b for debugging, a = 1
  fragColor = vec4(z, z, z, 1.0);
}
