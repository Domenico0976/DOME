// Molecules as Knowledge Map: hash-positioned nodes with noise drift,
// proximity-based connection lines, glow effects, and audio reactivity.
export const MOLECULES_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform float u_speed;
uniform float u_radius;
uniform float u_connectionDist;
uniform vec3 u_nodeColor;
uniform vec3 u_lineColor;
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

vec2 noiseVec2(vec2 p) {
  return vec2(
    noise(p + vec2(1.7, 9.3)),
    noise(p + vec2(8.3, 2.8))
  );
}

float softCircle(vec2 uv, vec2 center, float r) {
  float d = length(uv - center);
  return smoothstep(r, r * 0.3, d);
}

float segDist(vec2 uv, vec2 a, vec2 b) {
  vec2 pa = uv - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 uvA = uv;
  uvA.x *= aspect;

  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.5);
  int n = int(u_count);

  vec2 positions[32];

  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    float fi = float(i);
    float theta = fi * 2.399963;
    float r = sqrt(fi / float(n));
    vec2 basePos = vec2(
      r * cos(theta) * 0.5 + 0.5,
      r * sin(theta) * 0.5 / aspect + 0.5
    );
    vec2 flow = noiseVec2(basePos * 3.0 + t * 0.3) * 0.15;
    vec2 pos = basePos + flow;
    pos.x += sin(t * 0.2 + fi * 0.7) * 0.03;
    pos.y += cos(t * 0.15 + fi * 1.1) * 0.03;
    positions[i] = pos;
  }

  vec3 col = vec3(0.01, 0.015, 0.025);

  float connDist = u_connectionDist;
  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    for (int j = i + 1; j < 32; j++) {
      if (j >= n) break;
      vec2 pi = positions[i];
      vec2 pj = positions[j];
      float d = length(pi - pj);
      if (d < connDist) {
        float lineAlpha = (1.0 - d / connDist);
        lineAlpha = lineAlpha * lineAlpha;
        float sd = segDist(v_uv, pi, pj);
        float line = smoothstep(0.003, 0.001, sd) * lineAlpha;
        float audioGlow = 1.0 + u_audioLevel * 1.5;
        col += u_lineColor * line * 0.5 * audioGlow;
      }
    }
  }

  float nodeR = u_radius;
  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    vec2 pos = positions[i];
    float glow = softCircle(v_uv, pos, nodeR);
    float core = smoothstep(nodeR * 0.5, nodeR * 0.1, length(v_uv - pos));
    float pulse = 1.0 + u_audioLevel * 0.4 * sin(t * 3.0 + float(i));
    glow *= pulse;
    core *= pulse;
    float hueShift = float(i) * 0.05;
    vec3 nodeCol = 0.5 + 0.5 * cos(6.28 * (u_nodeColor + hueShift + vec3(0.0, 0.13, 0.27)));
    col += nodeCol * glow * 0.7;
    col += vec3(1.0) * core * 0.4;
  }

  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    vec2 pos = positions[i];
    float d = length(v_uv - pos);
    float amb = exp(-d * 3.0) * 0.06;
    col += u_nodeColor * amb;
  }

  col *= 0.9 + u_audioLevel * 0.2;
  fragColor = vec4(col, 1.0);
}
`
