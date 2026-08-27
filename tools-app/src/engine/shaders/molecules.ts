// Molecules: animated metaballs with cellular coloring and glow.
export const MOLECULES_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform float u_speed;
uniform float u_radius;
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
  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.4);
  int n = int(u_count);

  float field = 0.0;
  float closestId = 0.0;
  float minDist = 1e10;

  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 vel = vec2(
      sin(t * 0.41 + fi * 2.399) * 0.35,
      cos(t * 0.37 + fi * 3.141) * 0.28
    );
    vec2 center = vec2(0.5) + vel + 0.08 * vec2(
      sin(t * 0.7 + fi * 1.7),
      cos(t * 0.5 + fi * 2.3)
    );
    float r = u_radius * (1.0 + 0.3 * sin(t * 0.6 + fi) + u_audioLevel * 0.2);
    float d = length(uv - center);
    field += r * r / (d * d + 0.0001);
    if (d < minDist) { minDist = d; closestId = fi; }
  }

  float radiusSq = max(u_radius * u_radius, 0.0001);
  float threshold = 1.0 / radiusSq * u_radius * 0.5;
  float edge = smoothstep(threshold - 0.3, threshold + 0.1, field);
  float inner = smoothstep(threshold, threshold + 1.5, field);

  float cellNoise = noise(uv * 8.0 + closestId * 10.0 + t * 0.05);
  float hue = fract(closestId * 0.1618 + cellNoise * 0.15 + t * 0.01);

  vec3 cellColor = 0.5 + 0.5 * cos(6.28 * (hue + u_hueShift + vec3(0.0, 0.33, 0.67)));

  float glow = exp(-field * 0.8) * 0.4;
  float rim = smoothstep(0.3, 0.0, minDist) * 0.5;

  vec3 col = cellColor * edge * (0.6 + inner * 0.4) + cellColor * glow + vec3(0.8, 0.9, 1.0) * rim;
  col *= u_color;
  col *= 0.85 + u_audioLevel * 0.3;

  float alpha = max(edge, glow);
  fragColor = vec4(col, alpha);
}
`;
