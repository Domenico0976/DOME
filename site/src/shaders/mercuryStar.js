// Mercury star shader for the HeroStar component.
// V1 only — Approach C Phase 1. V2 pixel-cell logic must remain commented out.
//
// WHY VARYING vY: the star geometry supplies vY (normalized vertical position 0→1)
// to map the per-stop gradient to the star's apex-to-apex direction. This keeps
// the mercury pattern locked to the star's orientation and allows the morph/front
// sweep to travel from north to south without texture distortion.

export const vertexShader = `
  varying vec2 vUv;
  varying float vY;

  void main(){
    vUv = uv;
    vY = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const fragmentShader = `
  precision highp float;

  uniform float u_time;
  uniform float u_morph;
  uniform float u_front;

  uniform float u_speed;
  uniform float u_gradientAngle;
  uniform float u_scale;
  uniform float u_turbAmp;
  uniform float u_turbFreq;
  uniform float u_waveFreq;
  uniform float u_edgeDistance;
  uniform float u_reflection;
  uniform float u_contourStrength;

  uniform vec3 u_colA1;
  uniform vec3 u_colA2;
  uniform vec3 u_colA3;
  uniform vec3 u_colA4;
  uniform vec3 u_colB1;
  uniform vec3 u_colB2;
  uniform vec3 u_colB3;
  uniform vec3 u_colB4;

  varying vec2 vUv;
  varying float vY;

  float hash21(vec2 p){
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float vnoise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.y),
      f.y
    );
  }

  void main(){
    vec2 uv = vUv * 2.0 - 1.0;
    float morphOffset = u_morph * 0.15 * sin(u_time * 0.3);

    // Per-stop mix driven by vertical position vY and u_front sweep
    float m = smoothstep(u_front - 0.08, u_front + 0.08, vY);

    vec3 col1 = mix(u_colA1, u_colB1, m);
    vec3 col2 = mix(u_colA2, u_colB2, m);
    vec3 col3 = mix(u_colA3, u_colB3, m);
    vec3 col4 = mix(u_colA4, u_colB4, m);

    // Mercury turbolence and wave pipeline
    float t = u_time * u_speed + morphOffset;
    vec2 p = uv * u_scale + vec2(0.0, t * 0.01);
    p *= vec2(1.0, 1.1);

    float turb = vnoise(p * u_turbFreq + t);
    turb += 0.5 * vnoise(p * u_turbFreq * 2.0 - t);
    turb *= u_turbAmp;

    float wave = sin((p.x + p.y) * u_waveFreq + t * 0.7) * 0.5 + 0.5;
    wave *= smoothstep(0.0, 1.0, vY);

    // Gradient angle tilt
    float angleRad = radians(u_gradientAngle);
    vec2 tilted = vec2(
      p.x * cos(angleRad) - p.y * sin(angleRad),
      p.x * sin(angleRad) + p.y * cos(angleRad)
    );
    float grad = sin(tilted.x * 3.0 + t) * 0.5 + 0.5;

    vec3 baseColor = col1;
    baseColor = mix(baseColor, col2, smoothstep(0.25, 0.35, vY + turb * 0.1 + grad * 0.1));
    baseColor = mix(baseColor, col3, smoothstep(0.55, 0.65, vY * 0.8 + wave * 0.1 - grad * 0.05));
    baseColor = mix(baseColor, col4, smoothstep(0.75, 0.85, vY - turb * 0.05 + grad * 0.05));

    // Reflection highlights
    float refl = pow(max(0.0, dot(normalize(uv), normalize(vec2(0.0, 1.0)))), 2.0);
    refl *= u_reflection;
    vec3 reflected = mix(baseColor, vec3(1.0), refl * wave);

    // Fascia scura ad anello (valli/zona bevel, non le punte): la silhouette la da la geometria,
    // qui ricreiamo l'ink-edge del reference con le punte che restano luminose (lame).
    float d = length(uv);
    float ring = smoothstep(0.40, 0.62, d) * (1.0 - smoothstep(0.82, 0.98, d));
    vec3 edged = mix(reflected, reflected * (1.0 - u_contourStrength * 0.9), ring);

    vec3 color = edged;

    // Alpha 1: la forma stella la da la geometria estrusa, lo sfondo trasparente dal renderer.
    // (Un alpha radiale spegnerebbe le punte: era il bug che rendeva la stella invisibile.)
    float alpha = 1.0;

    gl_FragColor = vec4(color, alpha);

    // V2 cells placeholder — DO NOT ENABLE
    // float cellHash = hash21(floor(vUv * 64.0) + u_time);
    // vec3 cellColor = mix(color, vec3(0.0), cellHash * 0.1);
  }
`
