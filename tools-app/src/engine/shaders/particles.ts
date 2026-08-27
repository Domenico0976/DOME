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
uniform float u_count;
uniform float u_size;
uniform float u_hueShift;
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
  vec2 norm = uv * 2.0 - 1.0;
  float t = u_time * (1.0 + u_audioLevel * 0.4);

  float f = u_freq * 3.14159265;
  float chladni = u_a * sin(u_m * f * norm.x) * sin(u_n * f * norm.y)
                - u_b * sin(u_n * f * norm.x) * sin(u_m * f * norm.y);

  float edge = abs(chladni);
  float density = exp(-edge * u_density * 10.0);

  float modes = max(u_count, 1.0);
  for (int i = 1; i < 4; i++) {
    float fi = float(i);
    if (fi >= modes) break;
    density += 0.15 * exp(-abs(sin((u_m + fi) * f * norm.x) * sin((u_n + fi) * f * norm.y)
                              - sin((u_n + fi) * f * norm.x) * sin((u_m + fi) * f * norm.y)) * u_density * 8.0);
  }

  float n = noise(uv * 20.0 + t * 0.1) * 0.2;
  density += n * 0.3;

  float nodeSize = u_size * 0.01;
  density = smoothstep(nodeSize, nodeSize + 0.3, density);

  vec3 baseCol = vec3(0.2, 0.8, 1.0);
  baseCol = 0.5 + 0.5 * cos(6.28 * (baseCol + u_hueShift + vec3(0.0, 0.33, 0.67)));
  vec3 col = vec3(density) * baseCol;
  col *= 0.8 + u_audioLevel * 0.4;

  fragColor = vec4(col, density);
}
`
