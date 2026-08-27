export const BRUTALIST_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_grid;
uniform float u_noise;
uniform float u_speed;
uniform vec3 u_color;
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
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.3);
  vec2 grid = floor(uv * u_grid) / u_grid;
  float n = noise(grid * 50.0 + t);
  float line = step(0.95, fract(uv.x * u_grid)) * 0.5 + step(0.95, fract(uv.y * u_grid)) * 0.5;
  float v = n * u_noise + line;
  float pulse = 0.5 + 0.5 * sin(t * 2.0 + v * 6.28);
  float threshold = 0.5 - u_audioLevel * 0.15;
  vec3 col = vec3(v > threshold ? 0.95 : 0.08);
  col *= u_color;
  col *= 0.8 + pulse * 0.2 * u_audioLevel;
  fragColor = vec4(col, 1.0);
}
`
