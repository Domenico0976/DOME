import type { EffectPassDef } from './index'

// Fisheye bulge remap + specular highlight; X/Y set the lens center in percent (Tool-Render.md §3.6).
export const lensDef: EffectPassDef = {
  type: 'lens',
  label: 'Distort Lens',
  defaultParams: { intensity: 0, x: 50, y: 50 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'x', label: 'Center X', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'y', label: 'Center Y', kind: 'slider', min: 0, max: 100, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_center_x;
uniform float u_center_y;
void main() {
  vec2 center = vec2(u_center_x, u_center_y);
  vec2 d = (v_uv - center) * u_res;
  float maxR = min(u_res.x, u_res.y) * 0.5;
  float bulge = pow(clamp(length(d) / maxR, 0.0, 1.0), 1.0 - (u_intensity / 100.0) * 0.9);
  vec4 c = texture2D(u_tex, clamp(center + d * bulge / u_res, 0.0, 1.0));
  vec2 hl = (v_uv - (center - vec2(0.04))) * u_res;
  float s2 = 2.0 * pow(min(u_res.x, u_res.y) * 0.05, 2.0);
  c.rgb += exp(-dot(hl, hl) / s2) * 0.35 * (u_intensity / 100.0);
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`,
  uniforms: (p) => ({
    u_intensity: p.intensity ?? 0,
    u_center_x: (p.x ?? 50) / 100,
    u_center_y: (p.y ?? 50) / 100,
  }),
}
