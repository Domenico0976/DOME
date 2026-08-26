// Shaders: neuro-noise with domain warping and voronoi overlay.
export const SHADERS_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_noiseScale;
uniform float u_warp;
uniform float u_colorShift;
uniform float u_complexity;
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
  for (int i = 0; i < 5; i++) {
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

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * (0.8 + u_audioLevel * 0.3);
  float scale = u_noiseScale * (1.0 + u_audioLevel * 0.15);

  vec2 p = uv * scale;
  vec2 warped = domainWarp(p + t * 0.08, u_warp);
  float n = fbm(warped * u_complexity);

  float v = voronoi(uv * 3.0 + t * 0.05, t);
  float voronoiEdge = smoothstep(0.02, 0.08, v);

  vec3 noiseColor = 0.5 + 0.5 * cos(6.28 * (n * 0.6 + u_colorShift + vec3(0.0, 0.33, 0.67) + t * 0.015));
  vec3 voronoiColor = 0.5 + 0.5 * cos(6.28 * (v * 0.4 + u_colorShift + vec3(0.1, 0.4, 0.7)));

  vec3 col = mix(noiseColor, voronoiColor, voronoiEdge * 0.35);
  col *= 0.85 + u_audioLevel * 0.3;

  fragColor = vec4(col, 1.0);
}
`
