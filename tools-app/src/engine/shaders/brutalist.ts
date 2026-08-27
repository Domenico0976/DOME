// Brutalist: grid of animated geometric shapes — each cell independently rotates,
// translates and scales. Shapes are circle / square / triangle / star / cross,
// selected by a deterministic hash per cell.
export const BRUTALIST_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_grid;
uniform float u_noise;
uniform float u_speed;
uniform float u_phase;
uniform float u_shape;   // 0=circle 1=square 2=triangle 3=star 4=cross
uniform vec3 u_color;
uniform float u_audioLevel;
in vec2 v_uv;
out vec4 fragColor;

// ── hash / noise ────────────────────────────────────────────────────────────
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
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

// ── SDF shapes (centred at origin, size 1 = fits in [-0.5,0.5]) ────────────
float sdCircle(vec2 p) {
  return length(p) - 0.5;
}

float sdSquare(vec2 p) {
  vec2 q = abs(p) - 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// equilateral triangle pointing up
float sdTriangle(vec2 p) {
  vec2 q = p;
  q.y -= 0.5 * 0.57735;          // centroid offset
  q = mat2(0.86603, 0.5, -0.5, 0.86603) * q; // rotate -30°
  q.y = -q.y;
  q.xy = abs(q.xy);
  return max(q.x, q.y * -0.57735) - 0.5 * 0.57735;
}

// 4-pointed star
float sdStar(vec2 p, float points) {
  vec2 q = p;
  float a = atan(q.y, q.x);
  float r = length(q);
  a = mod(a, 6.283185 / points);
  a = abs(a - 3.141593 / points);
  return r * cos(a) - 0.5 * 0.55;
}

// plus / cross
float sdCross(vec2 p) {
  vec2 q = abs(p);
  return max(abs(q.x) + abs(q.y) - 0.35, max(q.x, q.y) - 0.15);
}

float sdShape(vec2 p, float shapeType) {
  if (shapeType < 0.5) return sdCircle(p);
  if (shapeType < 1.5) return sdSquare(p);
  if (shapeType < 2.5) return sdTriangle(p);
  if (shapeType < 3.5) return sdStar(p, 4.0);
  return sdCross(p);
}

// ── main ────────────────────────────────────────────────────────────────────
void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);

  // Keep shapes isotropic by correcting for aspect in the grid domain
  uv.x *= aspect;

  float t = u_time * u_speed * (1.0 + u_audioLevel * 0.5);
  float phase = u_phase;
  float grid = clamp(u_grid, 2.0, 12.0);

  // Cell coordinates
  vec2 cellUV = uv * grid;
  vec2 cellID = floor(cellUV);
  vec2 cellCenter = cellID + 0.5;
  vec2 cellPos = fract(cellUV) - 0.5;  // local space in [-0.5, 0.5]

  // Per-cell hash values (deterministic, stable)
  float h1 = hash(cellID);
  float h2 = hash2(cellID);
  float h3 = hash(cellID + 100.0);
  float h4 = hash(cellID + 200.0);
  float h5 = hash(cellID + 300.0);

  // Shape selection — quantized 0-4
  float shapeType = floor(h1 * 5.0);

  // Independent rotation per cell
  float rotSpeed = (h2 - 0.5) * 2.0;   // -1 to 1
  float rot = t * rotSpeed * 0.4 + phase + h3 * 6.2831;
  mat2 rotMat = mat2(cos(rot), sin(rot), -sin(rot), cos(rot));
  cellPos *= rotMat;

  // Independent translation per cell (subtle wobble)
  float transAmp = u_noise * 0.08;
  vec2 translation = vec2(
    sin(t * 0.7 + h4 * 6.2831) * transAmp,
    cos(t * 0.5 + h5 * 6.2831) * transAmp
  );
  cellPos += translation;

  // Independent scale per cell (breathing)
  float scaleBase = 0.72 + h3 * 0.18;  // 0.72 – 0.90
  float scalePulse = sin(t * 1.2 + h2 * 6.2831) * 0.08;
  float scale = scaleBase + scalePulse + u_audioLevel * 0.12;
  cellPos *= scale;

  // Evaluate shape SDF
  float d = sdShape(cellPos, shapeType);
  float lineW = 0.035 + u_audioLevel * 0.015;
  float filled = 1.0 - smoothstep(-lineW, lineW, d);   // filled shape
  float outlined = smoothstep(lineW * 0.3, lineW * 1.5, abs(d)) *
                   (1.0 - smoothstep(lineW * 0.3, lineW * 1.5, abs(d) - lineW * 0.5));
  float shapeMask = max(filled, outlined);

  // Cell background — subtle brutalist colour
  float bgBase = 0.06 + h4 * 0.06;
  float bgNoise = noise(cellID * 0.3 + t * 0.05) * u_noise * 0.05;
  vec3 bgColor = vec3(bgBase + bgNoise);

  // Shape colour with audio-reactive brightness
  float pulse = 0.85 + 0.15 * sin(t * 1.5 + h1 * 6.2831);
  vec3 shapeColor = u_color * pulse;
  shapeColor += u_audioLevel * u_color * 0.25;

  // Grid lines (thin brutalist strokes)
  vec2 gridFrac = fract(cellUV);
  float hLine = step(gridFrac.y, 0.02) * step(1.0 - gridFrac.y, 0.02);
  float vLine = step(gridFrac.x, 0.02) * step(1.0 - gridFrac.x, 0.02);
  float gridLine = max(hLine, vLine) * 0.18;

  // Compose
  vec3 col = bgColor;
  col = mix(col, shapeColor, shapeMask);
  col += gridLine;

  // Audio-reactive intensity boost
  col *= 1.0 + u_audioLevel * 0.3;

  fragColor = vec4(col, 1.0);
}
`
