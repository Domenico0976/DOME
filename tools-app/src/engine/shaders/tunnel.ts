// tools-app/src/engine/shaders/tunnel.ts
import { NOISE_GLSL } from './noise'

export const TUNNEL_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}
uniform vec2 u_res; uniform float u_time; uniform float u_speed; uniform float u_twist; uniform float u_density;
in vec2 v_uv; out vec4 fragColor;
void main(){
  vec2 uv=(v_uv-0.5)*2.0;
  float a=atan(uv.y,uv.x);
  float r=length(uv);
  float t=u_time*u_speed;
  float v=fbm(vec2(a*u_twist+t,r*5.0-t),4);
  float ring=sin(r*20.0-t*2.0+v);
  vec3 col=hsv2rgb(vec3(fract(v+t*0.05),0.7,smoothstep(0.0,1.0,ring)*u_density));
  fragColor=vec4(col,1.0);
}
`;
