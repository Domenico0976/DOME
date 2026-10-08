// Plasma: layered sine waves with FBM distortion and iridescent coloring.
export const PLASMA_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform float u_roughness;
uniform vec3 u_baseColor;
uniform vec3 u_accentColor;
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

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;

  float rough = clamp(u_roughness, 0.0, 1.0);
  int octaves = int(mix(2.0, 6.0, rough));
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.4);
  float s = u_scale * (1.0 + u_audioLevel * 0.15);

  float v = 0.0;
  v += sin(uv.x * s + t);
  v += sin(uv.y * s + t * 0.7);
  v += sin((uv.x + uv.y) * s * 0.5 + t * 1.3);
  v += 0.5 * sin(length(uv - 0.5) * s * 2.0 - t * 0.8);
  v *= 0.25;
  v += 0.5;
  v += fbm(uv * s * 0.8 + t * 0.1, octaves) * mix(0.1, 0.35, rough);

  vec3 col = mix(u_baseColor, u_accentColor, v);
  col = 0.5 + 0.5 * cos(6.28 * (v + col * 0.3 + t * 0.01));
  col *= u_color;
  col *= 0.8 + u_audioLevel * 0.4;

  fragColor = vec4(col, 1.0);
}
`
