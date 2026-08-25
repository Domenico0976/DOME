import type { EffectPassDef } from './index'

// Concentric chromatic wave: R sampled outward, B inward, G fixed (Tool-Render.md §3.2).
export const aberrationDef: EffectPassDef = {
  type: 'aberration',
  label: 'Aberration',
  defaultParams: { displace: 10, frequency: 0.05 },
  controls: [
    { param: 'displace', label: 'Displace', kind: 'slider', min: 0, max: 40, step: 0.5 },
    { param: 'frequency', label: 'Frequency', kind: 'slider', min: 0.01, max: 0.15, step: 0.005 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_displace;
uniform float u_frequency;
void main() {
  float dist = length(v_uv - 0.5) * min(u_res.x, u_res.y);
  float wave = sin(dist * u_frequency) * u_displace / u_res.x;
  vec4 c = texture2D(u_tex, v_uv);
  float r = texture2D(u_tex, clamp(v_uv + vec2(wave, 0.0), 0.0, 1.0)).r;
  float b = texture2D(u_tex, clamp(v_uv - vec2(wave, 0.0), 0.0, 1.0)).b;
  gl_FragColor = vec4(r, c.g, b, c.a);
}`,
  uniforms: (p) => ({ u_displace: p.displace ?? 10, u_frequency: p.frequency ?? 0.05 }),
}
