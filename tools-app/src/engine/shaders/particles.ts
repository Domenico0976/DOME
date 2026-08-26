export const PARTICLES_CHLADNI_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_a;
uniform float u_b;
uniform float u_m;
uniform float u_n;
uniform float u_freq;
uniform float u_density;
uniform float u_audioLevel;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = v_uv;
  vec2 norm = uv * 2.0 - 1.0;
  float t = u_time * (1.0 + u_audioLevel * 0.4);

  float f = u_freq * 3.14159265;
  float chladni = u_a * sin(u_m * f * norm.x) * sin(u_n * f * norm.y)
                - u_b * sin(u_n * f * norm.x) * sin(u_m * f * norm.y);

  float edge = abs(chladni);
  float density = exp(-edge * u_density * 10.0);

  float n = noise(uv * 20.0 + t * 0.1) * 0.2;
  density += n * 0.3;

  vec3 col = vec3(density) * vec3(0.2, 0.8, 1.0);
  col *= 0.8 + u_audioLevel * 0.4;

  fragColor = vec4(col, density);
}
`
