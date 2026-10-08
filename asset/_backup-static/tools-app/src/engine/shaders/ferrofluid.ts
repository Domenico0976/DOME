// tools-app/src/engine/shaders/ferrofluid.ts
import { NOISE_GLSL } from './noise'

export const FERROFLOW_ADVECT_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_audioLevel;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 vel = curlNoise(uv * 3.0 + u_time * 0.1) * u_speed * 0.01 * (1.0 + u_audioLevel * 0.5);
  vec4 col = texture(u_tex, uv - vel);
  fragColor = col;
}
`

export const FERROFLOW_THICKNESS_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_feed;
uniform float u_audioLevel;
uniform int u_attractors;
uniform float u_attractorSeed;
in vec2 v_uv;
out vec4 fragColor;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = v_uv;
  vec4 prev = texture(u_tex, uv);

  float feed = u_feed * (1.0 + u_audioLevel * 0.3);
  float blob = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= u_attractors) break;
    vec2 center = vec2(
      0.5 + 0.4 * sin(float(i) * 1.5 + u_time * 0.1 + hash(u_attractorSeed + float(i)) * 6.28),
      0.5 + 0.4 * cos(float(i) * 1.3 + u_time * 0.1 + hash(u_attractorSeed + float(i) * 2.7) * 6.28)
    );
    float d = length(uv - center);
    blob += feed * exp(-d * d * 40.0);
  }

  fragColor = vec4(prev.rgb + vec3(blob), 1.0);
}
`

export const FERROFLOW_RD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_feed;
uniform float u_kill;
uniform float u_da;
uniform float u_db;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 texel = 1.0 / u_res;
  
  vec4 center = texture(u_tex, uv);
  vec4 left = texture(u_tex, uv - vec2(texel.x, 0.0));
  vec4 right = texture(u_tex, uv + vec2(texel.x, 0.0));
  vec4 up = texture(u_tex, uv + vec2(0.0, texel.y));
  vec4 down = texture(u_tex, uv - vec2(0.0, texel.y));
  
  float a = center.r;
  float b = center.g;
  
  // Laplacian
  float lapA = (left.r + right.r + up.r + down.r) / 4.0 - a;
  float lapB = (left.g + right.g + up.g + down.g) / 4.0 - b;
  
  // Gray-Scott reaction-diffusion
  float ab2 = a * b * b;
  float na = a + u_da * lapA - ab2 + u_feed * (1.0 - a);
  float nb = b + u_db * lapB + ab2 - (u_kill + u_feed) * b;
  
  fragColor = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), center.b, 1.0);
}
`

export const FERROFLOW_RENDER_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_tex;
uniform vec3 u_accent;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec4 data = texture(u_tex, v_uv);
  float pattern = data.r - data.g;
  
  // Color mapping
  vec3 col = mix(vec3(0.0), u_accent, smoothstep(-0.2, 0.8, pattern));
  
  // Add highlights
  col += vec3(0.1) * smoothstep(0.7, 0.9, pattern);
  
  fragColor = vec4(col, 1.0);
}
`
