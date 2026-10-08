// GLSL ES 1.00 (three ShaderMaterial default): texture2D, attribute/varying.
// Per EFFECTS.md ground rule 8 — no implicit float->vec conversion, and every
// vec4 constructor must total exactly four components.

export const textVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vLocal;

  void main() {
    vUv = uv;
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const textFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uAnimMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uAlphaTest;
  uniform float uWobble;
  uniform float uTime;

  varying vec2 vUv;
  varying vec2 vLocal;

  // Flowing wash for '.accent-anim' segments: a soft pastel ramp from powder
  // blue to warm dark plum (mirrors the .accent-anim CSS gradient) scrolling
  // left -> right in a seamless 8 s loop. Every span gets its own phase + speed from spanId (the
  // gray level the atlas baked into the mask), so sibling spans drift out of
  // sync instead of marching in step. Desync never breaks the loop: the offset
  // is constant and each speed stays a whole number of pattern periods per
  // 8 s, so every span is individually periodic and the motion flows forever.
  // A fixed color satisfies p.x = 1.1 * (u0 + t * speed + off + n), which
  // grows with t: the pattern travels toward +x (right on screen). Blending is
  // linear across each band, like the CSS linear-gradient, so the two stay
  // visually in sync.
  vec3 accentStripe(float idx) {
    if (idx < 0.5) return vec3(0.718, 0.788, 0.902);
    else if (idx < 1.5) return vec3(0.675, 0.737, 0.878);
    else if (idx < 2.5) return vec3(0.655, 0.682, 0.855);
    else if (idx < 3.5) return vec3(0.635, 0.624, 0.824);
    else if (idx < 4.5) return vec3(0.608, 0.561, 0.800);
    else if (idx < 5.5) return vec3(0.557, 0.498, 0.753);
    else if (idx < 6.5) return vec3(0.486, 0.416, 0.659);
    else if (idx < 7.5) return vec3(0.408, 0.322, 0.498);
    else if (idx < 8.5) return vec3(0.325, 0.243, 0.388);
    return vec3(0.243, 0.173, 0.306);
  }

  vec3 accentGradient(vec2 p, float t, float spanId) {
    // 90deg: the ramp runs along +x, like the CSS gradient.
    float sp = fract(spanId * 0.6180339);
    float speed = 0.125 * (1.0 + float(int(sp * 2.0)));
    float u = fract(p.x / 1.1 - t * speed + sp);
    float g = u * 10.0;
    float i0 = floor(g);
    float f = g - i0;
    vec3 colA = accentStripe(i0);
    vec3 colB = accentStripe(mod(i0 + 1.0, 10.0));
    return mix(colA, colB, f);
  }

  void main() {
    vec2 sampleUv = vUv;

    // Rows behind the glass breathe slightly; rows in front stay rigid. Without
    // the difference the refracted layer reads as a rendering fault rather than
    // as glass.
    if (uWobble > 0.0) {
      float phase = fract(uTime * 0.15) * 6.2831853;
      sampleUv.x += sin(vLocal.y * 0.6 + phase) * 0.0018 * uWobble;
      sampleUv.y += cos(vLocal.x * 0.6 + phase) * 0.0018 * uWobble;
    }

    vec4 texel = texture2D(uMap, sampleUv);
    vec4 animSample = texture2D(uAnimMap, sampleUv);
    float anim = animSample.a;
    float alpha = texel.a * uOpacity;

    // This discard is what keeps a behind-row in the OPAQUE pass. A row drawn
    // with blending would sort into the transparent pass, which three runs after
    // the transmissive torus — the glass would then have nothing of it to
    // refract and the row would sit on top instead of behind.
    if (alpha < uAlphaTest) discard;

    // The atlas carries the real per-segment colors; uColor stays as the
    // legacy global tint for callers that still set it (harmless here because
    // the atlas already bakes it in).
    vec3 base = texel.rgb;
    if (anim > 0.01) {
      vec2 p = vLocal * vec2(2.2, 1.0);
      base = accentGradient(p, uTime, animSample.r * 255.0);
    }

    gl_FragColor = vec4(base, alpha);
  }
`
