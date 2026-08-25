import type { EffectPassDef } from './index'

// Row-wise horizontal sine shift, VHS scanline glitch (Tool-Render.md §3.4).
// Reduced-motion freezes u_time upstream so the pattern stays static.
export const wavesDef: EffectPassDef = {
  type: 'waves',
  label: 'Waves',
  defaultParams: { intensity: 15, quantity: 0.08, speed: 1 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 40, step: 1 },
    { param: 'quantity', label: 'Quantity', kind: 'slider', min: 0.01, max: 0.5, step: 0.005 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 4, step: 0.1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_quantity;
uniform float u_speed;
void main() {
  float shift = sin(v_uv.y * 6.2831 * u_quantity + u_time * u_speed) * u_intensity / u_res.x;
  gl_FragColor = texture2D(u_tex, clamp(vec2(v_uv.x + shift, v_uv.y), 0.0, 1.0));
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 15, u_quantity: p.quantity ?? 0.08, u_speed: p.speed ?? 1 }),
}
