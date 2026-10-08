import type { EffectPassDef } from './index'

// VHS row glitch: horizontal sine shift with an organic low-frequency wobble (Tool-Render.md §3.4).
// Reduced-motion freezes u_time upstream so the pattern stays static.
export const wavesDef: EffectPassDef = {
  type: 'waves',
  label: 'Waves',
  defaultParams: { intensity: 0, quantity: 0, organic: 0 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'quantity', label: 'Quantity', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'organic', label: 'Organic', kind: 'slider', min: 0, max: 100, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_quantity;
uniform float u_organic;
void main() {
  float q = u_quantity * 0.06;
  float wob = sin(v_uv.y * 23.0 + u_time * 0.7) * u_organic * 0.9;
  float phase = v_uv.y * 6.2831 * q + u_time * 0.8 + wob;
  float shift = sin(phase) * (u_intensity / 100.0) * 0.12;
  gl_FragColor = texture2D(u_tex, clamp(vec2(v_uv.x + shift, v_uv.y), 0.0, 1.0));
}`,
  uniforms: (p) => ({
    u_intensity: p.intensity ?? 0,
    u_quantity: p.quantity ?? 0,
    u_organic: p.organic ?? 0,
  }),
}
