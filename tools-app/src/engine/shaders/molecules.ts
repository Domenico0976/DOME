// tools-app/src/engine/shaders/molecules.ts
import { NOISE_GLSL } from './noise'

export const MOLECULES_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}
uniform vec2 u_res; uniform float u_time; uniform float u_count; uniform float u_speed; uniform float u_radius;
in vec2 v_uv; out vec4 fragColor;
void main(){
  vec2 uv=v_uv;
  float t=u_time*u_speed;
  float density=0.0;
  int n=int(u_count);
  for(int i=0;i<16;i++){
    if(i>=n) break;
    float fi=float(i);
    vec2 center=vec2(0.5+0.3*sin(t+fi*2.1),0.5+0.3*cos(t*0.7+fi*1.5));
    float d=length(uv-center);
    density+=smoothstep(u_radius,0.0,d);
  }
  vec3 col=hsv2rgb(vec3(fract(density+t*0.02),0.7,clamp(density,0.0,1.0)));
  fragColor=vec4(col,1.0);
}
`;
