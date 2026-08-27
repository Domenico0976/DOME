// Tunnel: polar-coordinate FBM with radial rings and depth fog.
export const TUNNEL_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_twist;
uniform float u_density;
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.3);

  float spiral = a * u_twist + t;
  float depth = 1.0 / (r + 0.001);
  float n = fbm(vec2(spiral, depth * 3.0 - t) + vec2(noise(vec2(a, r) * 2.0)) * 0.3);

  float ring = sin(r * 25.0 - t * 2.5 + n * 4.0) * 0.5 + 0.5;
  ring = pow(ring, 1.5);

  float fade = exp(-r * 1.8) * u_density;

  vec3 col = 0.5 + 0.5 * cos(6.28 * (n * 0.5 + u_hueShift + vec3(0.0, 0.33, 0.67) + t * 0.02));
  col = mix(col * 0.3, col * 1.2, ring);
  col *= fade;
  col *= 0.85 + u_audioLevel * 0.3;

  float alpha = smoothstep(0.0, 0.15, fade);
  fragColor = vec4(col, alpha);
}
`
