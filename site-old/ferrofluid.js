import{ak as st,r as R,Q as ct,bo as ut,cp as Ue,d as ft,cq as Le,cr as lt,cs as dt,ct as mt,cu as _e,cv as Pe,cw as ht,cx as pt,cy as Ke,cz as qe,cA as pe,cB as xt,q as c,Y as Tt,cC as vt,cD as gt,cE as ye,cF as St,bx as Rt,cG as Et,cH as Ct,cI as bt,cJ as yt,S as $e,G as Ut,H as Mt,cK as wt,cL as Dt,cM as At,cN as Ft,cO as Nt}from"./index-CN-691Z9.js";import{C as kt,u as Lt,a as _t}from"./ControlsEffectsTabs-Dzh_Y3Uo.js";import{T as Pt}from"./ToolControlsDrawerPanel-CT3VRW7t.js";import{a as Ze}from"./ColorPicker-CiEMejDG.js";import"./BlockOpacitySlider-yaLZ_wDg.js";import"./Star.es-DFdc5VZK.js";const It=512,Xt=5,Ie=1.17,Vt=.156,Xe=.104,Ve=.02+17/100*.12,le=.4,Be=.3,je=2,de=`#version 300 es
layout(location=0) in vec2 pos;
out vec2 vUV;
void main() {
  vUV = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`,Bt=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFlow;
uniform vec2      uTexel;
uniform float     uDiffuse;
uniform float     uAspectYX;
uniform int       uConeCount;
uniform vec4      uCones[15]; // xy=pos zw=vel
uniform float     uConeRadius;
uniform float     uSplatScale;
out vec4 fragFlow;

void main() {
  vec2 flow = texture(uFlow, vUV).rg;

  // 4-neighbour diffusion
  vec2 avg = (
    texture(uFlow, vUV + vec2(uTexel.x, 0.0)).rg +
    texture(uFlow, vUV - vec2(uTexel.x, 0.0)).rg +
    texture(uFlow, vUV + vec2(0.0, uTexel.y)).rg +
    texture(uFlow, vUV - vec2(0.0, uTexel.y)).rg
  ) * 0.25;
  flow = mix(flow, avg, uDiffuse);

  // Decay (constant 1.0 — flow persists, trails fade via diffusion)
  // flow *= 1.0; // identity

  // Cone velocity splats
  float splatR = uConeRadius * 0.25 * uSplatScale;
  float sr2 = splatR * splatR;
  for (int i = 0; i < 15; i++) {
    if (i >= uConeCount) break;
    vec2 coneUV  = uCones[i].xy;
    vec2 coneVel = uCones[i].zw;
    float speed  = length(coneVel);
    if (speed < 0.0001) continue;
    vec2  d  = vUV - coneUV;
    d.y *= uAspectYX;
    float d2 = dot(d, d);
    if (d2 < sr2 * 9.0) {
      float w = exp(-d2 / (2.0 * sr2));
      flow = mix(flow, coneVel / speed, w);
    }
  }

  fragFlow = vec4(flow, 0.0, 1.0);
}`,jt=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uThick;
uniform vec2      uTexel;
uniform float     uDecay;
uniform float     uDiffuse;
uniform int       uConeCount;
uniform vec4      uCones[15]; // xy=pos zw=vel
uniform float     uConeRadius;
uniform float     uConeEmit;
uniform float     uConeFalloff;
uniform float     uTrailHeight;
uniform float     uTipShape;
uniform float     uAspectYX;
out vec4 fragThick;

void main() {
  float thick = texture(uThick, vUV).r;

  // 4-neighbour diffusion
  float avg = (
    texture(uThick, vUV + vec2(uTexel.x, 0.0)).r +
    texture(uThick, vUV - vec2(uTexel.x, 0.0)).r +
    texture(uThick, vUV + vec2(0.0, uTexel.y)).r +
    texture(uThick, vUV - vec2(0.0, uTexel.y)).r
  ) * 0.25;
  thick = mix(thick, avg, uDiffuse);
  thick *= uDecay;

  // Keep a minimum background thickness everywhere so the RD shader always
  // has enough "material" for Da=~0.14 → labyrinth patterns across the whole canvas.
  thick = max(thick, 0.15);

  // Cone emission — max-based (keeps clean normals and body shape)
  float coneMap    = 0.0;
  float wideConeMap = 0.0;
  for (int i = 0; i < 15; i++) {
    if (i >= uConeCount) break;
    vec2  d    = vUV - uCones[i].xy;
    d.y *= uAspectYX;
    float dist = length(d);
    float t    = clamp(1.0 - dist / uConeRadius, 0.0, 1.0);
    float h    = uConeEmit * pow(t, uTipShape);
    // Trail extends to 3.2× radius — much wider wake behind each cone
    float trail = uTrailHeight * pow(max(1.0 - dist / (uConeRadius * 3.2), 0.0), uConeFalloff);
    h = max(h, trail);
    thick       = max(thick, h);
    coneMap     = max(coneMap, uConeEmit * t);
    wideConeMap = max(wideConeMap, max(1.0 - dist / (uConeRadius * 2.2), 0.0));
  }

  fragThick = vec4(thick, coneMap, wideConeMap, 1.0);
}`,Gt=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uState;
uniform sampler2D uThick;
uniform sampler2D uFlow;
uniform sampler2D uNoise;
uniform vec2  uTexel;
uniform float uF, uK, uFCenter, uKCenter;
uniform float uDaMin, uDaMax, uDbRatio;
uniform float uAniso;
uniform float uGridScale;
uniform float uScaleClamp, uDecayWidth;
uniform float uFNoise, uKNoise, uFKRamp;
uniform float uConeDaBoost;
uniform float uConeEmit;
uniform float uEdgeCut;
uniform float uSwarmSpeed;
uniform float uSeedStr;
uniform float uSeedThr;
uniform float uSeedSpd;
uniform float uConeSpeed;
uniform float uSeedScale;
uniform float uAdvect;
uniform float uAdvDecay;
uniform float uTime;
uniform float uSimSpeed;
// Spatial-step compensation = SIM / SIM_REFERENCE. The RD constants above were
// tuned at SIM_REFERENCE; at a different SIM, uTexel (1/SIM) alone would shrink
// the neighbour-sampling step and make the labyrinth pattern finer/coarser
// purely from the quality tier. Scaling the spatial step (not dt) by this
// keeps the absolute pattern feature size constant across tiers.
uniform float uResScale;
out vec2 fragColor;

float thickScale;

vec3 flowTensor(vec2 pos) {
  float thick = min(texture(uThick, pos).r * thickScale, 1.0);
  float Da = mix(uDaMin, uDaMax, thick);
  vec2  flowVec  = texture(uFlow, pos).rg;
  float flowMag  = length(flowVec);
  float noiseAngle = texture(uNoise, pos * 2.0 + vec2(uTime * 0.02, uTime * 0.013)).r * 3.14159;
  vec2  noiseDir = vec2(cos(noiseAngle), sin(noiseAngle));
  float flowBlend = min(flowMag * 10.0, 1.0);
  vec2  flowDir  = (flowMag > 0.001) ? flowVec / flowMag : noiseDir;
  vec2  baseDir  = mix(noiseDir, flowDir, flowBlend);
  vec2  dir      = vec2(-baseDir.y, baseDir.x);
  float ratio    = uAniso;
  return Da * vec3(
    ratio * dir.x*dir.x + dir.y*dir.y,
    ratio * dir.y*dir.y + dir.x*dir.x,
    (ratio - 1.0) * dir.x * dir.y
  );
}

