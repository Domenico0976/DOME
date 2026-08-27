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
uniform vec3 u_bgColor;
uniform float u_audioLevel;
// Handle controls
uniform float u_handleX;
uniform float u_handleY;
uniform float u_vibration;
uniform float u_vibrationArea;
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

  // Handle X → deformation offset, Handle Y → frequency asymmetry
  float deforma = u_handleX * 0.5;
  float asym = 1.0 + u_handleY * 0.5;

  float f = u_freq * 3.14159265;
  float chladni = u_a * sin(u_m * f * (norm.x + deforma)) * sin(u_n * asym * f * norm.y)
                - u_b * sin(u_n * asym * f * (norm.x + deforma)) * sin(u_m * f * norm.y);

  // Vibration: time-based perturbation near handle point
  float vibDist = length(norm - vec2(u_handleX * 0.5 - 0.5, u_handleY * 0.5 - 0.5));
  float vibEnvelope = smoothstep(u_vibrationArea, 0.0, vibDist);
  float vib = sin(t * 8.0 + vibDist * 10.0) * u_vibration * vibEnvelope;
  chladni += vib;

  float edge = abs(chladni);
  float density = exp(-edge * u_density * 10.0);

  float modes = max(u_count, 1.0);
  for (int i = 1; i < 4; i++) {
    float fi = float(i);
    if (fi >= modes) break;
    density += 0.15 * exp(-abs(sin((u_m + fi) * f * (norm.x + deforma)) * sin((u_n + fi) * asym * f * norm.y)
                              - sin((u_n + fi) * asym * f * (norm.x + deforma)) * sin((u_m + fi) * f * norm.y)) * u_density * 8.0);
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

  fragColor = vec4(mix(u_bgColor, col, clamp(density, 0.0, 1.0)), 1.0);
}
`

export const PARTICLES_SPHERE_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_radius;
uniform float u_density;
uniform float u_size;
uniform float u_rotationSpeed;
uniform float u_organic;
uniform vec3 u_color;
uniform vec3 u_bgColor;
uniform float u_audioLevel;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.2))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 157.0 + 113.0 * i.z;
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_rotationSpeed * (1.0 + u_audioLevel * 0.3);

  float count = max(u_density, 1.0);
  float sz = u_size * 0.015;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 500; i++) {
    if (float(i) >= count) break;
    float fi = float(i);
    float theta = hash(vec2(fi, 0.0)) * 6.28318;
    float phi = hash(vec2(fi, 1.0)) * 3.14159;
    float r = u_radius * (0.8 + 0.2 * sin(t + fi));

    // Organic noise perturbation
    vec3 noisedPos = vec3(theta, phi, r) + noise(vec3(theta, phi, r) * 2.0) * u_organic;
    float th = noisedPos.x;
    float ph = noisedPos.y;
    float rr = noisedPos.z;

    vec3 p = vec3(
      rr * sin(ph) * cos(th),
      rr * sin(ph) * sin(th),
      rr * cos(ph)
    );

    // Rotate around Y
    float cy = cos(t * 0.5), sy = sin(t * 0.5);
    vec3 rp = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);

    // Rotate around X
    float cx = cos(t * 0.3), sx = sin(t * 0.3);
    vec3 finalP = vec3(rp.x, rp.y * cx - rp.z * sx, rp.y * sx + rp.z * cx);

    vec2 proj = finalP.xy / (1.0 + finalP.z * 0.3);
    float d = length(proj - uv * 2.0 + 1.0);
    float brightness = exp(-d * 8.0 / sz);
    col += brightness * u_color;
    alpha += brightness;
  }

  col *= 0.7 + u_audioLevel * 0.5;
  fragColor = vec4(mix(u_bgColor, col, min(alpha * 0.02, 1.0)), 1.0);
}
`

export const PARTICLES_CUBE_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_density;
uniform float u_size;
uniform float u_rotationSpeed;
uniform float u_organic;
uniform float u_depth;
uniform vec3 u_color;
uniform vec3 u_bgColor;
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
  float t = u_time * u_rotationSpeed * (1.0 + u_audioLevel * 0.3);

  float scale = u_density;
  float size = u_size * 0.02;
  float depth = u_depth;
  vec2 grid = fract(uv * scale) - 0.5;
  vec2 ig = floor(uv * scale);
  vec2 center = vec2(0.5);
  float d = length(grid - center);

  // Organic noise perturbation on grid
  vec2 noisedGrid = grid + noise(ig * 0.1 + t * 0.2) * u_organic;
  float nd = length(noisedGrid - center);

  float pulse = sin(t * 2.0 + hash(ig) * 6.28) * 0.5 + 0.5;
  float dotSize = size * (0.3 + pulse * 0.7) * (1.0 - nd * 0.5);
  float circle = 1.0 - smoothstep(dotSize * 0.5, dotSize * 0.55, length(noisedGrid - center));

  float z = sin(t + hash(ig + vec2(0.0, 1.0)) * 6.28) * depth;
  float alpha = circle * (0.5 + z * 0.5 + u_audioLevel * 0.3);

  vec3 col = u_color * (0.8 + pulse * 0.4);
  fragColor = vec4(mix(u_bgColor, col, clamp(alpha, 0.0, 1.0)), 1.0);
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
uniform vec3 u_bgColor;
uniform float u_audioLevel;
uniform float u_opacity;
// Flow controls
uniform float u_waves;
uniform float u_randomize;
uniform float u_waveSpeed;
uniform float u_rotation;
uniform float u_zoom;
uniform float u_depth;
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

vec2 rotateVec(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

vec2 flowField(vec2 p, float t) {
  float angle = noise(p * u_zoom + t * u_waveSpeed * 0.1) * 6.28;
  angle += noise(p * u_zoom * 2.0 + t * u_waveSpeed * 0.05) * u_randomize * 3.14;
  return vec2(cos(angle), sin(angle));
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.3);

  vec2 p = (uv - 0.5) * u_density * u_zoom;
  p = rotateVec(p, u_rotation);
  vec2 dir = flowField(p, t);

  // Wave displacement
  float wave = sin(p.x * 3.14 + t * u_waveSpeed) * u_waves * 0.1;
  p.y += wave;

  // Depth-based offset
  float depthOffset = noise(p + t * 0.05) * u_depth;
  p += dir * depthOffset;

  vec2 fp = fract(p) - 0.5;
  float d = length(fp);
  float trail = 1.0 - smoothstep(0.0, 0.3 + u_size * 0.01, d);

  vec3 baseCol = vec3(0.2, 0.8, 1.0);
  baseCol = 0.5 + 0.5 * cos(6.28 * (baseCol + u_hueShift + vec3(0.0, 0.33, 0.67)));
  vec3 col = baseCol * trail;
  col *= u_color;
  col *= 0.7 + u_audioLevel * 0.5;

  fragColor = vec4(mix(u_bgColor, col, trail * u_opacity), 1.0);
}
`
