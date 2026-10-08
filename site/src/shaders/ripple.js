// Per-card ripple vertex shader (GLSL ES 3.0 for three@0.160.0)
export const vertexShader = `
  out vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

// Per-card ripple fragment shader — chromatic aberration + ripple on hover
export const fragmentShader = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uTimeRef;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uPlaneAspect;
  uniform float uImgAspect;
  in vec2 vUv;

  vec2 coverUv(vec2 uv){
    vec2 s = vec2(1.0);
    if (uImgAspect > uPlaneAspect) s.x = uPlaneAspect / uImgAspect;
    else s.y = uImgAspect / uPlaneAspect;
    return (uv - 0.5) * s + 0.5;
  }

  void main(){
    if (uHover < 0.005) {
      gl_FragColor = texture(uTex, coverUv(vUv));
      return;
    }
    float dt = uTime - uTimeRef;
    vec2 uv = vUv;
    vec2 toC = uv - uMouse;
    float d = length(toC * vec2(uPlaneAspect * 2.4, 2.4));
    float fall = 1.0 - smoothstep(0.16, 0.5, d);
    float ripple = sin(d * 9.0 - dt * 2.4) * (0.015 * uHover) * fall;
    vec2 dir = toC / (length(toC) + 1e-4);
    vec2 duv = uv + dir * ripple;
    float ca = 0.005 * uHover * clamp(1.0 - d, 0.0, 1.0);
    vec3 col;
    col.r = texture(uTex, coverUv(duv + vec2(ca, 0.0))).r;
    col.g = texture(uTex, coverUv(duv)).g;
    col.b = texture(uTex, coverUv(duv - vec2(ca, 0.0))).b;
    gl_FragColor = vec4(col, 1.0);
  }
`
