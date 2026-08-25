import type { EffectPassDef } from './index'

// Film-grain per-pixel noise; motion > 0.5 animates the field by seeding from frame time (Tool-Render.md §3.7).
export const grainDef: EffectPassDef = {
  type: 'grain',
  label: 'Grain',
  defaultParams: { intensity: 0.5, motion: 1 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 1, step: 0.01 },
    { param: 'motion', label: 'Motion', kind: 'slider', min: 0, max: 1, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float n = hash(v_uv * u_res + u_seed) - 0.5;
  gl_FragColor = vec4(clamp(c.rgb + n * u_intensity, 0.0, 1.0), c.a);
}`,
  uniforms: (p, frame) => ({
    u_intensity: p.intensity ?? 0.5,
    u_seed: (p.motion ?? 1) > 0.5 ? Math.floor(frame.timeSec * 60) : 0,
  }),
}
