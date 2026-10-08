// Tunnel: polar-coordinate FBM with radial rings, depth fog, and shape SDFs.
export const TUNNEL_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_twist;
uniform float u_density;
uniform float u_horizon;
uniform vec3 u_color;
uniform float u_audioLevel;
uniform int u_shape;
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

// Shape SDFs in [-1,1] space, centered at origin
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdTriangle(vec2 p, float r) {
  p.x = abs(p.x) - 0.5;
  p.y = p.y + 0.289;
  p = max(p * vec2(0.866, 0.5) + p.yx * vec2(-0.866, 0.5), p * vec2(0.866, 0.5) + p.yx * vec2(0.866, -0.5));
  return length(p) * r * 2.0 - r;
}

float sdSquare(vec2 p, float r) {
  return max(abs(p.x), abs(p.y)) * r * 2.0 - r;
}

float sdHexagon(vec2 p, float r) {
  p = abs(p);
  float q = max(dot(p, vec2(0.866, 0.5)), p.y);
  return length(vec2(clamp(q, 0.0, 1.0), min(p.y, 0.0))) * r * 2.0 - r;
}

float sdEllipse(vec2 p, float r, float aspect) {
  p.x /= aspect;
  return length(p) - r;
}

float sdRectangle(vec2 p, vec2 wh, float r) {
  return length(max(abs(p) - wh, 0.0)) - r;
}

float shapeDist(vec2 p, int shape, float r) {
  if (shape == 0) return sdCircle(p, r);
  if (shape == 1) return sdTriangle(p, r);
  if (shape == 2) return sdSquare(p, r);
  if (shape == 3) return sdHexagon(p, r);
  if (shape == 4) return sdEllipse(p, r, 1.5);
  return sdRectangle(p, vec2(0.6, 0.4), r);
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;

  // Horizon offset: shift tunnel center vertically
  uv.y -= u_horizon;

  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.4);

  // Smooth seam blending: blend across the polar angle discontinuity
  float seamBlend = 1.0 - smoothstep(0.0, 0.5, abs(sin(a * 0.5)));
  float seamOffset = cos(a) * seamBlend * 0.01;
  float smoothA = a + seamOffset;

  float spiral = smoothA * u_twist + t;
  float depth = 1.0 / (r + 0.001);
  float n = fbm(vec2(spiral, depth * 3.0 - t) + vec2(noise(vec2(smoothA, r) * 2.0)) * 0.3);

  float ring = sin(r * 25.0 - t * 2.5 + n * 4.0) * 0.5 + 0.5;
  ring = pow(ring, 1.5);

  float fade = exp(-r * 1.8) * u_density;

  // Apply shape mask
  float shapeR = 0.85;
  float s = shapeDist(uv, u_shape, shapeR);
  float shapeMask = 1.0 - smoothstep(-0.02, 0.02, s);
  fade *= mix(1.0, shapeMask, 0.9);

  vec3 col = 0.5 + 0.5 * cos(6.28 * (n * 0.5 + vec3(0.0, 0.33, 0.67) + t * 0.02));
  col *= u_color;
  col = mix(col * 0.3, col * 1.2, ring);
  col *= fade;
  col *= 0.85 + u_audioLevel * 0.3;

  float alpha = smoothstep(0.0, 0.15, fade);
  fragColor = vec4(col, alpha);
}
`
