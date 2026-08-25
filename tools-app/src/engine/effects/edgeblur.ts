import type { EffectPassDef } from './index'

// Variable blur strengthening away from an offsettable center point (Tool-Render.md §3.5).
export const edgeBlurDef: EffectPassDef = {
  type: 'edgeblur',
  label: 'Edge Blur',
  defaultParams: { intensity: 75, falloff: 50, x: 0, y: 0 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'falloff', label: 'Falloff', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'x', label: 'Center X', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'y', label: 'Center Y', kind: 'slider', min: 0, max: 100, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_falloff;
uniform float u_x;
uniform float u_y;
void main() {
  vec4 base = texture2D(u_tex, v_uv);
  vec2 cpos = vec2(u_x, u_y) / 100.0;
  float d01 = distance(v_uv, cpos) / 1.42;
  float amt = smoothstep(0.15, 1.0, d01) * (u_intensity / 100.0);
  float radius = amt * (0.5 + u_falloff / 100.0) * 18.0;
  if (radius < 0.5) { gl_FragColor = base; return; }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.7854;
    vec2 off = vec2(cos(ang), sin(ang)) * radius / u_res;
    sum += texture2D(u_tex, clamp(v_uv + off, 0.0, 1.0)).rgb;
  }
  gl_FragColor = vec4(sum / 8.0, base.a);
}`,
  uniforms: (p) => ({
    u_intensity: p.intensity ?? 75,
    u_falloff: p.falloff ?? 50,
    u_x: p.x ?? 0,
    u_y: p.y ?? 0,
  }),
}
