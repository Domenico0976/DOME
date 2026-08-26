// Flowfield: curl noise with particle density and flow-based coloring.
export const FLOWFIELD_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform float u_color;
uniform float u_particles;
uniform float u_trails;
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

vec2 curlNoise(vec2 p) {
  float e = 0.1;
  float n1 = noise(p + vec2(e, 0.0));
  float n2 = noise(p - vec2(e, 0.0));
  float n3 = noise(p + vec2(0.0, e));
  float n4 = noise(p - vec2(0.0, e));
  return vec2((n3 - n4) / (2.0 * e), (n2 - n1) / (2.0 * e));
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  vec2 p = uv * u_scale;
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.4);

  vec2 flow = curlNoise(p + t * 0.5) * 0.5;

  float density = 0.0;
  int n = min(int(u_particles), 64);

  for (int i = 0; i < 64; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 seed = vec2(
      fract(sin(fi * 12.9898) * 43758.5453),
      fract(sin(fi * 78.233 + 1.0) * 43758.5453)
    );

    vec2 pos = seed;
    for (int j = 0; j < 8; j++) {
      vec2 f = curlNoise(pos * u_scale + t * 0.5) * 0.03;
      pos += f;
    }

    float d = length(uv - pos);
    density += exp(-d * d * 3000.0);
  }

  density = clamp(density, 0.0, 1.0);

  float angle = atan(flow.y, flow.x);
  vec3 col = 0.5 + 0.5 * cos(6.28 * (angle / 6.28 + u_color + t * 0.02 + vec3(0.0, 0.33, 0.67)));
  col *= density * (0.8 + u_audioLevel * 0.4);

  float alpha = density * u_trails;
  fragColor = vec4(col, max(alpha, density * 0.1));
}
`
