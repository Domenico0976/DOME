// Hover dissolve reveal, ported from `istruction_AI/reveal-shader.tsx`.
//
// The template is an R3F/framer-motion component that cannot be installed here (none
// of those three are dependencies), so the GLSL is what came across. Two shaders, two
// meshes, ONE context per card — the gallery already spends six contexts and creating
// a second canvas per card is what previously triggered Chrome's context-loss storm.
//
// The split is what makes the user's "keep the ripple, but only on the revealed image"
// requirement expressible at all: the ripple's displacement is cursor-driven, so it can
// only apply to the layer under the cursor, and after the dissolve that is the back one.

export const dissolveVertexShader = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

// Shared cover-fit. Identical maths to the gallery's existing `coverUv` on purpose:
// the per-card `uAlign` values are not all [0.5, 0.5] (AlFly is [1, 0.7]), so a
// different crop on either layer would make the two drift against each other as the
// front erodes away.
const COVER_UV = `
  vec2 coverUv(vec2 uv, vec2 align){
    vec2 scale = vec2(1.0);
    if (uImgAspect > uPlaneAspect) {
      scale.x = uPlaneAspect / uImgAspect;
    } else {
      scale.y = uImgAspect / uPlaneAspect;
    }
    vec2 offset = (1.0 - scale) * align;
    return uv * scale + offset;
  }
`

// Sobel gradient of the source, used to light the dissolve front. Kept at the
// template's sampling density: the edge is the whole point of the effect, and a
// cheaper approximation reads as a flat band.
const SOBEL = `
  mat3 sobelX = mat3(-1.0, 0.0, 1.0, -2.0, 0.0, 2.0, -1.0, 0.0, 1.0);
  mat3 sobelY = mat3(-1.0, -2.0, -1.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0);
  float getLuminance(vec3 color){ return dot(color, vec3(0.299, 0.587, 0.114)); }
  float sobel(sampler2D tex, vec2 uv, vec2 texelSize){
    float gx = 0.0, gy = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec2 offset = vec2(float(i), float(j)) * texelSize;
        float lum = getLuminance(texture2D(tex, uv + offset).rgb);
        gx += lum * sobelX[i + 1][j + 1];
        gy += lum * sobelY[i + 1][j + 1];
      }
    }
    return sqrt(gx * gx + gy * gy);
  }
`

const FBM = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5, f = 1.0;
    for (int i = 0; i < 5; i++){ v += a * noise(p * f); a *= 0.5; f *= 2.0; }
    return v;
  }
`

// FRONT — the image that erodes away. Outputs alpha, so the back layer shows through
// where the erosion has passed. `uCenter` is a constant (0.5, 0.5): the user asked for
// the propagation to start at the centre, so the cursor is deliberately NOT wired to it.
export const dissolveFrontFragment = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform float uDissolve;
  uniform vec2 uCenter;
  uniform float uPlaneAspect;
  uniform float uImgAspect;
  uniform vec2 uAlign;
  uniform float uGrayscale;
  uniform float uEdgeIntensity;
  uniform float uEdgeBrightness;
  uniform float uPixelSize;
  uniform float uTime;
  uniform float uCAAmplitude;
  varying vec2 vUv;
  ${COVER_UV}
  ${SOBEL}
  ${FBM}
  void main(){
    vec2 coverUV = coverUv(vUv, uAlign);
    vec4 texColor = texture2D(uTex, coverUV);

    // Radial distance from the centre, aspect-corrected so the erosion stays circular
    // on a non-square card instead of stretching into an ellipse.
    vec2 centeredUv = vUv - uCenter;
    centeredUv.x *= uPlaneAspect;
    float dist = length(centeredUv);
    float angle = atan(centeredUv.y, centeredUv.x);

    // Pixel-grid erosion: blocchi quantizzati (griglia pixel) + deriva lenta uTime.
    // uPixelSize basso = pixel grandi e leggibili (24 ≈ 27px su 650px).
    vec2 pixUv = (vUv + vec2(uTime * 0.015, uTime * 0.01)) * uPixelSize;
    float pixHash = hash(floor(pixUv));
    float pixFbm = fbm(floor(pixUv) * 0.35) * 0.6;
    float blockNoise = (pixHash * 0.7 + pixFbm * 0.3) * 0.22;
    float angularNoise = fbm(vec2(angle * 5.0, 0.0)) * 0.12;
    float maxDist = length(vec2(uPlaneAspect * 0.5, 0.5));
    float normalizedDist = (dist + blockNoise + angularNoise) / maxDist;

    float threshold = uDissolve * 1.5;
    float dissolveMask = smoothstep(threshold - 0.03, threshold, normalizedDist);

    // Poster sempre in B&N: uGrayscale=1 fisso (il colore e' nel layer sottostante).
    float gray = getLuminance(texColor.rgb);
    vec3 base = mix(texColor.rgb, vec3(gray), uGrayscale);

    // Sobel LOCALE: texelSize reale piccolo, non 1.0/aspect (che campionava l'intera
    // texture e produceva i bordi bianchi orizzontali sporchi).
    float edge = clamp(pow(sobel(uTex, coverUV, vec2(1.0 / 512.0)), 0.7) * 1.2, 0.0, 1.0);
    vec3 finalColor = base + vec3(1.0) * edge * uEdgeIntensity * 0.6 * uEdgeBrightness;

    // Sparkle sulla fascia di sgretolamento: banda tra rimosso e non-ancora.
    float zoneWidth = 0.15 * (1.0 - uDissolve) + 0.02;
    float edgeZone = smoothstep(threshold - zoneWidth, threshold - zoneWidth + 0.04, normalizedDist)
                   * smoothstep(threshold + 0.02, threshold - 0.02, normalizedDist);
    // Edge-localized chromatic aberration: radial split around the aspect-
    // corrected centre, masked to the actively crumbling band only. Samples
    // the raw texture per channel so R/B fringes separate from the gray base.
    float caMask = smoothstep(threshold - zoneWidth, threshold - zoneWidth + 0.02, normalizedDist)
                   * smoothstep(threshold + 0.03, threshold - 0.01, normalizedDist);
    if (uCAAmplitude > 0.0001 && caMask > 0.001) {
      vec2 caDir = centeredUv / max(length(centeredUv), 1e-4);
      float ca = uCAAmplitude * caMask;
      finalColor.r = texture2D(uTex, coverUV + ca * caDir).r;
      finalColor.b = texture2D(uTex, coverUV - ca * caDir).b;
    }
    finalColor += vec3(hash(floor(vUv * uPixelSize * 4.0)) * edgeZone * 1.5 * uEdgeBrightness);

    gl_FragColor = vec4(finalColor, dissolveMask * texColor.a);
    #include <colorspace_fragment>
  }
`

