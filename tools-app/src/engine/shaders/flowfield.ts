// tools-app/src/engine/shaders/flowfield.ts
import { NOISE_GLSL } from './noise'

export const FLOWFIELD_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform float u_color;
uniform float u_particles;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * u_scale;
  
  // Curl noise gives divergence-free flow
  vec2 flow = curlNoise(p + u_time * u_speed * 0.5) * 0.5;
  
  // Create particle density by tracing along the field
  float density = 0.0;
  int n = int(u_particles);
  
  for (int i = 0; i < 256; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 seed = vec2(
      fract(sin(fi * 12.9898) * 43758.5453),
      fract(sin(fi * 78.233 + 1.0) * 43758.5453)
    );
    
    vec2 pos = seed;
    // Trace forward along flow field
    for (int j = 0; j < 20; j++) {
      vec2 f = curlNoise(pos * u_scale + u_time * u_speed * 0.5) * 0.02;
      pos += f;
    }
    
    float d = length(uv - pos);
    density += exp(-d * d * 5000.0);
  }
  
  density = clamp(density, 0.0, 1.0);
  
  // Color from flow direction
  float angle = atan(flow.y, flow.x);
  vec3 col = hsv2rgb(vec3(
    fract(angle / 6.28318 + u_color + u_time * 0.05),
    0.7,
    density * 1.2
  ));
  
  fragColor = vec4(col, 1.0);
}
`
