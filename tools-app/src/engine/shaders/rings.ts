// tools-app/src/engine/shaders/rings.ts
import { NOISE_GLSL } from './noise'

export const RINGS_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}
uniform vec2 u_res; uniform float u_time; uniform float u_count; uniform float u_thick; uniform float u_warp; uniform float u_speed;
in vec2 v_uv; out vec4 fragColor;
void main(){
  vec2 uv=(v_uv-0.5)*2.0;
  float r=length(uv);
  float t=u_time*u_speed;
  float w=fbm(uv*u_warp+t,3);
  float rings=sin((r+w*0.1)*u_count*10.0-t*2.0);
  float mask=smoothstep(u_thick,0.0,abs(rings));
  vec3 col=hsv2rgb(vec3(fract(r+t*0.05),0.8,mask));
  fragColor=vec4(col,1.0);
}
`;
