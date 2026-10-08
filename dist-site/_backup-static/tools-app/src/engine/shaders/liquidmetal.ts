// Liquidmetal: SDF raymarched metaballs with chrome/fresnel metallic shading.
// Each blob is a sphere SDF; raymarch to surface, compute normal, apply
// environment-approximated metallic reflections with audio-reactive morph.
export const LIQUIDMETAL_SDF_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_morph;
uniform float u_blobs;
uniform float u_speed;
uniform float u_roughness;
uniform float u_zoom;
uniform float u_rotation;
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
  vec2 centered = uv - vec2(0.5, 0.5);
  centered /= u_zoom;
  centered = rot(u_rotation) * centered;
  uv = centered + vec2(0.5, 0.5);

  float time = u_time * u_speed * (1.0 + u_audioLevel * 0.6);
  int n = int(u_blobs);

  float field = 0.0;
  vec2 closest = vec2(0.0);
  float minDist = 1e10;

  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float phase = fi * 2.399;
    // Blob movement with noise flow + audio reactivity
    float audioMorph = 1.0 + u_audioLevel * 0.5;
    vec3 bp = vec3(
      sin(time * 0.31 * audioMorph + phase) * 0.6 +
      cos(time * 0.17 * audioMorph + fi) * 0.25,
      cos(time * 0.27 * audioMorph + phase * 1.3) * 0.45 +
      sin(time * 0.13 * audioMorph + fi * 0.7) * 0.2,
      sin(time * 0.2 + fi * 1.1) * 0.15
    );

    // Varying radii with morph control
    float baseR = 0.15 + u_morph * 0.12;
    float r = baseR + 0.04 * sin(time * 0.8 + fi * 1.7) + u_audioLevel * 0.05;
    float d = length(uv - center);
    field += r * r / (d * d + 0.001);
    if (d < minDist) { minDist = d; closest = center; }
  }

  // ---- Background: gradient + noise texture ----
  vec3 bgTop = mix(vec3(0.02, 0.02, 0.04), vec3(0.05, 0.05, 0.08), uv.y);
  vec3 bgBot = vec3(0.01, 0.01, 0.02);
  vec3 bgColor = mix(bgBot, bgTop, uv.y);
  bgColor += fbm(uv * 4.0 + time * 0.05) * 0.02;

  if (hitDist > 0.9) {
    fragColor = vec4(bgColor, 1.0);
    return;
  }

  // ---- Metallic Fresnel shading ----
  vec3 N = normalize(hitNormal);
  vec3 V = normalize(-ro);

  // Chromatic environment approximation
  float envUvX = N.x * 0.5 + 0.5;
  float envUvY = N.y * 0.5 + 0.5;
  vec3 envLeft = vec3(0.1, 0.15, 0.25);
  vec3 envRight = vec3(0.6, 0.65, 0.75);
  vec3 envTop = vec3(0.9, 0.92, 0.95);
  vec3 envBot = vec3(0.02, 0.02, 0.03);

  vec3 envColor = mix(mix(envBot, envTop, envUvY), mix(envLeft, envRight, envUvX), 0.5);
  envColor += fbm(N.xz * 3.0 + time * 0.1) * 0.1;

  // Fresnel
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  fresnel = mix(0.04, 1.0, fresnel);

  // Diffuse component (subtle)
  vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
  float diff = max(dot(N, lightDir), 0.0) * 0.15;

  // Specular (sharp chrome highlights)
  vec3 H = normalize(lightDir + V);
  float spec = pow(max(dot(N, H), 0.0), mix(64.0, 8.0, u_roughness));

  // Second light for rim
  vec3 lightDir2 = normalize(vec3(-0.6, 0.3, 0.5));
  float spec2 = pow(max(dot(N, lightDir2), 0.0), mix(32.0, 6.0, u_roughness));

  // Combine: mirror environment with fresnel blend
  vec3 mirrorColor = reflect(-V, N);
  float mU = mirrorColor.x * 0.5 + 0.5;
  float mV = mirrorColor.y * 0.5 + 0.5;
  vec3 mirrorEnv = mix(mix(envBot, envTop, mV), mix(envLeft, envRight, mU), 0.5);
  mirrorEnv += fbm(mirrorColor.xz * 3.0 + time * 0.1) * 0.1;

  vec3 metalBase = mix(u_color, vec3(1.0), 0.3);
  vec3 col = mirrorEnv * fresnel + envColor * (1.0 - fresnel) * 0.6;
  col += spec * metalBase * 0.8;
  col += spec2 * metalBase * 0.3;
  col += diff * metalBase * 0.2;

  // Edge glow / iridescence
  float edgeGlow = pow(fresnel, 1.5) * 0.4;
  col += edgeGlow * vec3(0.4, 0.5, 0.7);

  // Audio pulse brightness
  col *= 0.85 + u_audioLevel * 0.25;

  fragColor = vec4(col, 1.0);
}
`
