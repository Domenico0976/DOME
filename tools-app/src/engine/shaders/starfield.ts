// tools-app/src/engine/shaders/starfield.ts
import { NOISE_GLSL } from './noise'

export const STARFIELD_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}
uniform vec2 u_res; uniform float u_time; uniform float u_speed; uniform float u_density; uniform float u_zoom;
in vec2 v_uv; out vec4 fragColor;
float star(vec2 p){
  float d=length(fract(p)-0.5);
  return smoothstep(0.03,0.0,d);
}
void main(){
  vec2 uv=v_uv;
  float t=u_time*u_speed;
  vec2 p=uv*u_zoom+vec2(t*0.1,t*0.05);
  float n=vnoise(p*3.0);
  float s=star(p+n*0.2);
  vec3 col=vec3(s)*(0.8+n*0.4)+vec3(0.02,0.03,0.08);
  fragColor=vec4(col*u_density,1.0);
}
`;
