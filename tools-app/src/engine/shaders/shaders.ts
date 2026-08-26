// tools-app/src/engine/shaders/shaders.ts
import { NOISE_GLSL } from './noise'

export const SHADERS_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_noiseScale;
uniform float u_warp;
uniform float u_colorShift;
uniform float u_complexity;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;

  // Domain warping
  vec2 p = uv * u_noiseScale;
  vec2 warp = domainWarp(p + u_time * 0.1, u_warp);

  // FBM on warped coordinates
  float v = fbmOctFloat(warp * u_complexity, 6.0);

  // Color mapping
  vec3 col = hsv2rgb(vec3(
    fract(v + u_colorShift + u_time * 0.02),
    0.6 + v * 0.3,
    0.3 + v * 0.7
  ));

  fragColor = vec4(col, 1.0);
}
`
