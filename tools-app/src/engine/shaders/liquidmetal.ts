// Liquidmetal: animated metaballs with metallic fresnel shading.
export const LIQUIDMETAL_SDF_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_morph;
uniform float u_blobs;
uniform float u_speed;
uniform float u_roughness;
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
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
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
  vec2 uv = v_uv * 2.0 - 1.0;
  float aspect = u_res.x / max(u_res.y, 1.0);
  uv.x *= aspect;
  float time = u_time * u_speed * (1.0 + u_audioLevel * 0.5);
  int n = int(u_blobs);

  float field = 0.0;
  vec2 closest = vec2(0.0);
  float minDist = 1e10;

  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float phase = fi * 2.399;
    vec2 center = vec2(
      sin(time * 0.31 + phase) * 0.7 + cos(time * 0.17 + fi) * 0.2,
      cos(time * 0.27 + phase * 1.3) * 0.5 + sin(time * 0.13 + fi * 0.7) * 0.15
    );
    center.x *= aspect;
    float r = 0.18 + 0.04 * sin(time * 0.8 + fi * 1.7) + u_audioLevel * 0.06;
    float d = length(uv - center);
    field += r * r / (d * d + 0.001);
    if (d < minDist) { minDist = d; closest = center; }
  }

  float edge = 1.0 - smoothstep(u_morph * 3.5, u_morph * 3.5 + 0.15, field);

  vec2 toCenter = uv - closest;
  vec2 normal2D = normalize(toCenter + 0.001);
  float lighting = 0.5 + 0.5 * dot(normal2D, normalize(vec2(1.0, 1.2)));
  float spec = pow(lighting, 3.0) * (1.0 - u_roughness * 0.5);

  float fresnel = pow(1.0 - minDist * 0.8, 2.5);

  float n1 = fbm(uv * 2.0 + time * 0.15);
  float n2 = fbm(uv * 3.5 - time * 0.1);
  vec3 chrome = mix(vec3(0.72, 0.78, 0.85), vec3(0.95, 0.97, 1.0), n1 * 0.6);
  vec3 warm = mix(vec3(0.9, 0.6, 0.3), vec3(1.0, 0.85, 0.7), n2);
  chrome = 0.5 + 0.5 * cos(6.28 * (chrome + u_hueShift + vec3(0.0, 0.33, 0.67)));
  warm = 0.5 + 0.5 * cos(6.28 * (warm + u_hueShift + vec3(0.0, 0.33, 0.67)));
  vec3 base = mix(chrome, warm, fresnel * 0.35);

  vec3 col = base * (0.15 + lighting * 0.5 + spec * 0.5) + vec3(1.0) * spec * 0.4 + fresnel * 0.25;
  col *= u_color;
  col *= 0.85 + u_audioLevel * 0.3;

  float alpha = smoothstep(0.0, 0.08, edge);
  fragColor = vec4(col, alpha);
}
`
