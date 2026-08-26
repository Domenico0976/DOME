// tools-app/src/engine/shaders/liquidmetal.ts
import { NOISE_GLSL } from './noise'

export const LIQUIDMETAL_SDF_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_morph;
uniform float u_blobs;
uniform float u_speed;
uniform float u_roughness;
in vec2 v_uv;
out vec4 fragColor;

// SDF sphere
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Smooth union
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// SDF scene with animated blobs
float scene(vec3 p, float time) {
  float d = 1e10;
  int n = int(u_blobs);
  
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec3 center = vec3(
      sin(time * 0.3 + fi * 2.1) * 0.5,
      cos(time * 0.4 + fi * 1.7) * 0.3,
      sin(time * 0.2 + fi * 3.1) * 0.4
    );
    float radius = 0.15 + 0.05 * sin(time + fi);
    d = opSmoothUnion(d, sdSphere(p - center, radius), u_morph);
  }
  
  return d;
}

// Normal estimation
vec3 getNormal(vec3 p, float time) {
  float eps = 0.01;
  return normalize(vec3(
    scene(p + vec3(eps, 0.0, 0.0), time) - scene(p - vec3(eps, 0.0, 0.0), time),
    scene(p + vec3(0.0, eps, 0.0), time) - scene(p - vec3(0.0, eps, 0.0), time),
    scene(p + vec3(0.0, 0.0, eps), time) - scene(p - vec3(0.0, 0.0, eps), time)
  ));
}

void main() {
  vec2 uv = v_uv * 2.0 - 1.0;
  float time = u_time * u_speed;
  
  // Camera
  vec3 ro = vec3(0.0, 0.0, 2.5);
  vec3 rd = normalize(vec3(uv, -1.5));
  
  // Raymarching
  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = scene(p, time);
    if (d < 0.001) {
      hit = true;
      break;
    }
    if (t > 5.0) break;
    t += d;
  }
  
  vec3 col = vec3(0.0);
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = getNormal(p, time);
    
    // Chrome/metallic shading
    vec3 light = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(n, light), 0.0);
    float spec = pow(max(dot(reflect(-light, n), -rd), 0.0), 32.0);
    
    // Fresnel
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    
    // Base color with noise
    float nv = vnoise(p.xy * 5.0 + time) * 0.3;
    vec3 base = mix(vec3(0.1, 0.2, 0.3), vec3(0.8, 0.9, 1.0), nv);
    
    col = base * (0.2 + diff * 0.6) + vec3(1.0) * spec * 0.8 + fresnel * 0.3;
  }
  
  fragColor = vec4(col, 1.0);
}
`
