import type { EffectPassDef } from './index'

// Concentric chromatic aberration: R/B split radially, gated by an Area/Falloff envelope (Tool-Render.md §3.2).
export const aberrationDef: EffectPassDef = {
  type: 'aberration',
  label: 'Aberration',
  defaultParams: { displace: 0, area: 50, falloff: 50 },
  controls: [
    { param: 'displace', label: 'Displace', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'area', label: 'Area', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'falloff', label: 'Falloff', kind: 'slider', min: 0, max: 100, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_displace;
uniform float u_area;
uniform float u_falloff;
void main() {
  float dist = length(v_uv - 0.5) * min(u_res.x, u_res.y);
  float env = smoothstep(u_area, u_area + max(1.0, u_falloff), dist);
  float wave = sin(dist * 0.08) * u_displace * env / u_res.x;
  vec4 c = texture2D(u_tex, v_uv);
  float r = texture2D(u_tex, clamp(v_uv + vec2(wave, 0.0), 0.0, 1.0)).r;
  float b = texture2D(u_tex, clamp(v_uv - vec2(wave, 0.0), 0.0, 1.0)).b;
  gl_FragColor = vec4(r, c.g, b, c.a);
}`,
  uniforms: (p) => ({ u_displace: p.displace ?? 0, u_area: p.area ?? 50, u_falloff: p.falloff ?? 50 }),
}