void main() {
  vec2 st = vUV;
  thickScale = 1.0 / uConeEmit;

  vec4  thickSample4       = texture(uThick, st);
  float rawThick           = thickSample4.r;
  // No early exit — RD runs on the whole canvas so patterns fill the frame.

  vec2  c    = texture(uState, st).rg;
  float a    = c.r;
  float b    = c.g;
  float thick              = min(rawThick * thickScale, 1.0);
  float coneMap            = thickSample4.g;
  // Wide exclusion influence — computed fresh each frame in thick shader (B channel).
  // 1.0 at cone center, linear to 0 at 2.2× coneRadius.
  float wideConeInfluence  = thickSample4.b;

  float nPert = texture(uNoise, st + vec2(uTime * 0.01, uTime * 0.007)).r;
  float tClamped = min(thick, 0.85);
  float fkT = pow(tClamped, uFKRamp);
  float F = mix(uF, uFCenter, fkT) + nPert * uFNoise;
  float K = mix(uK, uKCenter, fkT) + nPert * uKNoise;

  float gridScale = mix(1.0, uGridScale, thick);
  float dt  = uSimSpeed / (gridScale * gridScale);
  vec2 ddx  = vec2(uTexel.x, 0.0) * gridScale * uResScale;
  vec2 ddy  = vec2(0.0, uTexel.y) * gridScale * uResScale;

  vec2 nE  = texture(uState, st + ddx).rg;
  vec2 nW  = texture(uState, st - ddx).rg;
  vec2 nN  = texture(uState, st + ddy).rg;
  vec2 nS  = texture(uState, st - ddy).rg;
  vec2 nNE = texture(uState, st + ddx + ddy).rg;
  vec2 nNW = texture(uState, st - ddx + ddy).rg;
  vec2 nSE = texture(uState, st + ddx - ddy).rg;
  vec2 nSW = texture(uState, st - ddx - ddy).rg;

  vec3 tE = flowTensor(st + ddx * 0.5);
  vec3 tW = flowTensor(st - ddx * 0.5);
  vec3 tN = flowTensor(st + ddy * 0.5);
  vec3 tS = flowTensor(st - ddy * 0.5);

  vec2 ab = vec2(a, b);
  vec2 fx_E = tE.x * (nE - ab) + tE.z * (nN - nS + nNE - nSE) * 0.25;
  vec2 fx_W = tW.x * (ab - nW) + tW.z * (nNW - nSW + nN - nS) * 0.25;
  vec2 fy_N = tN.z * (nNE - nNW + nE - nW) * 0.25 + tN.y * (nN - ab);
  vec2 fy_S = tS.z * (nE - nW + nSE - nSW) * 0.25 + tS.y * (ab - nS);
  vec2 diff = (fx_E - fx_W) + (fy_N - fy_S);

  vec2 thNeighE = texture(uThick, vUV + vec2(uTexel.x, 0.0)).rg;
  vec2 thNeighW = texture(uThick, vUV - vec2(uTexel.x, 0.0)).rg;
  vec2 thNeighN = texture(uThick, vUV + vec2(0.0, uTexel.y)).rg;
  vec2 thNeighS = texture(uThick, vUV - vec2(0.0, uTexel.y)).rg;

  float edgeAmt = 1.0 - smoothstep(uEdgeCut * 0.3, uEdgeCut, thick);
  diff *= 1.0 - edgeAmt * 0.95;
  K    += edgeAmt * 0.1;

  vec2  thGrad   = vec2(thNeighE.r - thNeighW.r, thNeighN.r - thNeighS.r) * 0.5 * thickScale;
  float tGradLen = length(thGrad);
  if (edgeAmt > 0.01 && tGradLen > 0.001) {
    vec2  rd    = thGrad / tGradLen;
    vec2  lapX  = nE + nW - 2.0 * ab;
    vec2  lapY  = nN + nS - 2.0 * ab;
    vec2  lapXY = (nNE - nNW - nSE + nSW) * 0.25;
    vec2  radLap = lapX * rd.x*rd.x + lapY * rd.y*rd.y + 2.0 * lapXY * rd.x*rd.y;
    float Da    = mix(uDaMin, uDaMax, thick);
    diff += edgeAmt * Da * 2.0 * radLap;
  }

  float gradX  = (thNeighE.g - thNeighW.g) * 0.5;
  float gradY  = (thNeighN.g - thNeighS.g) * 0.5;
  float ringAmt   = min(length(vec2(gradX, gradY)) * 8.0 / uConeEmit, 1.0);
  float centerAmt = min(coneMap / uConeEmit, 1.0);

  diff *= 1.0 - centerAmt * 0.8;
  K    += centerAmt * uConeDaBoost * 0.03;
  diff += ringAmt * uConeDaBoost * 0.1 * (nE + nW + nN + nS - 4.0 * ab);
  K    += ringAmt * uConeDaBoost * 0.02;

  // ── Wide exclusion zone: organic pattern suppression ─────────────────────
  // wideConeInfluence covers 0→2.2× coneRadius (B channel of thick FBO, computed
  // fresh each frame). A strong K boost here pushes the system well above the
  // pattern-formation threshold — B genuinely cannot self-sustain, so the
  // pattern stops growing organically rather than being visually cropped.
  // Quadratic keeps it sharp near center, fades naturally near the boundary.
  float wi2 = wideConeInfluence * wideConeInfluence;
  K += wi2 * 0.22;  // e.g. at cone center: K≈0.28 → B decays in ~3 steps

  float abb = a * b * b;
  float na  = a + dt * (diff.x - abb + F * (1.0 - a));
  float nb  = b + dt * (uDbRatio * diff.y + abb - (F + K) * b);

  // ── Cone body direct suppression (inner coneRadius zone) ─────────────────
  // Belt-and-suspenders: directly drive B→0 inside the cone peak so even
  // freshly seeded B (from the FBM init) clears within a few frames.
  float coneClear = centerAmt * centerAmt;
  nb  = nb  * (1.0 - coneClear * 0.40);
  na  = mix(na, 1.0, coneClear * 0.25);

  if (uAdvect > 0.0) {
    vec2 flowVec = texture(uFlow, st).rg;
    float n1 = texture(uNoise, st * 4.0 + vec2(uTime * 0.015, 0.0)).r;
    float n2 = texture(uNoise, st * 4.0 + vec2(0.0, uTime * 0.012)).r;
    vec2  noiseFlow = vec2(n1, n2) * 0.15;
    float flowStr   = length(flowVec);
    float noiseMix  = 1.0 - min(flowStr * 10.0, 1.0);
    float pertAngle = (n1 - 0.5) * 1.5;
    float cs = cos(pertAngle), sn = sin(pertAngle);
    vec2  pertFlow  = vec2(flowVec.x*cs - flowVec.y*sn, flowVec.x*sn + flowVec.y*cs);
    vec2  totalFlow = pertFlow + noiseFlow * noiseMix;
    vec2  gradA     = vec2(nE.r - nW.r, nN.r - nS.r) * 0.5;
    vec2  gradB     = vec2(nE.g - nW.g, nN.g - nS.g) * 0.5;
    float bGradMag  = length(gradB);
    float patternAmt = smoothstep(0.0, 0.05, bGradMag);
    float advStr    = uAdvect * uSimSpeed * (1.0 - patternAmt * uAdvDecay);
    na -= advStr * dot(totalFlow, gradA);
    nb -= advStr * dot(totalFlow, gradB);
  }

  float decayT    = smoothstep(uScaleClamp, uScaleClamp + uDecayWidth, gridScale);
  float decayRate = 0.02 * decayT * uSimSpeed;
  na = mix(na, 1.0, decayRate);
  nb = nb * (1.0 - decayRate);

  if (uSeedStr > 0.0) {
    // Seed everywhere (not just under cones) so patterns fill the whole canvas.
    float vacancy     = smoothstep(0.20, 0.0, nb);
    float seedNoise   = texture(uNoise, st * uSeedScale).r;
    float spatialMask = step(uSeedThr, seedNoise);
    float seedAmt     = uSeedStr * uSimSpeed * vacancy * spatialMask;
    na -= seedAmt;
    nb += seedAmt;
  }

  fragColor = vec2(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0));
}`,Wt=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uThick;
uniform sampler2D uRDState;
uniform vec2  uTexel;
uniform int   uConeCount;
uniform vec2  uConePos[15];
uniform float uConeRadius;
uniform float uAspectYX;
uniform float uFluidRim;
uniform float uFluidRimPow;
uniform float uNrmStr;
uniform float uFluidRough;
uniform float uFluidF0;
uniform float uTime;
// ── Color mode ────────────────────────────────────────────────────────────────
// uColorMode: 0 = automated (cycling palette), 1 = monotone
uniform int   uColorMode;
uniform int   uPaletteCount;     // number of active colors in automated mode (2-4)
uniform vec3  uPaletteColors[4]; // linear-RGB palette (sRGB→linear converted in JS)
uniform vec3  uMonoColor;        // linear-RGB monotone color
uniform float uColorSpeed;       // time-scale multiplier for palette cycling
uniform float uRdThLo;
uniform float uRdThHi;
uniform float uRdSharpen;
const float RD_GAMMA   = 0.60;
const float RD_RING_STR = 0.85;
const float RD_RING_W   = 9.00;
const float RD_RING_TH  = 0.35;
out vec4 fragColor;

const float PI = 3.14159265;

float ggxD(float NdotH, float a2) {
  float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
float ggxG1(float NdotX, float k) { return NdotX / (NdotX * (1.0 - k) + k); }
float ggxG(float NdotV, float NdotL, float r) {
  float k = (r + 1.0) * (r + 1.0) / 8.0;
  return ggxG1(NdotV, k) * ggxG1(NdotL, k);
}
float fresnel(float cosT, float F0) { return F0 + (1.0 - F0) * pow(max(1.0 - cosT, 0.0), 5.0); }

void main() {
  vec2  fUV = vUV;                   // field UV = screen UV (top-down, no camera)
  vec3  V   = vec3(0.0, 1.0, 0.0);  // view direction straight down

  // ── Thickness-based surface normals (gives 3D bump to organism body) ──────
  float thick = texture(uThick, fUV).r;
  float tL = texture(uThick, fUV - vec2(uTexel.x, 0.0)).r;
  float tR = texture(uThick, fUV + vec2(uTexel.x, 0.0)).r;
  float tD = texture(uThick, fUV - vec2(0.0, uTexel.y)).r;
  float tU = texture(uThick, fUV + vec2(0.0, uTexel.y)).r;
  vec3 N = normalize(vec3((tL - tR) * uNrmStr, 1.0, (tD - tU) * uNrmStr));

  // Tilt cone peaks radially — makes body peaks lean outward like 3-D mounds
  for (int i = 0; i < 15; i++) {
    if (i >= uConeCount) break;
    vec2  cd    = fUV - uConePos[i];
    cd.y *= uAspectYX;
    float tiltM = smoothstep(uConeRadius * 1.5, 0.0, length(cd));
    if (tiltM > 0.0) {
      vec2  radial = uConePos[i] - vec2(0.5);
      float rl = length(radial);
      if (rl > 0.001) {
        radial /= rl;
        N.x += radial.x * tiltM * 0.6;
        N.z += radial.y * tiltM * 0.6;
      }
    }
  }
  N = normalize(N);

  // ── RD pattern (displayed on the whole canvas) ────────────────────────────
  float rdB   = texture(uRDState, fUV).g;
  float rdPat = smoothstep(uRdThLo, uRdThHi, rdB);
  rdPat = pow(rdPat, RD_GAMMA);

  // Sigmoid sharpening
  float sk  = 1.0 + uRdSharpen * 30.0;
  float ss0 = 1.0 / (1.0 + exp(sk * 0.5));
  float ss1 = 1.0 / (1.0 + exp(-sk * 0.5));
  rdPat = (1.0 / (1.0 + exp(-sk * (rdPat - 0.5))) - ss0) / (ss1 - ss0);

  // Metaball field — sum Gaussian from every cone once; reused for both
  // the dark void interior and the ring outline so both merge in sync.
  float rdThr   = RD_RING_W * 0.1;   // 0.9  — ring centre threshold
  float rdHW    = RD_RING_TH * 0.5;  // 0.175 — ring half-width
  float totalCf = 0.0;
  for (int i = 0; i < 15; i++) {
    if (i >= uConeCount) break;
    vec2 cd2 = fUV - uConePos[i];
    cd2.y *= uAspectYX;
    totalCf += 1.5 * exp(-dot(cd2, cd2) / (2.0 * uConeRadius * uConeRadius));
  }

  // Void suppression: dark wherever the metaball field exceeds ~60 % of rdThr.
  // This fills the interior of each cone AND the bridge between merged cones —
  // the same isosurface that drives the ring, so void and ring always agree.
  // Thickness-based suppression handles the 3-D body/trail wakes on top.
  float thickAboveBg = smoothstep(0.17, 0.38, thick);
  float metaBlobVoid = smoothstep(rdThr * 0.55, rdThr * 0.95, totalCf);
  rdPat *= (1.0 - max(thickAboveBg, metaBlobVoid) * 0.92);

  // Ring overlay — merged outline wraps around combined blob shape.
  float ringOverlay = smoothstep(rdThr - rdHW - rdHW * 0.3, rdThr - rdHW, totalCf)
                    * (1.0 - smoothstep(rdThr + rdHW, rdThr + rdHW + rdHW * 0.3, totalCf));
  rdPat = mix(rdPat, 1.0, ringOverlay * RD_RING_STR);

  // Ridge colour — either user-defined cycling palette or monotone
  vec3 ridgeCol;
  if (uColorMode == 1) {
    // Monotone: single user color
    ridgeCol = uMonoColor;
  } else {
    // Automated: cycle through user palette (2-min hold + 30-s crossfade per color)
    float holdSec = 120.0, transSec = 30.0, stepSec = holdSec + transSec;
    float nf      = float(uPaletteCount);
    float phase   = mod(uTime * uColorSpeed, stepSec * nf);
    int   ci      = int(floor(phase / stepSec));
    int   ci1     = (ci + 1) % uPaletteCount;
    float within  = phase - float(ci) * stepSec;
    float ct      = clamp((within - holdSec) / transSec, 0.0, 1.0);
    ct = ct * ct * (3.0 - 2.0 * ct);
    ridgeCol      = mix(uPaletteColors[ci], uPaletteColors[ci1], ct);
  }

  // Pattern color: dark base + ridge color
  vec3 baseCol = mix(vec3(0.0), ridgeCol, rdPat);

  // ── GGX PBR lighting (normals from thickness give body its 3-D look) ──────
  vec3  L       = normalize(vec3(0.4, 1.0, 0.35));
  vec3  H       = normalize(L + V);
  float NdotL   = max(dot(N, L), 0.0);
  float NdotV   = max(dot(N, V), 0.001);
  float NdotH   = max(dot(N, H), 0.0);
  float VdotH   = max(dot(V, H), 0.0);
  float a2      = pow(uFluidRough, 4.0);
  float spec    = ggxD(NdotH, a2) * ggxG(NdotV, NdotL, uFluidRough) * fresnel(VdotH, uFluidF0)
                  / (4.0 * NdotV * NdotL + 0.001);

  vec3  Lcol = vec3(1.0, 0.96, 0.90) * 2.5;

  // Shading: flat-lit in the background (normal = up), 3-D shaded under body bumps
  vec3 col = baseCol * NdotL + vec3(spec) * Lcol * NdotL;

  // Rim light: bright at steep normal edges (body silhouette)
  float rim = pow(1.0 - NdotV, uFluidRimPow);
  col += vec3(0.35, 0.30, 0.25) * rim * uFluidRim;

  // Vignette
  vec2  vig     = (vUV - 0.5) * vec2(1.0, uAspectYX);
  col *= 1.0 - 0.70 * smoothstep(0.15, 0.60, length(vig));

  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  fragColor = vec4(col, 1.0);
}`;function Ge(t,l,r){const d=t.createShader(l);return t.shaderSource(d,r),t.compileShader(d),t.getShaderParameter(d,t.COMPILE_STATUS)||console.error("[Ferrofluid] shader compile error:",t.getShaderInfoLog(d),`

Source:
`,r.slice(0,400)),d}function me(t,l,r){const d=t.createProgram();return t.attachShader(d,Ge(t,t.VERTEX_SHADER,l)),t.attachShader(d,Ge(t,t.FRAGMENT_SHADER,r)),t.linkProgram(d),t.getProgramParameter(d,t.LINK_STATUS)||console.error("[Ferrofluid] link error:",t.getProgramInfoLog(d)),d}function J(t,l,r,d=t.RGBA32F,a=t.RGBA,i=t.FLOAT,p=t.LINEAR){const x=t.createTexture();t.bindTexture(t.TEXTURE_2D,x),t.texImage2D(t.TEXTURE_2D,0,d,l,r,0,a,i,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,p),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,p),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT);const T=t.createFramebuffer();return t.bindFramebuffer(t.FRAMEBUFFER,T),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,x,0),t.bindFramebuffer(t.FRAMEBUFFER,null),{tex:x,fbo:T}}function Ht(t){const r=new Uint8Array(262144);for(let a=0;a<256*256;a++)r[a*4+0]=Math.floor(Math.random()*256),r[a*4+1]=Math.floor(Math.random()*256),r[a*4+2]=Math.floor(Math.random()*256),r[a*4+3]=255;const d=t.createTexture();return t.bindTexture(t.TEXTURE_2D,d),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,256,256,0,t.RGBA,t.UNSIGNED_BYTE,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT),t.bindTexture(t.TEXTURE_2D,null),d}function We(t){const l=parseInt(t.slice(1,3),16)/255,r=parseInt(t.slice(3,5),16)/255,d=parseInt(t.slice(5,7),16)/255,a=i=>i<=.04045?i/12.92:Math.pow((i+.055)/1.055,2.4);return[a(l),a(r),a(d)]}function Ot(t,l){const r=pe(l),d=[];for(let a=0;a<t;a++){const i=a/Math.max(t,1)*Math.PI*2;d.push({px:.5+Math.cos(i)*r,py:.5+Math.sin(i)*r,vx:0,vy:0})}return d}function he(t,l,r,d,a=.5,i=.5){if(t===0)return[];const p=Et(d,r()),x=d*1.1,T=l%6,v=[];switch(T){case 0:{for(let s=0;s<t;s++){const u=s/t*Math.PI*2+r()*.25;v.push({x:a+p*Math.cos(u),y:i+p*Math.sin(u)})}break}case 1:{const s=Math.min(2,t);for(let o=0;o<s;o++){const m=o*Math.PI+r()*.4;v.push({x:a+x*Math.cos(m),y:i+x*Math.sin(m)})}const u=t-s;for(let o=0;o<u;o++){const m=o/Math.max(u,1)*Math.PI*2+r()*.3;v.push({x:a+p*Math.cos(m),y:i+p*Math.sin(m)})}break}case 2:{for(let s=0;s<t;s++){const u=s/t*Math.PI*2;v.push({x:a+x*Math.cos(u),y:i+x*Math.sin(u)})}break}case 3:{const s=Math.floor(t/2),u=r()*Math.PI*2,o=u+Math.PI,m=p*.55;for(let C=0;C<s;C++){const N=C/Math.max(s,1)*Math.PI*.7+u-.35;v.push({x:a+m*Math.cos(N),y:i+m*Math.sin(N)})}for(let C=s;C<t;C++){const N=(C-s)/Math.max(t-s,1)*Math.PI*.7+o-.35;v.push({x:a+m*Math.cos(N),y:i+m*Math.sin(N)})}break}case 4:{const s=Math.max(t-1,1);for(let u=0;u<s;u++){const o=u/s*Math.PI*2+r()*.2;v.push({x:a+p*Math.cos(o),y:i+p*Math.sin(o)})}if(t>1){const u=r()*Math.PI*2;v.push({x:a+x*.5*Math.cos(u),y:i+x*.5*Math.sin(u)})}break}default:for(let s=0;s<t;s++){const u=s/t*Math.PI*2+r()*.8,o=p*(.4+r()*.8);v.push({x:a+o*Math.cos(u),y:i+o*Math.sin(u)})}}for(;v.length<t;){const s=r()*Math.PI*2;v.push({x:a+p*Math.cos(s),y:i+p*Math.sin(s)})}return v.slice(0,t)}function zt(t,l,r,d){const a=Math.min(l,.033),i=t.length;if(i===0)return;const p=12,x=r*3,T=r*1,v=.9,s=.12;for(let u=0;u<i;u++){const o=t[u],m=d[u]??{x:.5,y:.5};o.vx+=(m.x-o.px)*p*a,o.vy+=(m.y-o.py)*p*a;for(let A=0;A<i;A++){if(A===u)continue;const V=o.px-t[A].px,B=o.py-t[A].py,F=Math.sqrt(V*V+B*B);if(F<x&&F>1e-5){let _;F<T?(_=.25*a/Math.max(F*F*F,1e-7),_=Math.min(_,5*a)):_=.013*(1-(F-T)/(x-T))*a/F,o.vx+=V/F*_,o.vy+=B/F*_}}const C=Math.pow(v,60*a);o.vx*=C,o.vy*=C;const N=Math.sqrt(o.vx*o.vx+o.vy*o.vy);N>s&&(o.vx=o.vx/N*s,o.vy=o.vy/N*s),o.px+=o.vx*a,o.py+=o.vy*a;const k=.07;o.px<k&&(o.vx+=(k-o.px)*80*a),o.px>1-k&&(o.vx-=(o.px-(1-k))*80*a),o.py<k&&(o.vy+=(k-o.py)*80*a),o.py>1-k&&(o.vy-=(o.py-(1-k))*80*a)}}function Yt(t,l){const r=new Float32Array(t*t*4),d=Float32Array.from({length:256*256},()=>Math.random()),a=(p,x)=>d[(p&255)*256+(x&255)],i=(p,x)=>{const T=Math.floor(p),v=Math.floor(x),s=p-T,u=x-v,o=s*s*(3-2*s),m=u*u*(3-2*u);return a(T,v)*(1-o)*(1-m)+a(T+1,v)*o*(1-m)+a(T,v+1)*(1-o)*m+a(T+1,v+1)*o*m};for(let p=0;p<t;p++)for(let x=0;x<t;x++){const T=(p*t+x)*4,v=x/t*l,s=p/t*l,o=i(v,s)*.571+i(v*2.1,s*2.1)*.286+i(v*4.3,s*4.3)*.143>.52;r[T+0]=o?.5:1,r[T+1]=o?.38:0,r[T+2]=0,r[T+3]=1}return r}function Kt(){var Me;const t=st(),l=R.useRef(null),r=R.useRef(0),d=((Me=ct())==null?void 0:Me.preset.inputMinShortPx)??1080,a=ut(),{settings:i,handleCanvasReady:p}=Ue(),{registerCanvas:x}=ft(),T=R.useRef(Ve),v=R.useRef(Le(17)),s=R.useRef([]),u=R.useRef(lt),o=R.useRef(0),m=R.useRef(dt),C=R.useRef(mt),N=R.useRef(_e(vt)),k=R.useRef(Pe(gt)),A=R.useRef(ht),V=R.useRef(null),B=R.useRef(null),F=R.useRef(1),_=R.useRef(0);R.useEffect(()=>{var S;A.current=i.patternDensity,(S=V.current)==null||S.call(V,i.patternDensity)},[i.patternDensity]),R.useEffect(()=>{const S=T.current,h=pt(i.coneSize);T.current=h,v.current=Le(i.coneSize);const L=pe(S),e=pe(h);if(L>1e-5&&Math.abs(e-L)>1e-4){const b=e/L;for(const y of s.current)y.px=.5+(y.px-.5)*b,y.py=.5+(y.py-.5)*b;_.current+=1}},[i.coneSize]),R.useEffect(()=>{const S=Math.min(Ke,Math.max(qe,i.coneCount));u.current=S;const h=s.current;if(S>h.length){const L=pe(T.current);for(let e=h.length;e<S;e++){const b=e/S*Math.PI*2;h.push({px:.5+Math.cos(b)*L,py:.5+Math.sin(b)*L,vx:0,vy:0})}}else s.current=h.slice(0,S)},[i.coneCount]),R.useEffect(()=>{o.current=i.colorMode==="monotone"?1:0},[i.colorMode]),R.useEffect(()=>{m.current=i.paletteColors},[i.paletteColors]),R.useEffect(()=>{C.current=i.monoColor},[i.monoColor]),R.useEffect(()=>{N.current=_e(i.colorSpeed)},[i.colorSpeed]),R.useEffect(()=>{k.current=Pe(i.motionSpeed)},[i.motionSpeed]),R.useEffect(()=>{const S=l.current;if(S)return p(S),x(S),()=>x(null)},[p,x]);const Te=R.useCallback(()=>{const S=l.current;if(!S)return;const h=Math.max(64,Math.round(xt().simResolutionPx)),L=h/It;S.width<1&&(S.width=h),S.height<1&&(S.height=h);const e=S.getContext("webgl2",{preserveDrawingBuffer:!0,antialias:!1});if(!e){console.error("[Ferrofluid] WebGL2 not available");return}if(!e.getExtension("EXT_color_buffer_float")){console.error("[Ferrofluid] EXT_color_buffer_float missing");return}e.getExtension("OES_texture_float_linear");const b=me(e,de,Bt),y=me(e,de,jt),g=me(e,de,Gt),U=me(e,de,Wt),re=e.createVertexArray();e.bindVertexArray(re);const Qe=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,Qe),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);let[ee,ve]=[J(e,h,h),J(e,h,h)],[j,q]=[J(e,h,h),J(e,h,h)],[H,$]=[J(e,h,h),J(e,h,h)];const ge=I=>{const D=Ct(I),Y=Yt(h,D);e.bindTexture(e.TEXTURE_2D,H.tex),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,h,h,0,e.RGBA,e.FLOAT,Y)};ge(A.current),V.current=ge;const we=Ht(e);s.current=Ot(u.current,T.current);let Se=42+Math.floor(Math.random()*997);const ae=()=>(Se=1103515245*Se+12345&2147483647,(Se&65535)/65535),Je=7,et=3.5;let te=0,oe=0,P=1,ie=[],z=he(u.current,te,ae,T.current),Z=[...z],De=_.current;const G={flow:e.getUniformLocation(b,"uFlow"),texel:e.getUniformLocation(b,"uTexel"),diffuse:e.getUniformLocation(b,"uDiffuse"),aspectYX:e.getUniformLocation(b,"uAspectYX"),coneCount:e.getUniformLocation(b,"uConeCount"),cones:Array.from({length:15},(I,D)=>e.getUniformLocation(b,`uCones[${D}]`)),coneRadius:e.getUniformLocation(b,"uConeRadius"),splatScale:e.getUniformLocation(b,"uSplatScale")},E={thick:e.getUniformLocation(y,"uThick"),texel:e.getUniformLocation(y,"uTexel"),decay:e.getUniformLocation(y,"uDecay"),diffuse:e.getUniformLocation(y,"uDiffuse"),coneCount:e.getUniformLocation(y,"uConeCount"),cones:Array.from({length:15},(I,D)=>e.getUniformLocation(y,`uCones[${D}]`)),coneRadius:e.getUniformLocation(y,"uConeRadius"),coneEmit:e.getUniformLocation(y,"uConeEmit"),coneFalloff:e.getUniformLocation(y,"uConeFalloff"),trailHeight:e.getUniformLocation(y,"uTrailHeight"),tipShape:e.getUniformLocation(y,"uTipShape"),aspectYX:e.getUniformLocation(y,"uAspectYX")},n={state:e.getUniformLocation(g,"uState"),thick:e.getUniformLocation(g,"uThick"),flow:e.getUniformLocation(g,"uFlow"),noise:e.getUniformLocation(g,"uNoise"),texel:e.getUniformLocation(g,"uTexel"),F:e.getUniformLocation(g,"uF"),K:e.getUniformLocation(g,"uK"),fCenter:e.getUniformLocation(g,"uFCenter"),kCenter:e.getUniformLocation(g,"uKCenter"),daMin:e.getUniformLocation(g,"uDaMin"),daMax:e.getUniformLocation(g,"uDaMax"),dbRatio:e.getUniformLocation(g,"uDbRatio"),aniso:e.getUniformLocation(g,"uAniso"),gridScale:e.getUniformLocation(g,"uGridScale"),scaleClamp:e.getUniformLocation(g,"uScaleClamp"),decayWidth:e.getUniformLocation(g,"uDecayWidth"),fNoise:e.getUniformLocation(g,"uFNoise"),kNoise:e.getUniformLocation(g,"uKNoise"),fkRamp:e.getUniformLocation(g,"uFKRamp"),coneDaBoost:e.getUniformLocation(g,"uConeDaBoost"),coneEmit:e.getUniformLocation(g,"uConeEmit"),edgeCut:e.getUniformLocation(g,"uEdgeCut"),swarmSpeed:e.getUniformLocation(g,"uSwarmSpeed"),seedStr:e.getUniformLocation(g,"uSeedStr"),seedThr:e.getUniformLocation(g,"uSeedThr"),seedSpd:e.getUniformLocation(g,"uSeedSpd"),coneSpeed:e.getUniformLocation(g,"uConeSpeed"),seedScale:e.getUniformLocation(g,"uSeedScale"),advect:e.getUniformLocation(g,"uAdvect"),advDecay:e.getUniformLocation(g,"uAdvDecay"),time:e.getUniformLocation(g,"uTime"),simSpeed:e.getUniformLocation(g,"uSimSpeed"),resScale:e.getUniformLocation(g,"uResScale")},M={thick:e.getUniformLocation(U,"uThick"),rdState:e.getUniformLocation(U,"uRDState"),texel:e.getUniformLocation(U,"uTexel"),coneCount:e.getUniformLocation(U,"uConeCount"),conePos:Array.from({length:15},(I,D)=>e.getUniformLocation(U,`uConePos[${D}]`)),coneRadius:e.getUniformLocation(U,"uConeRadius"),aspectYX:e.getUniformLocation(U,"uAspectYX"),fluidRim:e.getUniformLocation(U,"uFluidRim"),fluidRimPow:e.getUniformLocation(U,"uFluidRimPow"),nrmStr:e.getUniformLocation(U,"uNrmStr"),fluidRough:e.getUniformLocation(U,"uFluidRough"),fluidF0:e.getUniformLocation(U,"uFluidF0"),time:e.getUniformLocation(U,"uTime"),colorMode:e.getUniformLocation(U,"uColorMode"),paletteCount:e.getUniformLocation(U,"uPaletteCount"),paletteColors:Array.from({length:4},(I,D)=>e.getUniformLocation(U,`uPaletteColors[${D}]`)),monoColor:e.getUniformLocation(U,"uMonoColor"),colorSpeed:e.getUniformLocation(U,"uColorSpeed"),rdThLo:e.getUniformLocation(U,"uRdThLo"),rdThHi:e.getUniformLocation(U,"uRdThHi"),rdSharpen:e.getUniformLocation(U,"uRdSharpen")};let Ae=0,Re=0;const Fe=I=>{var ke;r.current=requestAnimationFrame(Fe);const D=Math.min((I-Ae)/1e3,.05);Ae=I,Re+=D,S.width<1&&(S.width=h),S.height<1&&(S.height=h);const Y=S.width,se=S.height,W=se/Y,O=W/h,ne=1/h;{const f=F.current;Math.abs(W-f)>.05&&(F.current=W,(ke=B.current)==null||ke.call(B,O,ne,A.current,800))}const K=T.current,Q=s.current,X=u.current,Ee=D*k.current;if(_.current!==De&&(De=_.current,ie=Z.map(f=>({...f})),z=he(X,te,ae,K),P=0,oe=0),Z.length!==X&&(z=he(X,te,ae,K),ie=z.map(f=>({...f})),Z=z.map(f=>({...f})),P=1,oe=0),oe+=Ee,oe>=Je&&P>=1&&(te++,ie=Z.map(f=>({...f})),z=he(X,te,ae,K),P=0,oe=0),P<1){P=Math.min(1,P+Ee/et);const f=P<.5?2*P*P:1-Math.pow(-2*P+2,2)/2;Z=ie.map((w,be)=>{const fe=z[be]??w;return{x:w.x+(fe.x-w.x)*f,y:w.y+(fe.y-w.y)*f}})}zt(Q,Ee,K,Z);let ce=0;for(const f of Q){const w=Math.sqrt(f.vx*f.vx+f.vy*f.vy);w>ce&&(ce=w)}e.bindVertexArray(re),e.viewport(0,0,h,h),e.useProgram(b),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,ee.tex),e.uniform1i(G.flow,0),e.uniform2f(G.texel,O,ne),e.uniform1f(G.diffuse,Vt),e.uniform1f(G.aspectYX,W),e.uniform1i(G.coneCount,X);for(let f=0;f<15;f++)if(f<X){const w=Q[f];e.uniform4f(G.cones[f],w.px,w.py,w.vx,w.vy)}else e.uniform4f(G.cones[f],0,0,0,0);e.uniform1f(G.coneRadius,K),e.uniform1f(G.splatScale,6),e.bindFramebuffer(e.FRAMEBUFFER,ve.fbo),e.drawArrays(e.TRIANGLE_STRIP,0,4),[ee,ve]=[ve,ee],e.useProgram(y),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,j.tex),e.uniform1i(E.thick,0),e.uniform2f(E.texel,O,ne),e.uniform1f(E.decay,.991),e.uniform1f(E.diffuse,Xe),e.uniform1i(E.coneCount,X);for(let f=0;f<15;f++)if(f<X){const w=Q[f];e.uniform4f(E.cones[f],w.px,w.py,w.vx,w.vy)}else e.uniform4f(E.cones[f],0,0,0,0);e.uniform1f(E.coneRadius,K),e.uniform1f(E.coneEmit,le),e.uniform1f(E.coneFalloff,v.current),e.uniform1f(E.trailHeight,Be),e.uniform1f(E.tipShape,je),e.uniform1f(E.aspectYX,W),e.bindFramebuffer(e.FRAMEBUFFER,q.fbo),e.drawArrays(e.TRIANGLE_STRIP,0,4),[j,q]=[q,j],e.useProgram(g),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,j.tex),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,ee.tex),e.activeTexture(e.TEXTURE3),e.bindTexture(e.TEXTURE_2D,we),e.uniform1i(n.thick,1),e.uniform1i(n.flow,2),e.uniform1i(n.noise,3),e.uniform2f(n.texel,O,ne),e.uniform1f(n.F,.033),e.uniform1f(n.K,.062),e.uniform1f(n.fCenter,.042),e.uniform1f(n.kCenter,.06),e.uniform1f(n.daMin,.04),e.uniform1f(n.daMax,.3),e.uniform1f(n.dbRatio,.5),e.uniform1f(n.aniso,1.5),e.uniform1f(n.gridScale,ye(A.current)),e.uniform1f(n.scaleClamp,ye(A.current)),e.uniform1f(n.decayWidth,.75),e.uniform1f(n.fNoise,.005),e.uniform1f(n.kNoise,.003),e.uniform1f(n.fkRamp,1),e.uniform1f(n.coneDaBoost,1),e.uniform1f(n.coneEmit,le),e.uniform1f(n.edgeCut,.025),e.uniform1f(n.swarmSpeed,ce),e.uniform1f(n.seedStr,0),e.uniform1f(n.seedThr,.2),e.uniform1f(n.seedSpd,6),e.uniform1f(n.coneSpeed,ce),e.uniform1f(n.seedScale,30),e.uniform1f(n.advect,.02),e.uniform1f(n.advDecay,.75),e.uniform1f(n.time,Re),e.uniform1f(n.simSpeed,Ie*k.current),e.uniform1f(n.resScale,L);for(let f=0;f<Xt;f++)e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,H.tex),e.uniform1i(n.state,0),e.bindFramebuffer(e.FRAMEBUFFER,$.fbo),e.drawArrays(e.TRIANGLE_STRIP,0,4),[H,$]=[$,H];e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,Y,se),e.useProgram(U),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,j.tex),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,H.tex),e.uniform1i(M.thick,0),e.uniform1i(M.rdState,1),e.uniform2f(M.texel,O,ne),e.uniform1i(M.coneCount,X);for(let f=0;f<X;f++)e.uniform2f(M.conePos[f],Q[f].px,Q[f].py);e.uniform1f(M.coneRadius,K),e.uniform1f(M.aspectYX,W),e.uniform1f(M.fluidRim,1.2),e.uniform1f(M.fluidRimPow,10),e.uniform1f(M.nrmStr,45),e.uniform1f(M.fluidRough,.06),e.uniform1f(M.fluidF0,.01),e.uniform1f(M.time,Re);const tt=o.current,ue=m.current,ot=C.current;e.uniform1i(M.colorMode,tt),e.uniform1i(M.paletteCount,Math.max(2,ue.length));for(let f=0;f<4;f++){const w=ue[f]??ue[ue.length-1]??"#ffffff",[be,fe,it]=We(w);e.uniform3f(M.paletteColors[f],be,fe,it)}const[nt,rt,at]=We(ot);e.uniform3f(M.monoColor,nt,rt,at),e.uniform1f(M.colorSpeed,N.current);const Ce=St(A.current);e.uniform1f(M.rdThLo,Ce.thLo),e.uniform1f(M.rdThHi,Ce.thHi),e.uniform1f(M.rdSharpen,Ce.sharpen),e.drawArrays(e.TRIANGLE_STRIP,0,4)};e.bindVertexArray(re),e.viewport(0,0,h,h),e.useProgram(y),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,j.tex),e.uniform1i(E.thick,0),e.uniform2f(E.texel,1/h,1/h),e.uniform1f(E.decay,.985),e.uniform1f(E.diffuse,Xe),e.uniform1i(E.coneCount,0),e.uniform1f(E.coneRadius,Ve),e.uniform1f(E.coneEmit,le),e.uniform1f(E.coneFalloff,v.current),e.uniform1f(E.trailHeight,Be),e.uniform1f(E.tipShape,je),e.uniform1f(E.aspectYX,1),e.bindFramebuffer(e.FRAMEBUFFER,q.fbo),e.drawArrays(e.TRIANGLE_STRIP,0,4),[j,q]=[q,j];const Ne=(I,D,Y,se=800)=>{ge(Y),e.bindVertexArray(re),e.viewport(0,0,h,h),e.useProgram(g),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,j.tex),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,ee.tex),e.activeTexture(e.TEXTURE3),e.bindTexture(e.TEXTURE_2D,we),e.uniform1i(n.thick,1),e.uniform1i(n.flow,2),e.uniform1i(n.noise,3),e.uniform2f(n.texel,I,D),e.uniform1f(n.F,.033),e.uniform1f(n.K,.062),e.uniform1f(n.fCenter,.042),e.uniform1f(n.kCenter,.06),e.uniform1f(n.daMin,.04),e.uniform1f(n.daMax,.3),e.uniform1f(n.dbRatio,.5),e.uniform1f(n.aniso,1.5);const W=ye(Y);e.uniform1f(n.gridScale,W),e.uniform1f(n.scaleClamp,W),e.uniform1f(n.decayWidth,.75),e.uniform1f(n.fNoise,.005),e.uniform1f(n.kNoise,.003),e.uniform1f(n.fkRamp,1),e.uniform1f(n.coneDaBoost,1),e.uniform1f(n.coneEmit,le),e.uniform1f(n.edgeCut,.025),e.uniform1f(n.swarmSpeed,0),e.uniform1f(n.coneSpeed,0),e.uniform1f(n.seedStr,0),e.uniform1f(n.seedThr,.2),e.uniform1f(n.seedSpd,6),e.uniform1f(n.seedScale,30),e.uniform1f(n.advect,0),e.uniform1f(n.advDecay,.75),e.uniform1f(n.time,0),e.uniform1f(n.simSpeed,Ie),e.uniform1f(n.resScale,L);for(let O=0;O<se;O++)e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,H.tex),e.uniform1i(n.state,0),e.bindFramebuffer(e.FRAMEBUFFER,$.fbo),e.drawArrays(e.TRIANGLE_STRIP,0,4),[H,$]=[$,H];e.bindFramebuffer(e.FRAMEBUFFER,null)};B.current=Ne,Ne(1/h,1/h,A.current,800),e.finish(),r.current=requestAnimationFrame(Fe)},[]);return R.useEffect(()=>(Te(),()=>{cancelAnimationFrame(r.current),V.current=null,B.current=null}),[Te]),R.useEffect(()=>{const S=l.current;if(!S)return;const h=(e,b)=>{if(e<1||b<1)return;const y=Rt(Math.min(e,b),void 0,a);S.width=Math.round(e*y),S.height=Math.round(b*y)};h(S.clientWidth,S.clientHeight);const L=new ResizeObserver(e=>{for(const b of e)h(b.contentRect.width,b.contentRect.height)});return L.observe(S),()=>L.disconnect()},[d,a]),c.jsx("canvas",{ref:l,[Tt]:"",style:{...t}})}function xe({label:t,paramKey:l,value:r,onChange:d,min:a=0,max:i=100,unit:p="",helpId:x}){const T=(r-a)/(i-a)*100,{touch:v,beginDrag:s,endDrag:u}=Lt(),o=_t();return c.jsxs("div",{className:"flex flex-col gap-[2px] w-full","data-help-id":x,children:[c.jsxs("div",{className:"flex items-center justify-between w-full",children:[c.jsx($e,{label:t,paramKey:l}),c.jsx(Ut,{value:r,onCommit:m=>{d(m),v(l,m)},min:a,max:i,unit:p})]}),c.jsx("div",{className:"relative w-full px-2",children:c.jsxs("div",{className:"py-[11px] relative w-full",children:[c.jsxs("div",{className:"relative w-full",children:[c.jsx("div",{className:"bg-border h-[2px] rounded-[10px] w-full"}),c.jsx("div",{className:"absolute bg-foreground h-[4px] left-0 top-0 rounded-[10px] transition-all",style:{width:`${T}%`}})]}),c.jsx("input",{type:"range",min:a,max:i,value:r,onChange:m=>{const C=Number(m.target.value);d(C),v(l,C)},onPointerDown:()=>{s(l),l&&o({paramKey:l,label:t,min:a,max:i})},onPointerUp:()=>u(l),onPointerCancel:()=>u(l),className:"peer absolute left-0 top-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing"}),c.jsx(Mt,{className:"absolute transition-all pointer-events-none",style:{left:`${T}%`,top:"50%",transform:"translate(-50%, -50%)"}})]})})]})}const He=28,Oe=16;function ze({label:t,onClick:l,children:r}){return c.jsx("button",{type:"button",onClick:l,"aria-label":t,className:"shrink-0 flex items-center justify-center rounded-[var(--radius-button)] bg-muted text-foreground hover:bg-border transition-colors cursor-pointer",style:{width:He,height:He},children:r})}function qt({label:t,paramKey:l,value:r,onChange:d,min:a,max:i,step:p=1,helpId:x}){const T=m=>String(parseFloat(m.toFixed(2))),[v,s]=R.useState(()=>T(r));R.useEffect(()=>{s(T(r))},[r]);const u=m=>{const C=Math.min(i,Math.max(a,Math.round(m/p)*p));d(C),s(T(C))},o=m=>{const C=parseInt(m.replace(/[^0-9-]/g,""),10);u(Number.isFinite(C)?C:r)};return c.jsxs("div",{className:"flex flex-col gap-[2px] w-full","data-help-id":x,children:[c.jsx($e,{label:t,paramKey:l}),c.jsxs("div",{className:"flex items-center w-full gap-[8px]",children:[c.jsx("input",{type:"text",inputMode:"numeric",value:v,onChange:m=>{(/^-?\d*$/.test(m.target.value)||m.target.value==="")&&s(m.target.value)},onBlur:()=>o(v),onKeyDown:m=>{if(m.key==="Enter"){o(v);return}if(m.key==="ArrowUp"){m.preventDefault(),u(r+p);return}m.key==="ArrowDown"&&(m.preventDefault(),u(r-p))},className:"min-w-0 flex-1 rounded-[var(--radius-button)] border border-border bg-transparent px-[10px] py-[7px] text-[13px] text-foreground tracking-[-0.2px] focus:outline-none focus:ring-1 focus:ring-foreground/20","aria-label":t}),c.jsx(ze,{label:`Decrease ${t}`,onClick:()=>u(r-p),children:c.jsx(wt,{size:Oe,strokeWidth:2,"aria-hidden":!0})}),c.jsx(ze,{label:`Increase ${t}`,onClick:()=>u(r+p),children:c.jsx(Dt,{size:Oe,strokeWidth:2,"aria-hidden":!0})})]})]})}function Ye({mode:t,label:l,selected:r,onSelect:d}){return c.jsxs("button",{type:"button",onClick:()=>d(t),className:"flex items-center gap-[10px] cursor-pointer",children:[c.jsx("span",{className:"shrink-0 flex items-center justify-center rounded-full border-2 transition-colors",style:{width:16,height:16,borderColor:r?"var(--foreground)":"var(--muted-foreground)"},children:r&&c.jsx("span",{className:"rounded-full bg-foreground",style:{width:8,height:8}})}),c.jsx("span",{className:"text-[14px] tracking-[-0.2px] text-foreground",children:l})]})}function $t({value:t,onChange:l,onRemove:r,canRemove:d}){return c.jsxs("div",{className:"group relative size-[32px]",children:[c.jsx(Ze,{value:t,onChange:l,size:32}),d&&c.jsx("button",{type:"button",onClick:r,className:"absolute -right-[6px] -top-[6px] size-[18px] rounded-full border border-border bg-card text-[12px] leading-none text-foreground hidden group-hover:flex items-center justify-center","aria-label":"Remove color",children:"×"})]})}function Zt(){const{settings:t,handleColorModeChange:l,handlePaletteColorChange:r,handleAddPaletteColor:d,handleRemovePaletteColor:a,handleMonoColorChange:i,handleColorSpeedChange:p}=Ue(),{colorMode:x,paletteColors:T,monoColor:v,colorSpeed:s}=t;return c.jsxs("div",{className:"flex flex-col",children:[c.jsxs("div",{className:"flex flex-col gap-[10px]","data-help-id":"ferrofluid.colorModeAutomated",children:[c.jsx(Ye,{mode:"automated",label:"Automated",selected:x==="automated",onSelect:l}),x==="automated"&&c.jsxs("div",{className:"flex items-center gap-[8px] flex-wrap pl-[26px]",children:[T.map((u,o)=>c.jsx($t,{value:u,onChange:m=>r(o,m),onRemove:()=>a(o),canRemove:T.length>2},o)),T.length<yt&&c.jsx("button",{type:"button",onClick:d,className:"bg-surface-accent rounded-[var(--radius-card)] size-[32px] flex items-center justify-center shrink-0 text-foreground cursor-pointer transition-colors hover:opacity-80","aria-label":"Add color",children:c.jsx("svg",{width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",children:c.jsx("path",{d:"M8 1V15M1 8H15",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round"})})})]})]}),x==="automated"&&c.jsx("div",{className:"mt-[16px]",children:c.jsx(xe,{label:"Speed",paramKey:"colorSpeed",value:s,onChange:p,min:0,max:100,helpId:"ferrofluid.colorSpeed"})}),c.jsx("div",{className:x==="automated"?"mt-[32px]":"mt-[16px]","data-help-id":"ferrofluid.colorModeMonotone",children:c.jsxs("div",{className:"flex flex-col gap-[10px]",children:[c.jsx(Ye,{mode:"monotone",label:"Monotone",selected:x==="monotone",onSelect:l}),x==="monotone"&&c.jsx("div",{className:"pl-[26px]",children:c.jsx(Ze,{value:v,onChange:i,size:32})})]})})]})}function Qt(){const{settings:t,handleConeSizeChange:l,handleConeCountChange:r,handlePatternDensityChange:d,handleMotionSpeedChange:a,resetToolControls:i}=Ue();return c.jsx(kt,{controls:c.jsx(Pt,{parameters:c.jsxs("div",{className:"flex flex-col gap-[14px] w-full",children:[c.jsx(xe,{label:"Blob size",paramKey:"coneSize",value:t.coneSize,onChange:l,min:1,max:100,helpId:"ferrofluid.blobSize"}),c.jsx(qt,{label:"Blobs",paramKey:"coneCount",value:t.coneCount,onChange:r,min:qe,max:Ke,helpId:"ferrofluid.blobCount"}),c.jsx(xe,{label:"Density",paramKey:"patternDensity",value:t.patternDensity,onChange:d,min:0,max:100,helpId:"ferrofluid.density"}),c.jsx(xe,{label:"Speed",paramKey:"motionSpeed",value:t.motionSpeed,onChange:a,min:0,max:100,helpId:"ferrofluid.motionSpeed"})]}),colors:c.jsx(Zt,{}),onResetAll:i,resetDisabled:bt(t)})})}const ao={id:"ferrofluid",name:"Ferrofluid",Icon:({className:t})=>c.jsx(Nt,{className:t||"size-5",weight:"regular"}),Canvas:Kt,Sidebar:Qt,StateProvider:Ft,exportCapabilities:{canExportPNG:!0,canExportSVG:!1,canCopySVG:!1,copyBypassSvgEffectsGate:!0},useExportHandlers:At};export{ao as default};
