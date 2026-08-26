// tools-app/src/engine/shaders/brutalist.ts
import { NOISE_GLSL } from './noise'

export const BRUTALIST_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}
uniform vec2 u_res; uniform float u_time; uniform float u_grid; uniform float u_noise; uniform float u_speed;
in vec2 v_uv; out vec4 fragColor;
void main(){
  vec2 uv=v_uv;
  float t=u_time*u_speed;
  vec2 grid=floor(uv*u_grid)/u_grid;
  float n=vnoise(grid*50.0+t);
  float line=step(0.95,fract(uv.x*u_grid))*0.5+step(0.95,fract(uv.y*u_grid))*0.5;
  float v=n*u_noise+line;
  vec3 col=vec3(v>0.5?0.95:0.08);
  fragColor=vec4(col,1.0);
}
`;
