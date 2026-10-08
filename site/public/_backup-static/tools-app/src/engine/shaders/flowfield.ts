// Flowfield: curl-noise liquid simulator.
// Two-pass pipeline:
//   1. advect — integrate particle positions via curl noise (float FBO)
//   2. accum  — fade previous trails + render soft particle blobs (RGBA8 FBO)
// Particles follow divergence-free flow; viscosity controls trail persistence.
export const FLOWFIELD_ADVECT_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform float u_particles;
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
  float e = 0.01;
  float n1 = noise(p + vec2(e, 0.0));
  float n2 = noise(p - vec2(e, 0.0));
  float n3 = noise(p + vec2(0.0, e));
  float n4 = noise(p - vec2(0.0, e));
  return vec2((n3 - n4) / (2.0 * e), (n2 - n1) / (2.0 * e));
}

void main() {
  vec2 uv = v_uv;
  vec2 pos = texture(u_tex, uv).rg;

  vec2 aspect = vec2(u_res.x / max(u_res.y, 1.0), 1.0);
  vec2 p = pos * u_scale;
  float t = u_time * u_speed;

  // Semi-implicit Euler integration in curl noise field
  vec2 flow = curlNoise(p + t) * 0.02;
  vec2 vel = flow;

  // Wrap positions to [0,1] domain
  pos = fract(pos + vel);

  float alpha = 1.0;
  fragColor = vec4(pos, alpha, 1.0);
}
`

export const FLOWFIELD_ACCUM_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_particles;
uniform vec3 u_color;
uniform float u_viscosity;
uniform vec2 u_res;
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
  float e = 0.01;
  float n1 = noise(p + vec2(e, 0.0));
  float n2 = noise(p - vec2(e, 0.0));
  float n3 = noise(p + vec2(0.0, e));
  float n4 = noise(p - vec2(0.0, e));
  return vec2((n3 - n4) / (2.0 * e), (n2 - n1) / (2.0 * e));
}

float snoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = v_uv;
  vec2 aspect = vec2(u_res.x / max(u_res.y, 1.0), 1.0);

  // Fade previous accumulation based on viscosity
  vec3 prev = texture(u_prev, uv).rgb;
  float fade = 1.0 - (1.0 / (1.0 + u_viscosity * 2.5)) * 0.04;
  prev *= fade;

  // Sample particle position at this UV
  vec2 pixPos = texture(u_particles, uv).rg;

  // Render each particle as a soft Gaussian blob
  float px = uv.x - pixPos.x;
  float py = (1.0 - uv.y) - pixPos.y;
  float dist = length(vec2(px * aspect.x, py * aspect.y));
  float glow = exp(-dist * dist * 800.0) * 0.6;

  // Color: subtle luminance shift from base color
  float lum = dot(u_color, vec3(0.299, 0.587, 0.114));
  vec3 pCol = u_color + vec3(lum * 0.15);
  prev += pCol * glow;

  fragColor = vec4(prev, 1.0);
}
`
