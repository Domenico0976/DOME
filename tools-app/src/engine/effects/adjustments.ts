import type { EffectPassDef } from './index'

// Brightness add -> contrast scaled around 128 -> luminance-preserving saturation (Tool-Render.md §3.1).
export const adjustmentsDef: EffectPassDef = {
  type: 'adjustments',
  label: 'Adjustments',
  defaultParams: { brightness: 0, contrast: 0, saturation: 0 },
  controls: [
    { param: 'brightness', label: 'Brightness', kind: 'slider', min: -100, max: 100, step: 1 },
    { param: 'contrast', label: 'Contrast', kind: 'slider', min: -100, max: 100, step: 1 },
    { param: 'saturation', label: 'Saturation', kind: 'slider', min: -1, max: 1, step: 0.01 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  vec3 col = c.rgb * 255.0 + u_brightness;
  float k = (259.0 * (u_contrast + 255.0)) / (255.0 * (259.0 - u_contrast));
  col = k * (col - 128.0) + 128.0;
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(g), col, 1.0 + u_saturation);
  gl_FragColor = vec4(clamp(col, 0.0, 255.0) / 255.0, c.a);
}`,
  uniforms: (p) => ({ u_brightness: p.brightness ?? 0, u_contrast: p.contrast ?? 0, u_saturation: p.saturation ?? 0 }),
}
