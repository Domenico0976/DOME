import type { EffectPassDef } from './index'

// Color grading with center-neutral percentage params (original §3.1):
// Exposure multiplicative (±1EV per 25 units), Temperature/Tint white-balance,
// Contrast linear around mid-gray, Saturation toward/away from luminance.
export const adjustmentsDef: EffectPassDef = {
  type: 'adjustments',
  label: 'Adjustments',
  defaultParams: { contrast: 50, exposure: 50, saturation: 50, temperature: 50, tint: 50 },
  controls: [
    { param: 'contrast', label: 'Contrast', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'exposure', label: 'Exposure', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'saturation', label: 'Saturation', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'temperature', label: 'Temperature', kind: 'slider', min: 0, max: 100, step: 1 },
    { param: 'tint', label: 'Tint', kind: 'slider', min: 0, max: 100, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  vec3 col = c.rgb * pow(2.0, (u_exposure - 50.0) / 25.0);
  col.r += (u_temperature - 50.0) * 0.0018;
  col.b -= (u_temperature - 50.0) * 0.0018;
  col.g += (50.0 - u_tint) * 0.0012;
  float cf = 1.0 + (u_contrast - 50.0) / 50.0;
  col = (col - 0.5) * cf + 0.5;
  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, clamp(1.0 + (u_saturation - 50.0) / 50.0, 0.0, 3.0));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`,
  uniforms: (p) => ({
    u_contrast: p.contrast ?? 50,
    u_exposure: p.exposure ?? 50,
    u_saturation: p.saturation ?? 50,
    u_temperature: p.temperature ?? 50,
    u_tint: p.tint ?? 50,
  }),
}
