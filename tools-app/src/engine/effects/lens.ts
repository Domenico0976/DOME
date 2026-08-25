import type { EffectPassDef } from './index'

// Fisheye bulge remap toward center + specular highlight near the lens (Tool-Render.md §3.6).
export const lensDef: EffectPassDef = {
  type: 'lens',
  label: 'Distort Lens',
  defaultParams: { intensity: 0.7, centerX: 0.5, centerY: 0.5 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 0.95, step: 0.01 },
    { param: 'centerX', label: 'Center X', kind: 'slider', min: 0, max: 1, step: 0.01 },
    { param: 'centerY', label: 'Center Y', kind: 'slider', min: 0, max: 1, step: 0.01 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_centerX;
uniform float u_centerY;
void main() {
  vec2 center = vec2(u_centerX, u_centerY);
  vec2 d = (v_uv - center) * u_res;
  float maxR = min(u_res.x, u_res.y) * 0.5;
  float bulge = pow(clamp(length(d) / maxR, 0.0, 1.0), 1.0 - u_intensity * 0.9);
  vec4 c = texture2D(u_tex, clamp(center + d * bulge / u_res, 0.0, 1.0));
  vec2 hl = (v_uv - (center - vec2(0.04))) * u_res;
  float s2 = 2.0 * pow(min(u_res.x, u_res.y) * 0.05, 2.0);
  c.rgb += exp(-dot(hl, hl) / s2) * 0.35 * u_intensity;
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 0.7, u_centerX: p.centerX ?? 0.5, u_centerY: p.centerY ?? 0.5 }),
}
