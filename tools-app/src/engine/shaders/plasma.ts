// tools-app/src/engine/shaders/plasma.ts
import { NOISE_GLSL } from './noise'

export const PLASMA_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}
uniform vec2 u_res; uniform float u_time; uniform float u_scale; uniform float u_speed; uniform float u_colorShift;
in vec2 v_uv; out vec4 fragColor;
void main(){
  vec2 uv=v_uv;
  float t=u_time*u_speed;
  float v=sin(uv.x*u_scale+t)+sin(uv.y*u_scale+t)+sin((uv.x+uv.y)*u_scale*0.5+t);
  v*=0.5; v+=0.5;
  v+=fbm(uv*u_scale+t,3)*0.2;
  vec3 col=hsv2rgb(vec3(fract(v+u_colorShift+t*0.02),0.8,0.6));
  fragColor=vec4(col,1.0);
}
`;
