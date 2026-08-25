import type { EffectPassDef } from './index'

// Variable radial blur: sharp inside "area", growing blur toward borders via "falloff" (Tool-Render.md §3.5).
export const edgeBlurDef: EffectPassDef = {
  type: 'edgeblur',
  label: 'Edge Blur',
  defaultParams: { area: 0.4, falloff: 0.3 },
  controls: [
    { param: 'area', label: 'Area', kind: 'slider', min: 0, max: 0.8, step: 0.01 },
    { param: 'falloff', label: 'Falloff', kind: 'slider', min: 0.05, max: 0.6, step: 0.01 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_area;
uniform float u_falloff;
void main() {
  vec4 base = texture2D(u_tex, v_uv);
  float dist = length(v_uv - 0.5) / 0.7071;
  float radius = max(0.0, (dist - u_area) / max(0.001, u_falloff)) * 12.0;
  if (radius < 0.5) { gl_FragColor = base; return; }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.7854;
    vec2 off = vec2(cos(ang), sin(ang)) * radius / u_res;
    sum += texture2D(u_tex, clamp(v_uv + off, 0.0, 1.0)).rgb;
  }
  gl_FragColor = vec4(sum / 8.0, base.a);
}`,
  uniforms: (p) => ({ u_area: p.area ?? 0.4, u_falloff: p.falloff ?? 0.3 }),
}