// BACK — the image revealed underneath, and the ONLY place the existing ripple lives.
//
// The ripple block is the gallery's own, moved here verbatim (same falloff, same flow
// field, same chromatic aberration) with one change: every term is multiplied by
// `uRippleActive` instead of `uHover` alone. That uniform is the hover requirement —
// the effect is a property of the revealed layer, so it cannot act until the dissolve
// has actually uncovered it. `uDarkness` is the template's staging: the back layer is
// a dark silhouette while hidden and comes up to full as the front erodes, which stops
// the two images from simply cross-fading.
export const dissolveBackFragment = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uPlaneAspect;
  uniform float uImgAspect;
  uniform vec2 uAlign;
  uniform float uRippleActive;
  uniform float uDarkness;
  varying vec2 vUv;
  ${COVER_UV}
  void main(){
    vec2 coverUV = coverUv(vUv, uAlign);
    vec3 col = texture2D(uTex, coverUV).rgb;

    // NOT named "active": that is a reserved word in GLSL ES and using it here failed
    // fragment compilation outright, which took the whole back layer with it. The name
    // only has to be unlikely to collide with the reserved list, not descriptive.
    // (No backticks in this comment: it lives inside a JS template literal, and a
    // backtick here terminates the string and breaks the parse of the whole module.)
    float ripple = uHover * uRippleActive;
    if (ripple > 0.01) {
      float dt = uTime;
      vec2 toC = coverUV - uMouse;
      float d = length(toC * vec2(uPlaneAspect * 2.4, 2.4));
      float fall = 1.0 - smoothstep(0.05, 0.9, d);

      vec2 p = coverUV * 4.0 + dt * 0.3;
      float n1 = sin(p.x * 3.0 + dt) * cos(p.y * 2.0 - dt * 0.7);
      float n2 = sin(p.x * 1.5 - dt * 0.5) * cos(p.y * 3.0 + dt * 0.3);
      float n3 = sin((p.x + p.y) * 2.0 + dt * 0.8);
      vec2 flow = vec2(n1 - n2, n2 - n3) * fall * 0.008 * ripple;
      coverUV = clamp(coverUV + flow, 0.0, 1.0);

      float ca = 0.015 * ripple * clamp(1.0 - d, 0.0, 1.0);
      col.r = texture2D(uTex, coverUV + vec2(ca, 0.0)).r;
      col.g = texture2D(uTex, coverUV).g;
      col.b = texture2D(uTex, coverUV - vec2(ca, 0.0)).b;
    }

    // Colore pieno: l'immagine rivelata e' la STESSA ma a colori (no B&W).
    gl_FragColor = vec4(mix(col, vec3(0.0), uDarkness), 1.0);
    #include <colorspace_fragment>
  }
`
