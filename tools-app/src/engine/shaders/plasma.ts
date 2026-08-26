// Plasma: layered sine waves with FBM distortion and iridescent coloring.
export const PLASMA_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform float u_colorShift;
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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.3);
  float s = u_scale * (1.0 + u_audioLevel * 0.1);

  float v = 0.0;
  v += sin(uv.x * s + t);
  v += sin(uv.y * s + t * 0.7);
  v += sin((uv.x + uv.y) * s * 0.5 + t * 1.3);
  v += 0.5 * sin(length(uv - 0.5) * s * 2.0 - t * 0.8);
  v *= 0.25;
  v += 0.5;
  v += fbm(uv * s * 0.8 + t * 0.1) * 0.2;

  vec3 col = 0.5 + 0.5 * cos(6.28 * (v * 0.7 + u_colorShift + vec3(0.0, 0.33, 0.67) + t * 0.01));
  col *= 0.85 + u_audioLevel * 0.3;

  fragColor = vec4(col, 1.0);
}
`
