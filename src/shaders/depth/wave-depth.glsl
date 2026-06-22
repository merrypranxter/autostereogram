// wave-depth.glsl
// A simple sinusoidal depth map that produces rippling wave patterns.
// Depth is encoded as a periodic sinusoid in both x and y directions.
// The result is a smooth repeating wave that hides a fluid landscape.

float depthAt(vec2 uv) {
    // Shift UV so that waves originate from the center of the screen.
    vec2 centered = uv * 2.0 - 1.0;
    // Frequency controls the number of waves across the view.
    float freq = 6.0;
    // Combine sine waves in x and y; scale and offset into [0,1].
    float wave = 0.5 + 0.25 * (sin(freq * centered.x) + sin(freq * centered.y));
    return clamp(wave, 0.0, 1.0);
}
