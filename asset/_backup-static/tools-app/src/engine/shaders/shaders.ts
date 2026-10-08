// Shaders: neuro-noise with domain warping and voronoi overlay.
export const SHADERS_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_noiseScale;
uniform float u_warp;
uniform float u_complexity;
uniform float u_speed;
uniform int u_preset;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

vec2 domainWarp(vec2 p, float strength) {
  float q1 = fbm(p);
  float q2 = fbm(p + vec2(5.2, 1.3));
  return vec2(fbm(p + strength * vec2(q1, q2)),
              fbm(p + strength * vec2(q2, q1)));
}

float voronoi(vec2 x, float t) {
  vec2 ip = floor(x);
  vec2 fp = fract(x);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash(ip + g), hash(ip + g + vec2(31.0, 17.0)));
      o = 0.5 + 0.3 * sin(t + 6.28 * o);
      vec2 r = g + o - fp;
      md = min(md, dot(r, r));
    }
  }
  return md;
}

// Preset domain warpers
vec2 warp_turbulence(vec2 p, float t, float warp) {
  return domainWarp(p + t * 0.05, warp);
}

vec2 warp_wind(vec2 p, float t, float warp) {
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0)), fbm(p + vec2(5.2, 1.3)));
  return p + warp * vec2(sin(p.y * 2.0 + t), cos(p.x * 2.0 + t * 0.7));
}

vec2 warp_pulse(vec2 p, float t, float warp) {
  float pulse = 0.5 + 0.5 * sin(t * 1.5);
  return domainWarp(p * (1.0 + pulse * warp * 0.5), warp * (0.5 + pulse * 0.5));
}

vec2 warp_spiral(vec2 p, float t, float warp) {
  float angle = t * 0.3 + length(p) * warp;
  float c = cos(angle);
  float s = sin(angle);
  vec2 spiraled = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  return domainWarp(spiraled + t * 0.05, warp * 0.8);
}

vec2 warp_breathe(vec2 p, float t, float warp) {
  float breath = 0.5 + 0.5 * sin(t * 0.8);
  vec2 q = vec2(fbm(p + breath * warp), fbm(p + vec2(3.0, 7.0) + breath * warp));
  return p + warp * 0.5 * vec2(sin(q.x + t * 0.2), cos(q.y + t * 0.15));
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_speed * (0.8 + u_audioLevel * 0.3);
  float scale = u_noiseScale * (1.0 + u_audioLevel * 0.15);

  vec2 p = uv * scale;

  vec2 warped;
  if (u_preset == 0) warped = warp_turbulence(p, t, u_warp);
  else if (u_preset == 1) warped = warp_wind(p, t, u_warp);
  else if (u_preset == 2) warped = warp_pulse(p, t, u_warp);
  else if (u_preset == 3) warped = warp_spiral(p, t, u_warp);
  else warped = warp_breathe(p, t, u_warp);

  float n = fbm(warped * u_complexity);

  float v = voronoi(uv * 3.0 + t * 0.05, t);
  float voronoiEdge = smoothstep(0.02, 0.08, v);

  vec3 noiseColor = 0.5 + 0.5 * cos(6.28 * (n * 0.6 + vec3(0.0, 0.33, 0.67) + t * 0.015));
  vec3 voronoiColor = 0.5 + 0.5 * cos(6.28 * (v * 0.4 + vec3(0.1, 0.4, 0.7)));

  vec3 col = mix(noiseColor, voronoiColor, voronoiEdge * 0.35);
  col = mix(col, u_color, 0.3);
  col *= 0.85 + u_audioLevel * 0.3;

  fragColor = vec4(col, 1.0);
}
`
