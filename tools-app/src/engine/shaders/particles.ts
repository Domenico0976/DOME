// tools-app/src/engine/shaders/particles.ts
import { NOISE_GLSL } from './noise'

export const PARTICLES_CHLADNI_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_a;
uniform float u_b;
uniform float u_m;
uniform float u_n;
uniform float u_freq;
uniform float u_density;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 norm = uv * 2.0 - 1.0;
  
  // Chladni figure
  float f = u_freq * 3.14159265;
  float chladni = u_a * sin(u_m * f * norm.x) * sin(u_n * f * norm.y)
                - u_b * sin(u_n * f * norm.x) * sin(u_m * f * norm.y);
  
  // Particle density based on Chladni zero-crossing
  float edge = abs(chladni);
  float density = exp(-edge * u_density * 10.0);
  
  // Add noise for organic feel
  float noise = vnoise(uv * 20.0 + u_time * 0.1) * 0.2;
  density += noise * 0.3;
  
  // Color based on density
  vec3 col = vec3(density) * vec3(0.2, 0.8, 1.0);
  
  fragColor = vec4(col, density);
}
`
