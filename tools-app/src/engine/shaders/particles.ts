// tools-app/src/engine/shaders/particles.ts
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
  col *= u_color;
  col *= 0.8 + u_audioLevel * 0.4;

  fragColor = vec4(col, density);
}
`

export const PARTICLES_SPHERE_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_radius;
uniform float u_particleCount;
uniform float u_rotationSpeed;
uniform vec3 u_color;
uniform float u_audioLevel;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_rotationSpeed * (1.0 + u_audioLevel * 0.3);

  float count = max(u_particleCount, 1.0);
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 500; i++) {
    if (float(i) >= count) break;
    float fi = float(i);
    float theta = hash(vec2(fi, 0.0)) * 6.28318;
    float phi = hash(vec2(fi, 1.0)) * 3.14159;
    float r = u_radius * (0.8 + 0.2 * sin(t + fi));

    vec3 p = vec3(
      r * sin(phi) * cos(theta),
      r * sin(phi) * sin(theta),
      r * cos(phi)
    );

    // Rotate around Y
    float ct = cos(t * 0.5), st = sin(t * 0.5);
    vec3 rp = vec3(p.x * ct + p.z * st, p.y, -p.x * st + p.z * ct);

    // Rotate around X
    float cx = cos(t * 0.3), sx = sin(t * 0.3);
    vec3 finalP = vec3(rp.x, rp.y * cx - rp.z * sx, rp.y * sx + rp.z * cx);

    vec2 proj = finalP.xy / (1.0 + finalP.z * 0.3);
    float d = length(proj - uv * 2.0 + 1.0);
    float brightness = exp(-d * 8.0);
    col += brightness * u_color;
    alpha += brightness;
  }

  col *= 0.7 + u_audioLevel * 0.5;
  fragColor = vec4(col, min(alpha * 0.02, 1.0));
}
`

export const PARTICLES_CUBE_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_gridScale;
uniform float u_particleSize;
uniform float u_depth;
uniform vec3 u_color;
uniform float u_audioLevel;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * (1.0 + u_audioLevel * 0.3);

  float scale = u_gridScale;
  float size = u_particleSize;
  float depth = u_depth;
  vec2 grid = fract(uv * scale) - 0.5;
  vec2 ig = floor(uv * scale);
  vec2 center = vec2(0.5);
  float d = length(grid - center);

  float pulse = sin(t * 2.0 + hash(ig) * 6.28) * 0.5 + 0.5;
  float dotSize = size * (0.3 + pulse * 0.7) * (1.0 - d * 0.5);
  float circle = 1.0 - smoothstep(dotSize * 0.5, dotSize * 0.55, length(grid - center));

  float z = sin(t + hash(ig + vec2(0.0, 1.0)) * 6.28) * depth;
  float alpha = circle * (0.5 + z * 0.5 + u_audioLevel * 0.3);

  vec3 col = u_color * (0.8 + pulse * 0.4);
  fragColor = vec4(col, alpha);
}
`

export const PARTICLES_FLOW_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_density;
uniform float u_size;
uniform float u_hueShift;
uniform vec3 u_color;
uniform float u_audioLevel;
uniform float u_opacity;
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

vec2 flowField(vec2 p, float t) {
  float angle = noise(p * 2.0 + t * 0.1) * 6.28;
  return vec2(cos(angle), sin(angle));
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.3);

  vec2 p = uv * u_density;
  vec2 dir = flowField(p, t);
  vec2 fp = fract(p) - 0.5;
  float d = length(fp);
  float trail = 1.0 - smoothstep(0.0, 0.3, d);

  vec3 baseCol = vec3(0.2, 0.8, 1.0);
  baseCol = 0.5 + 0.5 * cos(6.28 * (baseCol + u_hueShift + vec3(0.0, 0.33, 0.67)));
  vec3 col = baseCol * trail;
  col *= u_color;
  col *= 0.7 + u_audioLevel * 0.5;

  fragColor = vec4(col, trail * u_opacity);
}
`
