// tools-app/src/engine/shaders/noise.ts

export const NOISE_GLSL = `
// --- Noise Library for DOME Generative Tools ---

// Hash function for pseudo-random values
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM (Fractal Brownian Motion)
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * vnoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

// FBM with fractional octaves
float fbmOctFloat(vec2 p, float oct) {
  float v = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= oct) break;
    v += amp * vnoise(p * freq);
    amp *= 0.5;
    freq *= 2.13;
  }
  return v;
}

// Curl noise for divergence-free fields
vec2 curlNoise(vec2 p) {
  float e = 0.1;
  float n1, n2;
  vec2 curl;
  
  n1 = vnoise(p + vec2(0, e));
  n2 = vnoise(p - vec2(0, e));
  curl.x = (n1 - n2) / (2.0 * e);
  
  n1 = vnoise(p + vec2(e, 0));
  n2 = vnoise(p - vec2(e, 0));
  curl.y = (n1 - n2) / (2.0 * e);
  
  return vec2(curl.x, -curl.y);
}

// Domain warping
vec2 domainWarp(vec2 p, float strength) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0), 4),
    fbm(p + vec2(5.2, 1.3), 4)
  );
  vec2 r = vec2(
    fbm(p + strength * q + vec2(1.7, 9.2), 4),
    fbm(p + strength * q + vec2(8.3, 2.8), 4)
  );
  return r;
}

// Chladni figure
float chladni(vec2 norm, float freq, int nsrc, vec2 sources[8]) {
  float f = freq * 3.14159265;
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= nsrc) break;
    s += cos(f * length(norm - sources[i]));
  }
  return s / float(nsrc);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

export const CHLADNI_SOURCES_MAX = 8;
