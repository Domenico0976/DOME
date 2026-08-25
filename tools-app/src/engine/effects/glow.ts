import type { EffectPassDef } from './index'

// Bloom: thresholded bright blur added back over the base (Tool-Render.md §3.3).
// Single-pass approximation of extract->blur->additive via 12 radial tap pairs (24 samples / 24).
export const glowDef: EffectPassDef = {
  type: 'glow',
  label: 'Glow',
  defaultParams: { intensity: 0.7, threshold: 0.5, radius: 8 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'threshold', label: 'Threshold', kind: 'slider', min: 0, max: 1, step: 0.01 },
    { param: 'radius', label: 'Radius', kind: 'slider', min: 1, max: 16, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_threshold;
uniform float u_radius;
void main() {
  vec4 base = texture2D(u_tex, v_uv);
  vec3 sum = vec3(0.0);
  vec2 px = u_radius / u_res;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float ang = fi * 0.5296;
    vec2 off = vec2(cos(ang), sin(ang)) * sqrt(fi / 12.0) * px;
    sum += texture2D(u_tex, clamp(v_uv + off, 0.0, 1.0)).rgb;
    sum += texture2D(u_tex, clamp(v_uv - off, 0.0, 1.0)).rgb;
  }
  vec3 blur = sum / 24.0;
  float l = (blur.r + blur.g + blur.b) / 3.0;
  float bright = max(0.0, l - u_threshold) / max(0.001, 1.0 - u_threshold);
  gl_FragColor = vec4(clamp(base.rgb + blur * bright * u_intensity, 0.0, 1.0), base.a);
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 0.7, u_threshold: p.threshold ?? 0.5, u_radius: p.radius ?? 8 }),
}
