import type { EffectPassDef } from './index'

// Bloom: thresholded bright-pass blurred additively over the base (Tool-Render.md §3.3).
// Single Intensity control like the original — threshold/radius are internal constants.
export const glowDef: EffectPassDef = {
  type: 'glow',
  label: 'Glow',
  defaultParams: { intensity: 0 },
  controls: [{ param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 100, step: 1 }],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
void main() {
  vec4 base = texture2D(u_tex, v_uv);
  vec3 sum = vec3(0.0);
  vec2 px = 10.0 / u_res;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float ang = fi * 0.5296;
    vec2 off = vec2(cos(ang), sin(ang)) * sqrt(fi / 12.0) * px;
    sum += texture2D(u_tex, clamp(v_uv + off, 0.0, 1.0)).rgb;
    sum += texture2D(u_tex, clamp(v_uv - off, 0.0, 1.0)).rgb;
  }
  vec3 blur = sum / 24.0;
  float l = (blur.r + blur.g + blur.b) / 3.0;
  float bright = max(0.0, l - 0.6) / 0.4;
  gl_FragColor = vec4(clamp(base.rgb + blur * bright * (u_intensity / 100.0), 0.0, 1.0), base.a);
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 0 }),
}
