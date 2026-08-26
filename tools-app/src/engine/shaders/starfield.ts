// Starfield: procedural stars with noise-based twinkle and depth.
export const STARFIELD_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_density;
uniform float u_zoom;
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

float star(vec2 p, float t) {
  float d = length(fract(p) - 0.5);
  float twinkle = 0.7 + 0.3 * sin(t * 2.0 + hash(floor(p)) * 6.28);
  return smoothstep(0.04 * twinkle, 0.0, d);
}

void main() {
  vec2 uv = v_uv;
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.3);
  vec2 p = uv * u_zoom + vec2(t * 0.1, t * 0.05);
  float n = noise(p * 3.0);
  float s = star(p + n * 0.2, t);

  vec3 warm = vec3(1.0, 0.95, 0.8);
  vec3 cool = vec3(0.7, 0.8, 1.0);
  vec3 starCol = mix(warm, cool, hash(floor(p + t)) * 0.6);

  vec3 col = starCol * s * (0.8 + n * 0.4 + u_audioLevel * 0.3) + vec3(0.02, 0.03, 0.08);
  float alpha = max(s, 0.05);
  fragColor = vec4(col * u_density, alpha);
}
`
