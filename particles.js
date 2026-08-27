import{bx as jr,by as Je,bz as ur,d as kr,R as Ir,r as c,c as Lr,Q as Nr,bo as Vr,M as Ur,N as Dr,O as zr,e as fr,bA as Qt,bB as Jt,bC as Hr,bD as Wr,q as a,bE as Br,Y as er,K as yt,aR as Or,Z as tr,V as Gr,bF as rr,ae as Xr,bG as qr,bH as Yr,P as $r,S as Kr,G as Zr,H as Qr,bI as Jr,bJ as eo,bK as to}from"./index-CN-691Z9.js";import{i as ro}from"./stackTopCanvas-B5jcLrDp.js";import{C as oo,u as ao,a as io}from"./ControlsEffectsTabs-Dzh_Y3Uo.js";import{T as no}from"./ToolControlsDrawerPanel-CT3VRW7t.js";import{a as so}from"./ColorPicker-CiEMejDG.js";import"./BlockOpacitySlider-yaLZ_wDg.js";import"./Star.es-DFdc5VZK.js";function ze(i,t=1){return jr(i,void 0,t)}const lo=`#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`,co=`#version 300 es
precision highp float;
precision highp int;

// Canvas
uniform vec2  u_res;        // CSS canvas size (w, h)
uniform float u_dpr;        // devicePixelRatio

// Chladni
uniform vec2  u_sources[4]; // source positions in normalised [-1,1] space
uniform int   u_nsrc;       // number of active sources
uniform float u_freq;       // frequency
uniform float u_density;    // effective 0.5–50 (slider 1–100 via effectiveParticleDensity)
uniform float u_ps;         // particle size (CSS px)
uniform vec3  u_pcolor;     // particle colour (linear)
uniform vec3  u_bgcolor;    // background colour (linear)

// Mode
uniform int u_mode;         // 0 static | 1 wave | 2 vibration

// Wave (mode 1)
uniform float u_wt;
uniform float u_wspeed;
uniform float u_wrmax;
uniform float u_winvsig2;
uniform float u_wamp;
uniform float u_wtang;
uniform int   u_wn;
uniform float u_wtimes[16];

// Vibration (mode 2)
uniform float u_vt;
uniform float u_vamp;
uniform float u_vomega;
uniform float u_varea;    // edge-distortion clean-center radius, uv-distance units (matches Aberration's Area)

out vec4 fragColor;

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;
// Vibration jitter reach at u_vamp=1.0, as a fraction of one grid cell — kept well
// under the neighbor-search cap (see vibReachPx in main()) so particles jitter
// smoothly instead of being clipped when they swing outside the searched cells.
const float VIB_CELL_FRACTION = 2.6;

// High-quality integer hash (no sin) — uniform distribution [0,1)
float hash(uint x, uint y) {
  uint h = x * 1664525u + y * 1013904223u + 12345u;
  h = (h ^ (h >> 16u)) * 0x45d9f3bu;
  h =  h ^ (h >> 16u);
  return float(h) * (1.0 / 4294967296.0);
}

float chladni(vec2 norm) {
  float f = u_freq * PI;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_nsrc) break;
    s += cos(f * length(norm - u_sources[i]));
  }
  return s / float(u_nsrc);
}

void main() {
  // Chladni / particle density parameters — mirror the worker exactly
  float sharpness    = 0.6  + (u_density / 100.0) * 13.4;
  float scatterFloor = 0.01 + (1.0 - u_density / 100.0) * 0.022;

  // Grid is always at maximum resolution so cell centres never move as density
  // changes — particles appear/disappear in-place instead of sliding.
  // We compensate probability with areaRatio so the *number* of visible
  // particles stays consistent with the old variable-gridF behaviour.
  float gridF     = 420.0;
  float origGridF = min(300.0, 80.0 + u_density * 4.0);
  float areaRatio = (origGridF / gridF) * (origGridF / gridF);

  // Flip Y → top-left origin to match browser/worker coordinate system
  vec2 px = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y);

  // Cell coordinates (physical pixels)
  float cw = u_res.x * u_dpr / gridF;
  float ch = u_res.y * u_dpr / gridF;

  // Edge distortion (vibration mode only): re-samples the WHOLE procedural pattern
  // from a warped coordinate instead of moving individual particles, exactly like
  // FRAG_DISTORT_LENS/FRAG_ABERRATION's inverse-warp (sampleUv = center + dir*scale)
  // — so there's no neighbor-search-radius limit on how far this can push (unlike
  // the per-particle jitter below, which IS bounded by vibReachPx/searchRadius).
  // u_varea mirrors Aberration's own Area uniform (see computeAberrationUniforms)
  // so the "diameter of action" feels identical to Edge Blur / Aberration — see
  // vibrationAreaToUv below. EDGE_FALLOFF was a live slider while eyeballing a
  // default; 1.0 (== 100%) is the picked value, now hardcoded.
  if (u_mode == 2) {
    const float EDGE_FALLOFF = 1.0;
    const float EDGE_MAX_FRACTION = 0.16; // of the canvas short side, at full slider + full ramp

    vec2  ctr  = 0.5 * u_res * u_dpr;
    vec2  dir  = px - ctr;
    float dist = length(dir);
    float distUv = dist / (0.5 * u_dpr * min(u_res.x, u_res.y));

    float edgeScale = mix(0.4, 1.6, EDGE_FALLOFF);
    float minEdge    = mix(0.05, 0.18, EDGE_FALLOFF);
    float edge       = max(u_varea * edgeScale, minEdge);
    float ramp       = smoothstep(u_varea, u_varea + edge, distUv);
    float expo       = mix(1.6, 3.4, EDGE_FALLOFF);
    float amount      = pow(ramp, expo);

    vec2 dirNorm = dist > 1e-5 ? dir / dist : vec2(1.0, 0.0);
    // Per-cell (not per-pixel) phase so the wobble reads as coherent chaos rather
    // than per-pixel static — everything inside one grid cell shares a phase.
    float phase  = hash(uint(floor(px.x / cw)), uint(floor(px.y / ch))) * TAU;
    float wobble = 0.6 + 0.4 * sin(u_vomega * u_vt * 1.7 + phase);
    float pushPx = amount * u_vamp * EDGE_MAX_FRACTION * min(u_res.x, u_res.y) * u_dpr * wobble;

    px += dirNorm * pushPx;
  }

  int xi0 = int(floor(px.x / cw));
  int yi0 = int(floor(px.y / ch));
  int nx = int(gridF);
  int ny = int(gridF);
  float radMax = max(0.8, u_ps * 1.18 * u_dpr);
  float cellMin = max(1.0, min(cw, ch));
  // Vibration jitter reach, in physical px — scaled from the grid's own cell size
  // (not a fixed CSS-px amount) so it stays proportional at any canvas resolution
  // and never outruns the neighbor search below, which is what silently clips
  // jittered particles instead of letting them visibly wiggle. 1.5x accounts for
  // the summed-sine oscillation below peaking above unit amplitude.
  float vibReachPx = (u_mode == 2) ? (u_vamp * cellMin * VIB_CELL_FRACTION * 1.5) : 0.0;
  int searchRadius = int(ceil((radMax + vibReachPx) / cellMin)) + 1;
  searchRadius = min(searchRadius, 6);

  // Composite neighboring particles so circles are not clipped to one cell.
  // This allows particle size to keep increasing beyond the local cell size.
  // Loop bounds go to ±6 (not the old ±4) so full-amplitude vibration has room to
  // reach — cheap even at low searchRadius since each extra ring is just a
  // compare-and-skip until searchRadius actually grows to use it.
  float totalA = 0.0;
  for (int oy = -6; oy <= 6; oy++) {
    for (int ox = -6; ox <= 6; ox++) {
      if (abs(ox) > searchRadius || abs(oy) > searchRadius) continue;
      int ixi = xi0 + ox;
      int iyi = yi0 + oy;
      if (ixi < 0 || ixi >= nx || iyi < 0 || iyi >= ny) continue;

      uint xi = uint(ixi);
      uint yi = uint(iyi);

      // Per-cell deterministic jitter so particles can overlap and avoid visible grid rows.
      // Keep this subtle so the overall pattern still reads as Chladni.
      float jx = (hash(xi ^ 0xA11Cu, yi ^ 0x0FF5u) - 0.5) * cw * 1.35;
      float jy = (hash(xi ^ 0x19E3u, yi ^ 0xB3A9u) - 0.5) * ch * 1.35;

      // Cell centre in physical px and in CSS px (with organic jitter)
      vec2 cc  = (vec2(float(xi), float(yi)) + 0.5) * vec2(cw, ch) + vec2(jx, jy);
      vec2 ccC = cc / u_dpr;   // CSS space

      // Wave mode (1) only: displace the *sample point* used to evaluate the field,
      // which shifts where the nodal lines themselves appear this frame. Vibration
      // mode (2) deliberately leaves the field sample undisturbed (below) — which
      // particles exist stays governed by the true field, only their drawn position
      // jitters, so the existence/coverage pattern doesn't shimmer independently.
      vec2 sampleC = ccC;
      if (u_mode == 1) {
        vec2  ctr  = u_res * 0.5;
        vec2  dv   = ccC - ctr;
        float r    = length(dv);
        if (r > 1.0) {
          vec2  uhat = dv / r;
          float ang  = atan(dv.y, dv.x);
          float noise = 0.30 * sin(3.0 * ang + u_wt * 0.9)
                      + 0.15 * sin(7.0 * ang - u_wt * 1.3);
          float disp = 0.0;
          for (int i = 0; i < 16; i++) {
            if (i >= u_wn) break;
            float Rw    = (u_wt - u_wtimes[i]) * u_wspeed;
            float delta = r - Rw;
            float bump  = exp(-(delta * delta) * u_winvsig2);
            float fade  = max(0.0, 1.0 - Rw / u_wrmax);
            disp += u_wamp * bump * fade * (1.0 + noise);
          }
          sampleC = ccC + disp * uhat
                  + vec2(-disp * u_wtang * uhat.y,
                          disp * u_wtang * uhat.x);
        }
      }

      // Chladni value at the (possibly displaced) sample point
      vec2  norm = sampleC / u_res * 2.0 - 1.0;
      float z    = chladni(norm);
      float prob = max(exp(-z * z * sharpness * 18.0), scatterFloor) * areaRatio;
      if (hash(xi, yi) >= prob) continue;

      // Vibration mode (2): jitter the *drawn* particle position, not just the field
      // sample, so every particle actually moves — including the sparse background
      // scatter (previously untouched, since scatterFloor keeps their existence
      // probability high regardless of the old sample-point displacement). Intensity
      // ramps with |z|: particles sitting on the nodal line (z≈0, the crisp "core" of
      // the Chladni curve) barely move, while particles far from any line (large |z| —
      // exactly the scattered background particles) jitter the most.
      vec2 drawCC = cc;
      if (u_mode == 2) {
        // Core-vs-edge contrast scales with the slider itself: at low u_vamp the
        // core still moves almost as much as the edge (baseline near 0.85, a gentle
        // near-uniform wiggle); as u_vamp climbs toward 1, the core's share drops
        // toward 0.1 while edge/background particles (z beyond 0.4) always reach the
        // full 1.0 — so turning the slider up doesn't just get louder everywhere, it
        // specifically makes the periphery break away from an increasingly still core.
        float baseline = mix(0.85, 0.1, u_vamp);
        float offAmt = mix(baseline, 1.0, smoothstep(0.0, 0.4, abs(z)));
        // Physical px, scaled from the grid's own cell size (see vibReachPx above) —
        // not a fixed CSS-px amount, so jitter reach stays proportional to the grid
        // at any canvas resolution instead of overrunning the neighbor search.
        float vibAmpPx = u_vamp * cellMin * VIB_CELL_FRACTION * offAmt;
        float idx = float(yi) * gridF + float(xi);
        float phx = mod(idx * 2.3999632, TAU);
        float phy = mod(idx * 1.6180339, TAU);
        float vx  = vibAmpPx * (
            sin(u_vomega * u_vt + phx)
          + 0.35 * sin(2.0 * u_vomega * u_vt + phy)
          + 0.15 * sin(3.0 * u_vomega * u_vt + phx * 1.3));
        float vy  = vibAmpPx * (
            sin(u_vomega * u_vt + phy)
          + 0.35 * sin(2.0 * u_vomega * u_vt + phx)
          + 0.15 * sin(3.0 * u_vomega * u_vt + phy * 1.3));
        drawCC = cc + vec2(vx, vy);  // already physical px — no dpr conversion needed
      }

      // Circular particle with subtle size/alpha variation.
      float sv       = 0.92 + hash(xi ^ 0xDEADu, yi ^ 0xBEEFu) * 0.16;
      float alphaVar = 0.92 + hash(xi ^ 0x53C1u, yi ^ 0x9A77u) * 0.14;
      float rad      = max(0.8, u_ps * sv * u_dpr * 1.08);
      float d        = length(px - drawCC);
      if (d > rad) continue;

      // Fixed-width (~1.5 physical px) anti-aliased edge, independent of rad, so
      // particles render as crisp discs instead of soft blobs that blur more as
      // u_ps increases (the old core = 1 - nd*nd faded across the WHOLE radius).
      float nd = d / rad;
      float aa = clamp(1.5 / rad, 0.001, 0.5);
      float a  = (1.0 - smoothstep(1.0 - aa, 1.0, nd)) * 0.76 * alphaVar;
      totalA = 1.0 - (1.0 - totalA) * (1.0 - a);
    }
  }

  fragColor = vec4(mix(u_bgcolor, u_pcolor, totalA), 1.0);
}`,uo=`#version 300 es
in vec2  a_pos;   // CSS-pixel particle position
in float a_sv;    // size variation [0.55, 1.45]
uniform vec2  u_res;
uniform float u_ps;
uniform float u_dpr;
out float v_aa;
void main() {
  vec2 ndc = (a_pos / u_res) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position  = vec4(ndc, 0.0, 1.0);
  float pointSize = max(1.0, u_ps * a_sv * u_dpr);
  gl_PointSize = pointSize;
  // Fixed ~1.5-physical-px anti-aliased edge, independent of point size, so
  // larger particles render as crisp discs rather than blurrier blobs.
  v_aa = clamp(3.0 / pointSize, 0.02, 0.5);
}`,fo=`#version 300 es
precision mediump float;
uniform vec3 u_pcolor;
in float v_aa;
out vec4 fragColor;
void main() {
  float nd = length(gl_PointCoord - 0.5) * 2.0;
  if (nd > 1.0) discard;
  float a = 1.0 - smoothstep(1.0 - v_aa, 1.0, nd);
  fragColor = vec4(u_pcolor, a * 0.72);
}`,ho=`#version 300 es
in vec2  a_pos;   // CSS-pixel particle position
in float a_sv;    // size variation [0.15, 2.5] — encodes depth (bright=large)
uniform vec2  u_res;
uniform float u_ps;
uniform float u_dpr;

// Animation mode: 0 = static  1 = vortex wave  2 = vibration
uniform int   u_imgMode;
// Wave uniforms (mode 1)
uniform float u_wt;
uniform float u_wspeed;
uniform float u_wrmax;
uniform float u_winvsig2;
uniform float u_wamp;
uniform float u_wtang;
uniform int   u_wn;
uniform float u_wtimes[16];
// Vibration uniforms (mode 2)
uniform float u_vt;
uniform float u_vamp;
uniform float u_vomega;

out vec2 v_uv;
out float v_aa;

void main() {
  // UV is always from the *original* particle position so the image colour
  // is sampled from where the particle started, not where it moved to.
  v_uv = vec2(a_pos.x / u_res.x, a_pos.y / u_res.y);

  vec2 pos = a_pos;

  if (u_imgMode == 1) {
    // Vortex wave: radial Gaussian displacement bumps — same geometry as the
    // Chladni fragment shader mode 1, so it looks identical on point sprites.
    vec2  ctr  = u_res * 0.5;
    vec2  dv   = pos - ctr;
    float r    = length(dv);
    if (r > 1.0) {
      vec2  uhat = dv / r;
      float ang  = atan(dv.y, dv.x);
      float noise = 0.30 * sin(3.0 * ang + u_wt * 0.9)
                  + 0.15 * sin(7.0 * ang - u_wt * 1.3);
      float disp = 0.0;
      for (int i = 0; i < 16; i++) {
        if (i >= u_wn) break;
        float Rw    = (u_wt - u_wtimes[i]) * u_wspeed;
        float delta = r - Rw;
        float bump  = exp(-(delta * delta) * u_winvsig2);
        float fade  = max(0.0, 1.0 - Rw / u_wrmax);
        disp += u_wamp * bump * fade * (1.0 + noise);
      }
      pos = pos + disp * uhat
          + vec2(-disp * u_wtang * uhat.y,
                  disp * u_wtang * uhat.x);
    }

  } else if (u_imgMode == 2) {
    // Vibration: per-particle sine oscillation — mirrors FRAG_CHLADNI mode 2.
    // Derive the same cell index that the Chladni shader uses so the phase
    // distribution looks identical (gridF = 300, same irrational multipliers).
    const float TAU   = 6.28318530718;
    const float gridF = 300.0;
    float cellW = u_res.x / gridF;
    float cellH = u_res.y / gridF;
    float xi    = floor(a_pos.x / cellW);
    float yi    = floor(a_pos.y / cellH);
    float idx   = yi * gridF + xi;
    float phx   = mod(idx * 2.3999632, TAU);
    float phy   = mod(idx * 1.6180339, TAU);
    float vx    = u_vamp * (
        sin(u_vomega * u_vt + phx)
      + 0.35 * sin(2.0 * u_vomega * u_vt + phy)
      + 0.15 * sin(3.0 * u_vomega * u_vt + phx * 1.3));
    float vy    = u_vamp * (
        sin(u_vomega * u_vt + phy)
      + 0.35 * sin(2.0 * u_vomega * u_vt + phx)
      + 0.15 * sin(3.0 * u_vomega * u_vt + phy * 1.3));
    pos = pos + vec2(vx, vy);
  }

  vec2 ndc = (pos / u_res) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position  = vec4(ndc, 0.0, 1.0);
  float pointSize = max(1.0, u_ps * a_sv * u_dpr);
  gl_PointSize = pointSize;
  // Fixed ~1.5-physical-px anti-aliased edge, independent of point size, so
  // larger particles render as crisp discs rather than blurrier blobs.
  v_aa = clamp(3.0 / pointSize, 0.02, 0.5);
}`,po=`#version 300 es
precision mediump float;
uniform sampler2D u_image;
uniform vec3      u_pcolor;       // particle colour (used when u_useImgColor is false)
uniform bool      u_useImgColor;  // true = texture colours, false = monochromatic
in vec2 v_uv;
in float v_aa;
out vec4 fragColor;
void main() {
  float nd = length(gl_PointCoord - 0.5) * 2.0;
  if (nd > 1.0) discard;
  // Colour source: image texture OR solid particle colour
  vec3 col = u_useImgColor ? texture(u_image, v_uv).rgb : u_pcolor;
  // Crisp disc — fixed-width edge instead of a soft paraboloid across the whole radius.
  float a = 1.0 - smoothstep(1.0 - v_aa, 1.0, nd);
  fragColor = vec4(col, a * 0.88);
}`;function or(i,t,e){const o=i.createShader(t);if(i.shaderSource(o,e),i.compileShader(o),!i.getShaderParameter(o,i.COMPILE_STATUS))throw new Error(`Shader error:
${i.getShaderInfoLog(o)}`);return o}function bt(i,t,e){const o=i.createProgram();if(i.attachShader(o,or(i,i.VERTEX_SHADER,t)),i.attachShader(o,or(i,i.FRAGMENT_SHADER,e)),i.linkProgram(o),!i.getProgramParameter(o,i.LINK_STATUS))throw new Error(`Link error:
${i.getProgramInfoLog(o)}`);return o}function he(i){const t=parseInt(i.replace("#",""),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function w(i,t,e){return i.getUniformLocation(t,e)}function mo(i){return Math.max(.03,Math.max(0,Math.min(100,i))/100*.675)}class go{constructor(t){this.spriteCount=0,this.imgTex=null,this.srcBuf=new Float32Array(8),this.wavesBuf=new Float32Array(16),this.viewScale=1;const e=t.getContext("webgl2",{alpha:!1,antialias:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance"});if(!e)throw new Error("WebGL2 not supported");this.gl=e,this.chladniProg=bt(e,lo,co),this.cu={res:w(e,this.chladniProg,"u_res"),dpr:w(e,this.chladniProg,"u_dpr"),sources:w(e,this.chladniProg,"u_sources"),nsrc:w(e,this.chladniProg,"u_nsrc"),freq:w(e,this.chladniProg,"u_freq"),density:w(e,this.chladniProg,"u_density"),ps:w(e,this.chladniProg,"u_ps"),pcolor:w(e,this.chladniProg,"u_pcolor"),bgcolor:w(e,this.chladniProg,"u_bgcolor"),mode:w(e,this.chladniProg,"u_mode"),wt:w(e,this.chladniProg,"u_wt"),wspeed:w(e,this.chladniProg,"u_wspeed"),wrmax:w(e,this.chladniProg,"u_wrmax"),winvsig2:w(e,this.chladniProg,"u_winvsig2"),wamp:w(e,this.chladniProg,"u_wamp"),wtang:w(e,this.chladniProg,"u_wtang"),wn:w(e,this.chladniProg,"u_wn"),wtimes:w(e,this.chladniProg,"u_wtimes"),vt:w(e,this.chladniProg,"u_vt"),vamp:w(e,this.chladniProg,"u_vamp"),vomega:w(e,this.chladniProg,"u_vomega"),varea:w(e,this.chladniProg,"u_varea")};const o=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),e.STATIC_DRAW),this.quadVao=e.createVertexArray(),e.bindVertexArray(this.quadVao);const r=e.getAttribLocation(this.chladniProg,"a_pos");e.enableVertexAttribArray(r),e.vertexAttribPointer(r,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),this.spriteProg=bt(e,uo,fo),this.su={res:w(e,this.spriteProg,"u_res"),ps:w(e,this.spriteProg,"u_ps"),dpr:w(e,this.spriteProg,"u_dpr"),pcolor:w(e,this.spriteProg,"u_pcolor")},this.posVbo=e.createBuffer(),this.spriteVao=e.createVertexArray(),e.bindVertexArray(this.spriteVao),e.bindBuffer(e.ARRAY_BUFFER,this.posVbo);const n=e.getAttribLocation(this.spriteProg,"a_pos"),s=e.getAttribLocation(this.spriteProg,"a_sv");n>=0&&(e.enableVertexAttribArray(n),e.vertexAttribPointer(n,2,e.FLOAT,!1,12,0)),s>=0&&(e.enableVertexAttribArray(s),e.vertexAttribPointer(s,1,e.FLOAT,!1,12,8)),e.bindVertexArray(null),this.imgSpriteProg=bt(e,ho,po),this.isu={res:w(e,this.imgSpriteProg,"u_res"),ps:w(e,this.imgSpriteProg,"u_ps"),dpr:w(e,this.imgSpriteProg,"u_dpr"),image:w(e,this.imgSpriteProg,"u_image"),pcolor:w(e,this.imgSpriteProg,"u_pcolor"),useImgColor:w(e,this.imgSpriteProg,"u_useImgColor"),imgMode:w(e,this.imgSpriteProg,"u_imgMode"),wt:w(e,this.imgSpriteProg,"u_wt"),wspeed:w(e,this.imgSpriteProg,"u_wspeed"),wrmax:w(e,this.imgSpriteProg,"u_wrmax"),winvsig2:w(e,this.imgSpriteProg,"u_winvsig2"),wamp:w(e,this.imgSpriteProg,"u_wamp"),wtang:w(e,this.imgSpriteProg,"u_wtang"),wn:w(e,this.imgSpriteProg,"u_wn"),wtimes:w(e,this.imgSpriteProg,"u_wtimes"),vt:w(e,this.imgSpriteProg,"u_vt"),vamp:w(e,this.imgSpriteProg,"u_vamp"),vomega:w(e,this.imgSpriteProg,"u_vomega")},this.imgSpriteVao=e.createVertexArray(),e.bindVertexArray(this.imgSpriteVao),e.bindBuffer(e.ARRAY_BUFFER,this.posVbo);const f=e.getAttribLocation(this.imgSpriteProg,"a_pos"),m=e.getAttribLocation(this.imgSpriteProg,"a_sv");f>=0&&(e.enableVertexAttribArray(f),e.vertexAttribPointer(f,2,e.FLOAT,!1,12,0)),m>=0&&(e.enableVertexAttribArray(m),e.vertexAttribPointer(m,1,e.FLOAT,!1,12,8)),e.bindVertexArray(null)}setViewScale(t){this.viewScale=Math.max(1,t)}sync(t,e){const o=this.gl,r=ze(Math.min(t,e),this.viewScale),n=Math.round(t*r),s=Math.round(e*r),f=o.canvas;(f.width!==n||f.height!==s)&&(f.width=n,f.height=s),o.viewport(0,0,n,s)}setChladni(t){const e=this.gl,o=ze(Math.min(t.canvasW,t.canvasH),this.viewScale),r=this.cu;e.uniform2f(r.res,t.canvasW,t.canvasH),e.uniform1f(r.dpr,o),e.uniform1f(r.freq,t.freq),e.uniform1f(r.density,t.density),e.uniform1f(r.ps,t.ps),e.uniform3fv(r.pcolor,he(t.pcolor)),e.uniform3fv(r.bgcolor,he(t.bgcolor)),this.srcBuf.fill(0);const n=Math.min(t.sources.length,4);for(let s=0;s<n;s++)this.srcBuf[s*2]=t.sources[s].x,this.srcBuf[s*2+1]=t.sources[s].y;e.uniform2fv(r.sources,this.srcBuf),e.uniform1i(r.nsrc,n)}draw(t){const e=this.gl;this.sync(t.canvasW,t.canvasH),e.disable(e.BLEND),e.useProgram(this.chladniProg),this.setChladni(t),e.uniform1i(this.cu.mode,0),e.bindVertexArray(this.quadVao),e.drawArrays(e.TRIANGLES,0,6),e.bindVertexArray(null)}drawWave(t,e){const o=this.gl;this.sync(t.canvasW,t.canvasH),o.disable(o.BLEND),o.useProgram(this.chladniProg),this.setChladni(t);const r=this.cu;o.uniform1i(r.mode,1),o.uniform1f(r.wt,e.t),o.uniform1f(r.wspeed,e.speed),o.uniform1f(r.wrmax,e.rmax),o.uniform1f(r.winvsig2,e.invSig2),o.uniform1f(r.wamp,e.amp),o.uniform1f(r.wtang,e.tang);const n=Math.min(e.waveTimes.length,16);o.uniform1i(r.wn,n),this.wavesBuf.fill(0);for(let s=0;s<n;s++)this.wavesBuf[s]=e.waveTimes[s];o.uniform1fv(r.wtimes,this.wavesBuf),o.bindVertexArray(this.quadVao),o.drawArrays(o.TRIANGLES,0,6),o.bindVertexArray(null)}drawVib(t,e){const o=this.gl;this.sync(t.canvasW,t.canvasH),o.disable(o.BLEND),o.useProgram(this.chladniProg),this.setChladni(t);const r=this.cu;o.uniform1i(r.mode,2),o.uniform1f(r.vt,e.t),o.uniform1f(r.vamp,e.amp),o.uniform1f(r.vomega,e.omega),o.uniform1f(r.varea,e.area),o.bindVertexArray(this.quadVao),o.drawArrays(o.TRIANGLES,0,6),o.bindVertexArray(null)}upload(t,e){const o=this.gl;this.spriteCount=e,o.bindBuffer(o.ARRAY_BUFFER,this.posVbo),o.bufferData(o.ARRAY_BUFFER,t.subarray(0,e*3),o.DYNAMIC_DRAW)}drawText(t){if(this.spriteCount===0)return;const e=this.gl,o=ze(Math.min(t.canvasW,t.canvasH),this.viewScale);this.sync(t.canvasW,t.canvasH);const[r,n,s]=he(t.bgcolor);e.clearColor(r,n,s,1),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.useProgram(this.spriteProg),e.uniform2f(this.su.res,t.canvasW,t.canvasH),e.uniform1f(this.su.ps,t.ps),e.uniform1f(this.su.dpr,o),e.uniform3fv(this.su.pcolor,he(t.pcolor)),e.bindVertexArray(this.spriteVao),e.drawArrays(e.POINTS,0,this.spriteCount),e.bindVertexArray(null),e.disable(e.BLEND)}uploadImageTexture(t){const e=this.gl;this.imgTex&&(e.deleteTexture(this.imgTex),this.imgTex=null),this.imgTex=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.imgTex),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.bindTexture(e.TEXTURE_2D,null)}clearImageTexture(){this.imgTex&&(this.gl.deleteTexture(this.imgTex),this.imgTex=null)}drawImg(t,e=!0){if(this.spriteCount===0||!this.imgTex)return;const o=this.gl,r=ze(Math.min(t.canvasW,t.canvasH),this.viewScale);this.sync(t.canvasW,t.canvasH);const[n,s,f]=he(t.bgcolor);o.clearColor(n,s,f,1),o.clear(o.COLOR_BUFFER_BIT),o.enable(o.BLEND),o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA),o.useProgram(this.imgSpriteProg),o.uniform2f(this.isu.res,t.canvasW,t.canvasH),o.uniform1f(this.isu.ps,t.ps),o.uniform1f(this.isu.dpr,r),o.uniform3fv(this.isu.pcolor,he(t.pcolor)),o.uniform1i(this.isu.useImgColor,e?1:0),o.uniform1i(this.isu.imgMode,0),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,this.imgTex),o.uniform1i(this.isu.image,0),o.bindVertexArray(this.imgSpriteVao),o.drawArrays(o.POINTS,0,this.spriteCount),o.bindVertexArray(null),o.bindTexture(o.TEXTURE_2D,null),o.disable(o.BLEND)}drawImgWave(t,e,o=!0){if(this.spriteCount===0||!this.imgTex)return;const r=this.gl,n=ze(Math.min(t.canvasW,t.canvasH),this.viewScale);this.sync(t.canvasW,t.canvasH);const[s,f,m]=he(t.bgcolor);r.clearColor(s,f,m,1),r.clear(r.COLOR_BUFFER_BIT),r.enable(r.BLEND),r.blendFunc(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA),r.useProgram(this.imgSpriteProg),r.uniform2f(this.isu.res,t.canvasW,t.canvasH),r.uniform1f(this.isu.ps,t.ps),r.uniform1f(this.isu.dpr,n),r.uniform3fv(this.isu.pcolor,he(t.pcolor)),r.uniform1i(this.isu.useImgColor,o?1:0),r.uniform1i(this.isu.imgMode,1),r.uniform1f(this.isu.wt,e.t),r.uniform1f(this.isu.wspeed,e.speed),r.uniform1f(this.isu.wrmax,e.rmax),r.uniform1f(this.isu.winvsig2,e.invSig2),r.uniform1f(this.isu.wamp,e.amp),r.uniform1f(this.isu.wtang,e.tang);const d=Math.min(e.waveTimes.length,16);r.uniform1i(this.isu.wn,d),this.wavesBuf.fill(0);for(let u=0;u<d;u++)this.wavesBuf[u]=e.waveTimes[u];r.uniform1fv(this.isu.wtimes,this.wavesBuf),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.imgTex),r.uniform1i(this.isu.image,0),r.bindVertexArray(this.imgSpriteVao),r.drawArrays(r.POINTS,0,this.spriteCount),r.bindVertexArray(null),r.bindTexture(r.TEXTURE_2D,null),r.disable(r.BLEND)}drawImgVib(t,e,o=!0){if(this.spriteCount===0||!this.imgTex)return;const r=this.gl,n=ze(Math.min(t.canvasW,t.canvasH),this.viewScale);this.sync(t.canvasW,t.canvasH);const[s,f,m]=he(t.bgcolor);r.clearColor(s,f,m,1),r.clear(r.COLOR_BUFFER_BIT),r.enable(r.BLEND),r.blendFunc(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA),r.useProgram(this.imgSpriteProg),r.uniform2f(this.isu.res,t.canvasW,t.canvasH),r.uniform1f(this.isu.ps,t.ps),r.uniform1f(this.isu.dpr,n),r.uniform3fv(this.isu.pcolor,he(t.pcolor)),r.uniform1i(this.isu.useImgColor,o?1:0),r.uniform1i(this.isu.imgMode,2),r.uniform1f(this.isu.vt,e.t),r.uniform1f(this.isu.vamp,e.amp),r.uniform1f(this.isu.vomega,e.omega),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.imgTex),r.uniform1i(this.isu.image,0),r.bindVertexArray(this.imgSpriteVao),r.drawArrays(r.POINTS,0,this.spriteCount),r.bindVertexArray(null),r.bindTexture(r.TEXTURE_2D,null),r.disable(r.BLEND)}destroy(){const t=this.gl;t.deleteProgram(this.chladniProg),t.deleteProgram(this.spriteProg),t.deleteProgram(this.imgSpriteProg),this.imgTex&&t.deleteTexture(this.imgTex),t.deleteBuffer(this.posVbo),t.deleteVertexArray(this.quadVao),t.deleteVertexArray(this.spriteVao),t.deleteVertexArray(this.imgSpriteVao)}}const ne=Math.PI*2;function wt(i,t,e){return i+(t-i)*e}function xo(i,t,e){const o=Math.max(0,Math.min(1,(e-i)/(t-i)));return o*o*(3-2*o)}const St=[{fx:1,fy:.25,ph:.35,w:1},{fx:.3,fy:1,ph:1.15,w:1},{fx:1.1,fy:.95,ph:2.05,w:.72},{fx:1.85,fy:.45,ph:.82,w:.58},{fx:.55,fy:1.75,ph:1.62,w:.52},{fx:1.4,fy:-.65,ph:2.45,w:.42}],et=St.reduce((i,t)=>i+t.w,0);function pe(i){const t=Math.sin(i*12.9898+78.233)*43758.5453;return t-Math.floor(t)}const At=(()=>{const i=[];for(let t=0;t<36;t++){const e=.55+pe(t*7+1)*4.2,o=.55+pe(t*7+2)*4.2,r=-.28+pe(t*7+3)*1.56,n=-.28+pe(t*7+4)*1.56,s=ne*pe(t*7+5),f=.16+pe(t*7+6)*.52;i.push({fx:e,fy:o,cu:r,cv:n,ph:s,w:f})}return i})(),dr=At.reduce((i,t)=>i+t.w,0),tt=.26,ht=1+2*tt;function vo(i){return i*42e-5}function bo(i){return Math.max(0,Math.min(1e3,i))/1e3*13.75}function wo(i,t,e,o,r,n){const s=Math.max(0,Math.min(1,o/1e3)),f=o,m=Math.max(0,Math.min(1,n/100)),d=ne*r*m*.5;let u=0,k=0,T=0;St.forEach((y,F)=>{const E=ne*(y.fx*i+y.fy*t)+y.ph+s*ne*pe(f*8e-4+F*7.1)+d*(.55+F*.19),G=Math.sin(E),U=Math.cos(E);u+=y.w*G,k+=y.w*U*ne*y.fx,T+=y.w*U*ne*y.fy});const _=Math.max(0,Math.min(1,e/300));if(_<1e-9)return{H:u/et,gU:k/et,gV:T/et};let S=0,P=0,M=0;At.forEach((y,F)=>{const E=s*.6*(pe(f+F*2.7)-.5),G=s*.6*(pe(f+F*2.7+9.1)-.5),U=ne*(y.fx*(i-y.cu-E)+y.fy*(t-y.cv-G))+y.ph+s*ne*pe(f*.31+F*4.2)+d*(.5+F*.08),H=Math.sin(U),D=Math.cos(U);S+=y.w*H,P+=y.w*D*ne*y.fx,M+=y.w*D*ne*y.fy});const L=et+_*dr;return{H:(u+_*S)/L,gU:(k+_*P)/L,gV:(T+_*M)/L}}function rt(i,t,e){const o=Je(i),r=Math.min(52e3,Math.floor(400+o*500)),n=t/Math.max(e,1);let s=Math.round(Math.sqrt(r*n));s=Math.max(40,Math.min(s,340));const f=Math.max(32,Math.round(r/s)),m=s*f;return{cols:s,rows:f,n:m}}function hr(i,t,e,o,r,n,s){const f=(i+.5)/e,m=(t+.5)/o,d=-tt+f*ht,u=-tt+m*ht;let k=d,T=u;if(s.rotation!==0){const Y=Math.cos(s.rotation),Q=Math.sin(s.rotation),oe=d-.5,Ce=u-.5;k=.5+oe*Y-Ce*Q,T=.5+oe*Q+Ce*Y}let{H:_,gU:S,gV:P}=wo(k,T,s.waves,s.randomize,s.time,s.waveSpeed);if(s.rotation!==0){const Y=Math.cos(s.rotation),Q=Math.sin(s.rotation),oe=S*Y+P*Q,Ce=-S*Q+P*Y;S=oe,P=Ce}const M=(_+1)*.5,L=xo(.04,.24,M);if(L<8e-4)return{skip:!0,px:0,py:0,rad:0,fr:0,fg:0,fb:0,sv:0};const y=Math.min(r,n),F=vo(y),E=(d+tt)/ht*r,G=(u+tt)/ht*n,U=y*.048*bo(s.depth);let H=E+S*F,D=G-_*U-P*F;const K=Math.pow(M,.82)*L;let ye=s.particleSize*(.3+K*.95);const se=.16+.84*K,me=Math.round(wt(s.br,s.pr,se)),Se=Math.round(wt(s.bg,s.pg,se)),Ae=Math.round(wt(s.bb,s.pb,se)),le=.5+.95*K,ge=Math.max(1,Math.min(2,s.zoom));if(ge!==1){const Y=r*.5,Q=n*.5;H=Y+(H-Y)*ge,D=Q+(D-Q)*ge,ye*=ge}return{skip:!1,px:H,py:D,rad:ye,fr:me,fg:Se,fb:Ae,sv:le}}function _o(i,t,e,o,r){i.globalCompositeOperation="source-over",i.fillStyle=`rgb(${o.br},${o.bg},${o.bb})`,i.fillRect(0,0,t,e);const{cols:n,rows:s}=rt(o.density,t,e);i.save(),i.beginPath(),i.rect(0,0,t,e),i.clip();let f=0;for(let m=0;m<s;m++)for(let d=0;d<n;d++){const u=hr(d,m,n,s,t,e,o);u.skip||(r&&(r[f*3]=u.px,r[f*3+1]=u.py,r[f*3+2]=u.sv,f++),i.fillStyle=`rgb(${u.fr},${u.fg},${u.fb})`,i.beginPath(),i.arc(u.px,u.py,u.rad,0,ne),i.fill())}return i.restore(),r?f:0}function yo(i,t,e,o){const{cols:r,rows:n}=rt(o.density,t,e);let s=0;for(let f=0;f<n;f++)for(let m=0;m<r;m++){const d=hr(m,f,r,n,t,e,o);d.skip||(i[s*3]=d.px,i[s*3+1]=d.py,i[s*3+2]=d.sv,s++)}return s}const So=`#version 300 es
precision highp float;
precision highp int;

uniform int u_cols;
uniform int u_rows;

uniform float u_canvasW;
uniform float u_canvasH;
uniform float u_dpr;

uniform float u_zoom;
uniform float u_depth;
uniform float u_waves;
uniform float u_randomize;
uniform float u_waveSpeed;
uniform float u_rotation;
uniform float u_time;

uniform float u_ps;
uniform float u_pr;
uniform float u_pg;
uniform float u_pb;
uniform float u_br;
uniform float u_bg;
uniform float u_bb;

uniform float u_w_sum;
uniform float u_scatter_w_sum;

uniform vec4 u_topo[6];
uniform vec4 u_scatter0[36];
uniform vec4 u_scatter1[36];

in vec2 a_pos;

flat out vec4 v_rgba;
flat out vec2 v_centerFc;
flat out float v_radiusFc;

const float TAU = 6.28318530718;
const float UV_EXPAND = 0.26;
const float UV_DEN = 1.52;

float hash01(float n) {
  return fract(sin(n * 12.9898 + 78.233) * 43758.5453);
}

float smoothstep2(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float flowDepthMul(float depth) {
  float d = clamp(depth, 0.0, 1000.0);
  return (d / 1000.0) * 13.75;
}

float gradShiftScale(float shortSide) {
  return shortSide * 0.00042;
}

void heightAndGrad(
  float u,
  float v,
  float wavesParam,
  float randomize,
  float timeSec,
  float waveSpeed,
  out float H,
  out float gU,
  out float gV
) {
  float r = clamp(randomize / 1000.0, 0.0, 1.0);
  float seed = randomize;
  float speed = clamp(waveSpeed / 100.0, 0.0, 1.0);
  float motion = TAU * timeSec * speed * 0.5;

  float sBase = 0.0;
  float gUb = 0.0;
  float gVb = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 wv = u_topo[i];
    float ph = TAU * (wv.x * u + wv.y * v) + wv.z
      + r * TAU * hash01(seed * 0.0008 + float(i) * 7.1)
      + motion * (0.55 + float(i) * 0.19);
    float si = sin(ph);
    float co = cos(ph);
    sBase += wv.w * si;
    gUb += wv.w * co * TAU * wv.x;
    gVb += wv.w * co * TAU * wv.y;
  }

  float k = clamp(wavesParam / 300.0, 0.0, 1.0);
  if (k < 1e-9) {
    H = sBase / u_w_sum;
    gU = gUb / u_w_sum;
    gV = gVb / u_w_sum;
    return;
  }

  float sE = 0.0;
  float gUe = 0.0;
  float gVe = 0.0;
  for (int i = 0; i < 36; i++) {
    vec4 sw0 = u_scatter0[i];
    vec4 sw1 = u_scatter1[i];
    float fx = sw0.x;
    float fy = sw0.y;
    float cu = sw0.z;
    float cv = sw0.w;
    float ph0 = sw1.x;
    float ww = sw1.y;
    float dcu = r * 0.6 * (hash01(seed + float(i) * 2.7) - 0.5);
    float dcv = r * 0.6 * (hash01(seed + float(i) * 2.7 + 9.1) - 0.5);
    float ph = TAU * (fx * (u - cu - dcu) + fy * (v - cv - dcv)) + ph0
      + r * TAU * hash01(seed * 0.31 + float(i) * 4.2)
      + motion * (0.5 + float(i) * 0.08);
    float si = sin(ph);
    float co = cos(ph);
    sE += ww * si;
    gUe += ww * co * TAU * fx;
    gVe += ww * co * TAU * fy;
  }

  float denom = u_w_sum + k * u_scatter_w_sum;
  H = (sBase + k * sE) / denom;
  gU = (gUb + k * gUe) / denom;
  gV = (gVb + k * gVe) / denom;
}

void main() {
  int cols = u_cols;
  int rows = u_rows;
  int id = gl_InstanceID;
  int ci = id % cols;
  int cj = id / cols;
  if (cj >= rows || ci < 0) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    v_radiusFc = 0.0;
    return;
  }

  float tu = (float(ci) + 0.5) / float(cols);
  float tv = (float(cj) + 0.5) / float(rows);
  float uu = -UV_EXPAND + tu * UV_DEN;
  float vv = -UV_EXPAND + tv * UV_DEN;

  // Rotate the sampled wave coordinate about the field center (matches flowField.ts).
  float su = uu;
  float sv = vv;
  if (u_rotation != 0.0) {
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    float du = uu - 0.5;
    float dv = vv - 0.5;
    su = 0.5 + du * c - dv * s;
    sv = 0.5 + du * s + dv * c;
  }

  float H, gU, gV;
  heightAndGrad(su, sv, u_waves, u_randomize, u_time, u_waveSpeed, H, gU, gV);

  if (u_rotation != 0.0) {
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    float gu = gU * c + gV * s;
    float gv = -gU * s + gV * c;
    gU = gu;
    gV = gv;
  }

  float elev = (H + 1.0) * 0.5;
  float voidMix = smoothstep2(0.04, 0.24, elev);
  if (voidMix < 0.0008) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    v_radiusFc = 0.0;
    return;
  }

  float shortSide = min(u_canvasW, u_canvasH);
  float gs = gradShiftScale(shortSide);
  float bx = ((uu + UV_EXPAND) / UV_DEN) * u_canvasW;
  float by = ((vv + UV_EXPAND) / UV_DEN) * u_canvasH;
  float ampZ = shortSide * 0.048 * flowDepthMul(u_depth);
  float px = bx + gU * gs;
  float py = by - H * ampZ - gV * gs;

  float rim = pow(elev, 0.82) * voidMix;
  float rad = u_ps * (0.3 + rim * 0.95);
  float mixv = 0.16 + 0.84 * rim;
  float fr = mix(u_br, u_pr, mixv);
  float fg = mix(u_bg, u_pg, mixv);
  float fb = mix(u_bb, u_pb, mixv);

  float z = clamp(u_zoom, 1.0, 2.0);
  if (z > 1.0001) {
    float cx = u_canvasW * 0.5;
    float cy = u_canvasH * 0.5;
    px = cx + (px - cx) * z;
    py = cy + (py - cy) * z;
    rad *= z;
  }

  vec2 offset = a_pos * rad;
  vec2 p = vec2(px + offset.x, py + offset.y);

  float ndcX = (p.x / u_canvasW) * 2.0 - 1.0;
  float ndcY = 1.0 - (p.y / u_canvasH) * 2.0;
  gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);

  v_rgba = vec4(fr / 255.0, fg / 255.0, fb / 255.0, 1.0);

  float hpx = u_canvasH * u_dpr;
  float wpx = u_canvasW * u_dpr;
  v_centerFc = vec2(px * u_dpr, hpx - py * u_dpr);
  v_radiusFc = rad * u_dpr;
}
`,Ao=`#version 300 es
precision highp float;
flat in vec4 v_rgba;
flat in vec2 v_centerFc;
flat in float v_radiusFc;
out vec4 fragColor;

void main() {
  if (v_radiusFc <= 0.0) discard;
  if (length(gl_FragCoord.xy - v_centerFc) > v_radiusFc + 0.5) discard;
  fragColor = v_rgba;
}
`;function ar(i,t,e){const o=i.createShader(t);return o?(i.shaderSource(o,e),i.compileShader(o),i.getShaderParameter(o,i.COMPILE_STATUS)?o:(console.warn("flowFieldWebGL shader:",i.getShaderInfoLog(o)),i.deleteShader(o),null)):null}function Co(){const i=new Float32Array(24);for(let t=0;t<6;t++){const e=St[t];i[t*4+0]=e.fx,i[t*4+1]=e.fy,i[t*4+2]=e.ph,i[t*4+3]=e.w}return i}function Po(){const i=new Float32Array(144),t=new Float32Array(144);for(let e=0;e<36;e++){const o=At[e];i[e*4+0]=o.fx,i[e*4+1]=o.fy,i[e*4+2]=o.cu,i[e*4+3]=o.cv,t[e*4+0]=o.ph,t[e*4+1]=o.w,t[e*4+2]=0,t[e*4+3]=0}return{s0:i,s1:t}}const Ro=new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]);class Eo{constructor(t){this.loc={},this.gl=t,this.topoBuf=Co();const e=Po();this.scatter0=e.s0,this.scatter1=e.s1;const o=ar(t,t.VERTEX_SHADER,So),r=ar(t,t.FRAGMENT_SHADER,Ao);if(!o||!r)throw new Error("flowFieldWebGL: shader compile failed");const n=t.createProgram();if(!n)throw new Error("flowFieldWebGL: no program");if(t.attachShader(n,o),t.attachShader(n,r),t.bindAttribLocation(n,0,"a_pos"),t.linkProgram(n),t.deleteShader(o),t.deleteShader(r),!t.getProgramParameter(n,t.LINK_STATUS))throw console.warn(t.getProgramInfoLog(n)),new Error("flowFieldWebGL: link failed");this.program=n;const s=["u_cols","u_rows","u_canvasW","u_canvasH","u_dpr","u_zoom","u_depth","u_waves","u_randomize","u_waveSpeed","u_rotation","u_time","u_ps","u_pr","u_pg","u_pb","u_br","u_bg","u_bb","u_w_sum","u_scatter_w_sum"];for(const d of s)this.loc[d]=t.getUniformLocation(n,d);for(let d=0;d<6;d++)this.loc[`u_topo[${d}]`]=t.getUniformLocation(n,`u_topo[${d}]`);for(let d=0;d<36;d++)this.loc[`u_scatter0[${d}]`]=t.getUniformLocation(n,`u_scatter0[${d}]`),this.loc[`u_scatter1[${d}]`]=t.getUniformLocation(n,`u_scatter1[${d}]`);const f=t.createVertexArray();if(!f)throw new Error("flowFieldWebGL: no vao");t.bindVertexArray(f);const m=t.createBuffer();if(!m)throw new Error("flowFieldWebGL: no vbo");t.bindBuffer(t.ARRAY_BUFFER,m),t.bufferData(t.ARRAY_BUFFER,Ro,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.vertexAttribDivisor(0,0),t.bindVertexArray(null),this.vao=f,this.vbo=m,t.useProgram(n);for(let d=0;d<6;d++){const u=d*4;t.uniform4f(this.loc[`u_topo[${d}]`],this.topoBuf[u],this.topoBuf[u+1],this.topoBuf[u+2],this.topoBuf[u+3])}for(let d=0;d<36;d++){const u=d*4;t.uniform4f(this.loc[`u_scatter0[${d}]`],this.scatter0[u],this.scatter0[u+1],this.scatter0[u+2],this.scatter0[u+3]),t.uniform4f(this.loc[`u_scatter1[${d}]`],this.scatter1[u],this.scatter1[u+1],this.scatter1[u+2],this.scatter1[u+3])}t.uniform1f(this.loc.u_w_sum,et),t.uniform1f(this.loc.u_scatter_w_sum,dr),t.useProgram(null)}draw(t,e,o,r){const n=this.gl,{cols:s,rows:f}=rt(r.density,t,e),m=s*f,d=Math.round(t*o),u=Math.round(e*o);n.viewport(0,0,d,u),n.disable(n.DEPTH_TEST),n.disable(n.BLEND),n.disable(n.CULL_FACE),n.clearColor(r.br/255,r.bg/255,r.bb/255,1),n.clear(n.COLOR_BUFFER_BIT),n.useProgram(this.program),n.bindVertexArray(this.vao),n.uniform1i(this.loc.u_cols,s),n.uniform1i(this.loc.u_rows,f),n.uniform1f(this.loc.u_canvasW,t),n.uniform1f(this.loc.u_canvasH,e),n.uniform1f(this.loc.u_dpr,o),n.uniform1f(this.loc.u_zoom,r.zoom),n.uniform1f(this.loc.u_depth,r.depth),n.uniform1f(this.loc.u_waves,r.waves),n.uniform1f(this.loc.u_randomize,r.randomize),n.uniform1f(this.loc.u_waveSpeed,r.waveSpeed),n.uniform1f(this.loc.u_rotation,r.rotation),n.uniform1f(this.loc.u_time,r.time),n.uniform1f(this.loc.u_ps,r.particleSize),n.uniform1f(this.loc.u_pr,r.pr),n.uniform1f(this.loc.u_pg,r.pg),n.uniform1f(this.loc.u_pb,r.pb),n.uniform1f(this.loc.u_br,r.br),n.uniform1f(this.loc.u_bg,r.bg),n.uniform1f(this.loc.u_bb,r.bb),n.drawArraysInstanced(n.TRIANGLES,0,6,m),n.bindVertexArray(null),n.useProgram(null)}dispose(){const t=this.gl;t.deleteBuffer(this.vbo),t.deleteVertexArray(this.vao),t.deleteProgram(this.program)}}function To(i){var e;const t=i.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!0});if(!t)return null;try{return new Eo(t)}catch(o){console.warn("flowFieldWebGL:",o);try{(e=t.getExtension("WEBGL_lose_context"))==null||e.loseContext()}catch{}return null}}function ir(i){const t=parseInt(i.replace("#",""),16);return[t>>16&255,t>>8&255,t&255]}const pt=(i,t)=>i/t*2-1,nr=i=>i.map(t=>`${t.x.toFixed(3)},${t.y.toFixed(3)}`).join("|"),Fo=(i,t)=>{const e=Math.abs(i),o=Math.abs(t);return[{x:-e,y:-o},{x:e,y:-o},{x:-e,y:o},{x:e,y:o}]};function Mo(i,t,e,o,r,n,s){const f=new Float32Array(i*3),m=Math.PI*(3-Math.sqrt(5)),d=Math.cos(r),u=Math.sin(r),k=s*.7;for(let T=0;T<i;T++){const _=1-T/(i-1)*2,S=Math.sqrt(Math.max(0,1-_*_)),P=m*T,M=Math.cos(P)*S+n[T*3]*k,L=_+n[T*3+1]*k,y=Math.sin(P)*S+n[T*3+2]*k,F=d*M+u*y,E=-u*M+d*y;f[T*3]=e+F*t,f[T*3+1]=o+L*t,f[T*3+2]=.55+.9*((E+1)/2)}return f}const jo=Math.PI/4,sr=Math.atan(1/Math.sqrt(2));function ko(i,t,e,o,r,n,s){const f=new Float32Array(i*3),m=Math.cos(r),d=Math.sin(r),u=Math.cos(sr),k=Math.sin(sr),T=s*.5,_=.38,S=.28;for(let P=0;P<i;P++){const M=P%6,L=n[P*3],y=n[P*3+1],F=n[P*3+2]*T,E=P%Math.round(1/S)===0,G=E?L:Math.sign(L)*Math.pow(Math.abs(L),_),U=E?y:Math.sign(y)*Math.pow(Math.abs(y),_);let H=0,D=0,K=0;M===0?(H=G,D=U,K=1+F):M===1?(H=G,D=U,K=-(1+F)):M===2?(H=1+F,D=U,K=G):M===3?(H=-(1+F),D=U,K=G):M===4?(H=G,D=-(1+F),K=U):(H=G,D=1+F,K=U);const ye=m*H+d*K,se=D,me=-d*H+m*K,Se=ye,Ae=u*se-k*me,le=k*se+u*me;f[P*3]=e+Se*t,f[P*3+1]=o+Ae*t,f[P*3+2]=.55+.9*((le+1)/2)}return f}const Io=30,Qe=14,lr=15,Lo=34;function No(){var $t;const{settings:i,liveSettingsRef:t,previewVisualization:e,handleCanvasReady:o,onParticlesGenerated:r,canvasLogicalSizeRef:n,particlesBufRef:s,particleCountRef:f,handleSourcesChange:m,handleSymmetryChange:d,handleFrequencyChange:u,isExtractingVideo:k,videoExtractionProgress:T}=ur(),{density:_,frequency:S,particleSize:P,particleColor:M,bgColor:L,text:y,fontFamily:F,sources:E,symmetryLocked:G,imageSrc:U,imageZoom:H,imageOriginalColor:D,visualization:K,sphereSize:ye,rotationSpeed:se,organicAmount:me,flowGridZoom:Se,flowDepth:Ae,flowWaves:le,flowRandomize:ge,flowWaveSpeed:Y,flowRotation:Q,vibration:oe,vibrationArea:Ce}=i,W=e??K,{registerCanvas:He}=kr(),ot=Ir(),Ye=c.useRef(ot);Ye.current=ot;const Pe=c.useRef(null),xe=c.useRef(null),ee=c.useRef(null),mt=c.useRef({w:0,h:0}),Re=c.useRef(null),at=c.useRef(!1),$e=c.useRef(0),Z=c.useRef(null),ce=c.useRef(null),te=c.useRef(0),ve=c.useRef(0),ue=c.useRef(!1),We=c.useRef(-1),it=c.useRef(null),be=c.useRef(null),je=c.useRef({w:0,h:0}),ke=c.useRef(null),nt=c.useRef(null),Be=c.useRef({ox:0,oy:0}),Ie=c.useRef(!1),Ct=c.useRef(0),st=c.useRef(null),Pt=c.useRef(jo),lt=c.useRef(null),ct=c.useRef({density:-1,frequency:-1,canvasW:0,canvasH:0,text:"",fontFamily:"",sourcesKey:""}),[Ee,gt]=c.useState(0),{aspectRatio:Le,isMobile:we}=Lr(),Rt=(($t=Nr())==null?void 0:$t.preset.inputMinShortPx)??1080,Oe=Vr(),Et=Ur(),_e=Et==="interactive",pr=Dr(),mr=ro(pr.active),Ge=Et!==null||mr,{isInlineMode:ut,isHovering:gr,interactiveScale:Tt}=zr(),[Ne,Ft]=c.useState(!1),[Mt,jt]=c.useState({x:!1,y:!1}),[xr,kt]=c.useState(!1),[It,vr]=c.useState(!1),[Ve,Lt]=c.useState(0),[Ue,Nt]=c.useState(0),[xt,Vt]=c.useState(!1),x=Ee>0?Le==="9:16"?Math.round(Ee*9/16):Le==="3:4"?Math.round(Ee*3/4):Ee:0,v=Ee>0?Le==="16:9"?Math.round(Ee*9/16):Le==="4:3"?Math.round(Ee*3/4):Ee:0;c.useEffect(()=>{n.current={w:x,h:v}},[n,x,v]);const $=y.trim().length>0,Ke=!!U,N=fr("particles"),z=Ke||N,Te=W==="flowfield"&&!z&&!$,Ut=!$&&!z&&W!=="sphere"&&W!=="cube"&&W!=="flowfield",Dt=Ut&&(_e||(we?It||Ne:xr||Ne)),zt=tr(Le,we),Ht=zt>0?zt/Or:1,ae=c.useCallback((l,h,p)=>l*Ht,[Ht]),De=c.useRef({canvasW:x,canvasH:v,freq:S,density:_,ps:ae(P,x,v),pcolor:M,bgcolor:L,sources:E});De.current={canvasW:x,canvasH:v,freq:S,density:Je(_)*2,ps:ae(P,x,v),pcolor:M,bgcolor:L,sources:E};const Ze=c.useRef({density:_,frequency:S,text:y,fontFamily:F,sources:E,canvasW:x,canvasH:v,hasImage:z,hasText:$,imageOriginalColor:D});Ze.current={density:_,frequency:S,text:y,fontFamily:F,sources:E,canvasW:x,canvasH:v,hasImage:z,hasText:$,imageOriginalColor:D},c.useEffect(()=>{const l=Pe.current,h=xe.current,p=Te&&h?h:l;if(p)return o(p),He(p),()=>He(null)},[o,He,Te]),c.useEffect(()=>{if(Ge)return;const l=()=>{const h=Math.min(window.innerWidth,window.innerHeight),p=Math.floor(we?window.innerWidth*.9:h*.5);gt(Math.max(200,p))};return l(),window.addEventListener("resize",l),()=>window.removeEventListener("resize",l)},[Ge,we]);const ft=c.useCallback(()=>{const l=tr(Le,we);return l<=0?0:_e?Math.round(l*(ut?Tt:Gr)):l},[Le,we,_e,ut,Tt]);c.useLayoutEffect(()=>{if(!Ge)return;const l=ft();l>0&&gt(l)},[Ge,ft]),c.useEffect(()=>{if(!Ge)return;const l=()=>{const h=ft();h>0&&gt(h)};return l(),window.addEventListener("resize",l),()=>window.removeEventListener("resize",l)},[Ge,ft]),c.useEffect(()=>{const l=Pe.current;if(!l)return;if(!$&&W==="flowfield"&&!z){Z.current&&(Z.current.destroy(),Z.current=null);return}let h=null;try{h=new go(l),Z.current=h}catch(p){console.error("WebGL2 init failed:",p)}return()=>{h==null||h.destroy(),Z.current=null}},[W,z,$]),c.useEffect(()=>{var l;(l=Z.current)==null||l.setViewScale(Oe)},[Oe]);const Wt=c.useCallback((l,h,p)=>{if(Ze.current.hasText)return;const g=Z.current,C=Pe.current;if(!g||!C)return;let b=l;if(H!==0||Ve!==0||Ue!==0){const V=document.createElement("canvas");V.width=h,V.height=p;const I=V.getContext("2d");if(I){const J=1+H/100,fe=h*J,de=p*J,ie=(h-fe)/2+Ve,re=(p-de)/2+Ue;I.drawImage(l,ie,re,fe,de),b=V}}C.width=h,C.height=p,De.current={canvasW:h,canvasH:p,freq:S,density:Je(_)*2,ps:ae(P,h,p),pcolor:M,bgcolor:L,sources:E},g.uploadImageTexture(b);const R=b.getContext("2d");if(!R)return;const{data:A}=R.getImageData(0,0,h,p);be.current=new Uint8ClampedArray(A),je.current={w:h,h:p};const B={canvasW:h,canvasH:p,ps:ae(P,h,p),pcolor:M,bgcolor:L},X=ce.current;if(f.current>0&&g.drawImg(B,D),!X)return;const j=++ve.current;X.postMessage({density:_,frequency:S,width:h,height:p,id:j,text:"",fontFamily:"system-ui",sources:E,draft:!1,imagePixels:be.current,imageWidth:h,imageHeight:p})},[_,S,P,M,L,H,Ve,Ue,D,E,f,ae]);c.useEffect(()=>{if(N)return Qt(Wt),()=>Qt(null)},[N,Wt]),c.useEffect(()=>{if(!N)return;const l=Te?xe.current:Pe.current;return Jt(l),()=>Jt(null)},[N,Te]),c.useEffect(()=>{const l=new Worker(new URL("/assets/particles.worker-CrvQSNHx.js",import.meta.url),{type:"module"});return l.onmessage=h=>{const{buf:p,count:g,id:C}=h.data;if(C!==ve.current)return;r(p,g);const b=Ze.current,R=Z.current;if(!R)return;const A=De.current;b.hasImage&&!b.hasText?(R.upload(p,g),R.drawImg({canvasW:A.canvasW,canvasH:A.canvasH,ps:A.ps,pcolor:A.pcolor,bgcolor:A.bgcolor},b.imageOriginalColor),rr(g)):b.hasText?(R.upload(p,g),R.drawText({canvasW:A.canvasW,canvasH:A.canvasH,ps:A.ps,pcolor:A.pcolor,bgcolor:A.bgcolor})):N||R.draw(A)},ce.current=l,()=>{l.terminate(),ce.current=null,rr(0)}},[r,N]),c.useEffect(()=>{if(N||W==="flowfield"&&!Ke)return;const l=Z.current;if(!U){ke.current=null,nt.current=null,be.current=null,je.current={w:0,h:0},l==null||l.clearImageTexture(),Lt(0),Nt(0);return}if(x===0||v===0)return;let h=!1;const p=g=>{if(h)return;const C=document.createElement("canvas");C.width=x,C.height=v;const b=C.getContext("2d");if(!b)return;const R=g.naturalWidth||g.width,A=g.naturalHeight||g.height,B=x/R,X=v/A,j=Math.max(B,X),V=1+H/100,I=R*j*V,J=A*j*V,fe=(x-I)/2+Ve,de=(v-J)/2+Ue;if(b.drawImage(g,fe,de,I,J),l&&l.uploadImageTexture(C),Ie.current){const q=De.current,vt=Ze.current;l&&!vt.hasText&&l.drawImg({canvasW:q.canvasW,canvasH:q.canvasH,ps:q.ps,pcolor:q.pcolor,bgcolor:q.bgcolor},vt.imageOriginalColor);return}const{data:ie}=b.getImageData(0,0,x,v);if(h)return;be.current=new Uint8ClampedArray(ie),je.current={w:x,h:v};const re=ce.current;if(re&&!Ze.current.hasText){const q=++ve.current;re.postMessage({density:_,frequency:S,width:x,height:v,id:q,text:"",fontFamily:"system-ui",sources:E,draft:!1,imagePixels:be.current,imageWidth:x,imageHeight:v})}};if(nt.current===U&&ke.current)p(ke.current);else{const g=new Image;g.onload=()=>{ke.current=g,nt.current=U,p(g)},g.onerror=()=>{},g.src=U}return()=>{h=!0}},[U,H,Ve,Ue,x,v,xt,W,Ke,$]),c.useEffect(()=>{if(!Ke)return;const l=Z.current;if(!l)return;const h=De.current;l.drawImg({canvasW:h.canvasW,canvasH:h.canvasH,ps:h.ps,pcolor:h.pcolor,bgcolor:h.bgcolor},D)},[D,Ke]),c.useEffect(()=>{if(x===0||v===0)return;if(N&&!$){const p=be.current,g=je.current;return p&&g.w>0&&g.h>0&&(cancelAnimationFrame(te.current),te.current=requestAnimationFrame(()=>{const C=ce.current;if(!C)return;const b=++ve.current;C.postMessage({density:_,frequency:S,width:g.w,height:g.h,id:b,text:"",fontFamily:"system-ui",sources:E,draft:ue.current,imagePixels:p,imageWidth:g.w,imageHeight:g.h})})),()=>cancelAnimationFrame(te.current)}if(!$&&(W==="sphere"||W==="cube"||W==="flowfield"&&!z))return;const l=Z.current;if(!l)return;l.setViewScale(Oe);const h=De.current;if($){const p=nr(E);cancelAnimationFrame(te.current),te.current=requestAnimationFrame(()=>{const g=ce.current;if(!g)return;const C=++ve.current;ct.current={density:_,frequency:S,canvasW:x,canvasH:v,text:y,fontFamily:F,sourcesKey:p},g.postMessage({density:_,frequency:S,width:x,height:v,id:C,text:y,fontFamily:F,sources:E,draft:ue.current})})}else if(z&&!N){const p=be.current,g=je.current;p&&g.w>0&&g.h>0&&(cancelAnimationFrame(te.current),te.current=requestAnimationFrame(()=>{const C=ce.current;if(!C)return;const b=++ve.current;C.postMessage({density:_,frequency:S,width:x,height:v,id:b,text:"",fontFamily:"system-ui",sources:E,draft:ue.current,imagePixels:p,imageWidth:g.w,imageHeight:g.h})}))}else{oe<=0&&l.draw(h);const p=nr(E),{density:g,frequency:C,canvasW:b,canvasH:R,text:A,fontFamily:B,sourcesKey:X}=ct.current;(_!==g||x!==b||v!==R||y!==A||F!==B||p!==X||S!==C)&&(cancelAnimationFrame(te.current),te.current=requestAnimationFrame(()=>{const V=ce.current;if(!V)return;const I=++ve.current;ct.current={density:_,frequency:S,canvasW:x,canvasH:v,text:y,fontFamily:F,sourcesKey:p},V.postMessage({density:_,frequency:S,width:x,height:v,id:I,text:y,fontFamily:F,sources:E,draft:ue.current})}))}return()=>cancelAnimationFrame(te.current)},[_,S,x,v,P,M,L,y,F,E,Ne,$,z,N,s,f,W,ye,se,Rt,Oe,oe]);const Bt=c.useRef(0);c.useEffect(()=>{if($||z||N||W!=="chladni"||oe<=0)return;const l=Z.current;if(!l)return;let h=0,p=0,g=!0;const C=b=>{if(!g)return;const R=p?Math.min((b-p)/1e3,.05):0;p=b,Bt.current+=R;const A=t.current,B=Math.max(0,Math.min(100,A.vibration));l.drawVib(De.current,{t:Bt.current,amp:B/100,omega:B/100*Lo,area:mo(A.vibrationArea)}),h=requestAnimationFrame(C)};return h=requestAnimationFrame(C),()=>{g=!1,cancelAnimationFrame(h)}},[$,z,N,W,oe,t]),c.useEffect(()=>{if(W!=="sphere"||x===0||v===0||$)return;const l=Z.current;if(!l)return;const h=x/2,p=v/2,g=Math.min(x,v)/2;let C=0,b=0,R=!0;const A=B=>{if(!R)return;const X=C?Math.min((B-C)/1e3,.05):0;C=B;const j=t.current,V=j.rotationSpeed;V>0&&(Ct.current+=V*(Math.PI/4)*X);const I=Math.round(500+Je(j.density)*2/100*14500);if(!st.current||st.current.count!==I){const re=new Float32Array(I*3);for(let q=0;q<I*3;q++)re[q]=(Math.random()-.5)*2;st.current={buf:re,count:I}}const J=st.current.buf,fe=j.sphereSize/100*g*.85,de=j.organicAmount/100,ie=Mo(I,fe,h,p,Ct.current,J,de);l.upload(ie,I),l.drawText({canvasW:x,canvasH:v,ps:ae(j.particleSize,x,v),pcolor:j.particleColor,bgcolor:j.bgColor}),r(ie,I),b=requestAnimationFrame(A)};return b=requestAnimationFrame(A),()=>{R=!1,cancelAnimationFrame(b)}},[W,x,v,$,t,r,ae]),c.useEffect(()=>{if(W!=="cube"||x===0||v===0||$)return;const l=Z.current;if(!l)return;const h=x/2,p=v/2,g=Math.min(x,v)/2;let C=0,b=0,R=!0;const A=B=>{if(!R)return;const X=C?Math.min((B-C)/1e3,.05):0;C=B;const j=t.current,V=j.rotationSpeed;V>0&&(Pt.current+=V*(Math.PI/4)*X);const I=Math.round(500+Je(j.density)*2/100*14500);if(!lt.current||lt.current.count!==I){const re=new Float32Array(I*3);for(let q=0;q<I*3;q++)re[q]=(Math.random()-.5)*2;lt.current={buf:re,count:I}}const J=lt.current.buf,fe=j.sphereSize/100*g*.85,de=j.organicAmount/100,ie=ko(I,fe,h,p,Pt.current,J,de);l.upload(ie,I),l.drawText({canvasW:x,canvasH:v,ps:ae(j.particleSize,x,v),pcolor:j.particleColor,bgcolor:j.bgColor}),r(ie,I),b=requestAnimationFrame(A)};return b=requestAnimationFrame(A),()=>{R=!1,cancelAnimationFrame(b)}},[W,x,v,$,t,r,ae]),c.useEffect(()=>{var A;if(W!=="flowfield"||z){(A=Re.current)==null||A.dispose(),Re.current=null;return}if(x===0||v===0)return;const l=xe.current;if(!l)return;const h=ze(Math.min(x,v),Oe);let p=0,g=!1;const C=performance.now(),b=B=>{if(g)return;const X=Math.round(x*h),j=Math.round(v*h),V=mt.current;(V.w!==X||V.h!==j)&&(l.width=X,l.height=j,V.w=X,V.h=j);const[I,J,fe]=ir(M),[de,ie,re]=ir(L),q={density:_,particleSize:ae(P,x,v),zoom:Se/100,depth:Ae,waves:le,randomize:ge,waveSpeed:Y,rotation:Q*Math.PI/180,time:B,pr:I,pg:J,pb:fe,br:de,bg:ie,bb:re};if(!Re.current&&!at.current){const Me=To(l);Me?Re.current=Me:at.current=!0}if(Re.current)Re.current.draw(x,v,h,q);else{const Me=l.getContext("2d",{alpha:!1});if(!Me)return;Me.setTransform(h,0,0,h,0,0);const Zt=rt(_,x,v).n*3;let qe=ee.current;(!qe||qe.length<Zt)&&(qe=new Float32Array(Zt),ee.current=qe);const Mr=_o(Me,x,v,q,qe);r(qe,Mr);return}const Kt=rt(_,x,v).n*3;let Xe=ee.current;(!Xe||Xe.length<Kt)&&(Xe=new Float32Array(Kt),ee.current=Xe);const Fr=Y>0?4:1;if($e.current%Fr===0){const Me=yo(Xe,x,v,q);r(Xe,Me)}$e.current+=1},R=B=>{if(g)return;const X=Ye.current!==null?Ye.current.timeSec:(B-C)/1e3;b(X),Y>0&&(p=requestAnimationFrame(R))};return $e.current=0,Y>0?p=requestAnimationFrame(R):b(0),()=>{g=!0,p&&cancelAnimationFrame(p)}},[W,z,x,v,_,P,M,L,Se,Ae,le,ge,Y,Q,r,ae,Rt,Oe]);const br=c.useCallback(l=>{!z||N||(l.currentTarget.setPointerCapture(l.pointerId),Ie.current=!0,Vt(!0),Be.current={ox:l.clientX-Ve,oy:l.clientY-Ue})},[z,N,Ve,Ue]),wr=c.useCallback(l=>{Ie.current&&(Lt(l.clientX-Be.current.ox),Nt(l.clientY-Be.current.oy))},[]),Ot=c.useCallback(()=>{Ie.current&&(Ie.current=!1,Vt(!1))},[]),_r=c.useCallback((l,h)=>{l.preventDefault(),l.currentTarget.setPointerCapture(l.pointerId),ue.current=!0,We.current=h,Ft(!0)},[]),yr=c.useCallback((l,h,p,g)=>{if(!ue.current||We.current!==h)return;const C=Pe.current;if(!C)return;const b=C.getBoundingClientRect();if(b.width<=0||b.height<=0)return;let R=Math.max(0,Math.min(b.width,l.clientX-b.left)),A=Math.max(0,Math.min(b.height,l.clientY-b.top));const B=b.width/2,X=b.height/2,j=Math.abs(R-B)<=lr,V=Math.abs(A-X)<=lr;j&&(R=B),V&&(A=X),jt({x:j,y:V}),m(g?Fo(pt(R,b.width),pt(A,b.height)):p.map((I,J)=>J===h?{x:pt(R,b.width),y:pt(A,b.height)}:I))},[m]),Sr=c.useCallback(()=>{ue.current&&(ue.current=!1,We.current=-1,ct.current.sourcesKey="",Ft(!1),jt({x:!1,y:!1}))},[]),Ar=Hr(),Cr=Wr(),dt=_e?Cr:Ar,[Gt,Pr]=c.useState(null);c.useLayoutEffect(()=>{Pr((dt==null?void 0:dt.current)??null)},[dt]);const Fe=_e?Qe:0,Xt=a.jsxs(a.Fragment,{children:[Dt&&E.map((l,h)=>{const p=(l.x+1)/2,g=(l.y+1)/2,C=Fe>0?`calc(${Fe}px + ${p} * (100% - ${Fe*2}px))`:`${p*100}%`,b=Fe>0?`calc(${Fe}px + ${g} * (100% - ${Fe*2}px))`:`${g*100}%`,R=Ne&&We.current===h;return a.jsx("div",{onPointerDown:A=>_r(A,h),onPointerMove:A=>yr(A,h,E,G),onPointerUp:Sr,style:{position:"absolute",width:22,height:22,borderRadius:"50%",border:"1.5px solid #ffffff",background:"#000000",transform:"translate(-50%, -50%)",left:C,top:b,opacity:R?1:.75,cursor:R?"grabbing":"grab",touchAction:"none",pointerEvents:"auto",display:"flex",alignItems:"center",justifyContent:"center",transition:"opacity 0.15s",userSelect:"none",WebkitUserSelect:"none"},children:a.jsx("div",{style:{width:5,height:5,borderRadius:"50%",background:"#ffffff"}})},h)}),Ne&&Mt.y&&a.jsx("div",{style:{position:"absolute",left:0,right:0,top:"50%",height:1,background:"rgba(0,220,255,0.95)",boxShadow:"0 0 4px 1px rgba(0,220,255,0.6)",transform:"translateY(-50%)",pointerEvents:"none"}}),Ne&&Mt.x&&a.jsx("div",{style:{position:"absolute",top:0,bottom:0,left:"50%",width:1,background:"rgba(0,220,255,0.95)",boxShadow:"0 0 4px 1px rgba(0,220,255,0.6)",transform:"translateX(-50%)",pointerEvents:"none"}}),Dt&&a.jsx("button",{onClick:()=>d(!G),title:G?"Symmetry on · click to unlock":"Symmetry off · click to lock",style:{position:"absolute",top:8+Fe,right:8+Fe,width:28,height:28,borderRadius:8,background:"#000000",border:"1px solid #ffffff",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"auto",cursor:"pointer",opacity:G?1:.65,transition:"opacity 0.2s"},children:G?a.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:[a.jsx("rect",{x:"2",y:"5.5",width:"9",height:"6.5",rx:"1.5",fill:"#ffffff"}),a.jsx("path",{d:"M4 5.5V4a2.5 2.5 0 0 1 5 0v1.5",stroke:"#ffffff",strokeWidth:"1.4",strokeLinecap:"round"})]}):a.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 13 13",fill:"none",children:[a.jsx("rect",{x:"2",y:"5.5",width:"9",height:"6.5",rx:"1.5",fill:"#ffffff"}),a.jsx("path",{d:"M4 5.5V4a2.5 2.5 0 0 1 5 0",stroke:"#ffffff",strokeWidth:"1.4",strokeLinecap:"round"})]})}),we&&!_e&&Ut&&a.jsx("button",{onClick:()=>vr(l=>!l),title:"Toggle source handles",style:{position:"absolute",bottom:8,right:8,width:28,height:28,borderRadius:8,background:"#000000",border:"1px solid #ffffff",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"auto",cursor:"pointer",opacity:It?1:.65,transition:"opacity 0.2s"},children:a.jsxs("svg",{width:"15",height:"15",viewBox:"0 0 15 15",fill:"none",children:[a.jsx("circle",{cx:"7.5",cy:"7.5",r:"1.5",fill:"#ffffff"}),a.jsx("circle",{cx:"7.5",cy:"7.5",r:"4",stroke:"#ffffff",strokeWidth:"1.1"}),a.jsx("circle",{cx:"7.5",cy:"7.5",r:"6.5",stroke:"#ffffff",strokeWidth:"1"})]})})]}),Rr=!ut||gr||Ne,qt=ut?a.jsx("div",{style:{opacity:Rr?1:0,transition:"opacity 0.15s ease"},children:Xt}):Xt,Er=!!Gt,Tr=_e?a.jsx("div",{ref:it,className:"absolute pointer-events-none",style:{top:-Qe,left:-Qe,width:`calc(100% + ${Qe*2}px)`,height:`calc(100% + ${Qe*2}px)`},children:qt}):a.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none",children:a.jsx("div",{ref:it,className:"relative pointer-events-none",style:{width:x||void 0,height:v||void 0,borderRadius:"var(--radius)"},children:qt})}),Yt=a.jsx("div",{className:"absolute inset-0 pointer-events-none",style:{zIndex:Io},"data-particles-handles-layer":"",children:Tr});return a.jsxs("div",{className:_e?"relative z-10 h-full w-full overflow-visible rounded-[var(--radius)] shadow-[var(--elevation-md)]":"relative shadow-[var(--elevation-md)]",style:_e?{cursor:z&&!N?xt?"grabbing":"grab":void 0,touchAction:z&&!N?"none":void 0}:{width:x||void 0,height:v||void 0,borderRadius:"var(--radius)",display:"block",flexShrink:0,cursor:z&&!N?xt?"grabbing":"grab":void 0,touchAction:z&&!N?"none":void 0},onMouseEnter:()=>!we&&kt(!0),onMouseLeave:()=>!we&&kt(!1),onPointerDown:z&&!N?br:void 0,onPointerMove:z&&!N?wr:void 0,onPointerUp:z&&!N?Ot:void 0,onPointerCancel:z&&!N?Ot:void 0,children:[a.jsx("canvas",{ref:Pe,...Te?{}:{[er]:"",...N?{[Br]:""}:{}},style:{width:"100%",height:"100%",borderRadius:"var(--radius)",display:"block",opacity:Te?0:1,position:"relative",zIndex:0}}),a.jsx("canvas",{ref:xe,...Te?{[er]:""}:{},style:{position:"absolute",inset:0,width:"100%",height:"100%",borderRadius:"var(--radius)",display:"block",pointerEvents:"none",opacity:Te?1:0,zIndex:1}}),k&&a.jsx("div",{className:"absolute inset-0 flex items-center justify-center",style:{borderRadius:"var(--radius)",background:"rgba(0,0,0,0.55)",zIndex:10},children:a.jsxs("div",{className:"flex flex-col items-center gap-[10px]",children:[a.jsxs("p",{className:"text-white text-[13px] font-medium tracking-[-0.2px]",children:["Processing video ",T,"/60 frames"]}),a.jsx("div",{className:"w-[160px] h-[3px] rounded-full bg-white/20 overflow-hidden",children:a.jsx("div",{className:"h-full bg-white rounded-full transition-all",style:{width:`${T/60*100}%`}})})]})}),Er?yt.createPortal(Yt,Gt):Yt]})}function O({label:i,paramKey:t,value:e,onChange:o,min:r=0,max:n=100,step:s=1,unit:f="",helpId:m}){const d=(e-r)/(n-r)*100,{touch:u,beginDrag:k,endDrag:T}=ao(),_=io();return a.jsxs("div",{className:"flex flex-col gap-[2px] w-full","data-help-id":m,children:[a.jsxs("div",{className:"flex items-center justify-between w-full",children:[a.jsx(Kr,{label:i,paramKey:t}),a.jsx(Zr,{value:e,onCommit:S=>{o(S),u(t,S)},min:r,max:n,step:s,unit:f})]}),a.jsx("div",{className:"w-full px-2",children:a.jsxs("div",{className:"relative w-full py-[11px]",children:[a.jsxs("div",{className:"flex flex-col items-start justify-center pb-[2px] w-full",children:[a.jsx("div",{className:"bg-border h-[2px] mb-[-2px] rounded-[10px] w-full"}),a.jsx("div",{className:"bg-foreground h-[4px] mb-[-2px] rounded-[10px]",style:{width:`${d}%`}})]}),a.jsx("input",{type:"range",min:r,max:n,step:s,value:e,onChange:S=>{const P=Number(S.target.value);o(P),u(t,P)},onPointerDown:()=>{k(t),t&&_({paramKey:t,label:i,min:r,max:n})},onPointerUp:()=>T(t),onPointerCancel:()=>T(t),className:"peer absolute top-0 left-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing"}),a.jsx(Qr,{className:"absolute pointer-events-none",style:{left:`${d}%`,top:"50%",transform:"translate(-50%, -50%)"}})]})})]})}function cr({label:i,value:t,onChange:e}){return a.jsxs("div",{className:"flex flex-col gap-[8px] items-center",children:[a.jsx("label",{className:"text-muted-foreground text-center text-[12px] whitespace-nowrap",children:i}),a.jsx(so,{value:t,onChange:e,size:28})]})}function Vo({value:i,onChange:t}){const[e,o]=c.useState(!1),r=c.useRef(null),n=c.useRef(null),[s,f]=c.useState({top:0,left:0,width:160});return c.useEffect(()=>{var d;if(!e)return;const m=(d=r.current)==null?void 0:d.getBoundingClientRect();m&&f({top:m.bottom+4,left:Math.max(0,m.right-160),width:160})},[e]),c.useEffect(()=>{if(!e)return;const m=d=>{n.current&&!n.current.contains(d.target)&&r.current&&!r.current.contains(d.target)&&o(!1)};return document.addEventListener("mousedown",m),()=>document.removeEventListener("mousedown",m)},[e]),a.jsxs(a.Fragment,{children:[a.jsxs("button",{ref:r,onClick:()=>o(!e),className:"flex items-center gap-[4px] text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer",children:[a.jsx("span",{style:{fontFamily:i,fontSize:"13px"},children:"Aa"}),a.jsx("svg",{className:"w-3 h-3 shrink-0",viewBox:"0 0 16 16",fill:"none",children:a.jsx("path",{d:"M4 6L8 10L12 6",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]}),e&&yt.createPortal(a.jsx("div",{ref:n,className:"fixed z-[9999] bg-card border border-border rounded-lg shadow-lg overflow-y-auto max-h-[240px]",style:{top:s.top,left:s.left,width:s.width},children:Jr.map(m=>a.jsx("button",{onClick:()=>{t(m.value),o(!1)},className:`w-full text-left px-[12px] py-[8px] hover:bg-muted transition-colors cursor-pointer ${m.value===i?"bg-muted":""}`,children:a.jsx("span",{className:"text-foreground",style:{fontFamily:m.value,fontSize:"13px"},children:m.label})},m.value))}),document.body)]})}const _t=[{type:"chladni",label:"Chladni figures",icon:a.jsx("div",{className:"size-[16px]",children:a.jsxs("svg",{className:"block size-full",viewBox:"0 0 16 16",fill:"none",children:[a.jsx("ellipse",{cx:"8",cy:"8",rx:"6.5",ry:"3",stroke:"var(--foreground)",strokeWidth:"1.2"}),a.jsx("ellipse",{cx:"8",cy:"8",rx:"3",ry:"6.5",stroke:"var(--foreground)",strokeWidth:"1.2"}),a.jsx("circle",{cx:"8",cy:"8",r:"1",fill:"var(--foreground)"})]})})},{type:"sphere",label:"Sphere",icon:a.jsx("div",{className:"size-[16px]",children:a.jsxs("svg",{className:"block size-full",viewBox:"0 0 16 16",fill:"none",children:[a.jsx("circle",{cx:"8",cy:"8",r:"6",stroke:"var(--foreground)",strokeWidth:"1.2"}),a.jsx("ellipse",{cx:"8",cy:"8",rx:"6",ry:"2.5",stroke:"var(--foreground)",strokeWidth:"1.2"}),a.jsx("line",{x1:"8",y1:"2",x2:"8",y2:"14",stroke:"var(--foreground)",strokeWidth:"1.2"})]})})},{type:"cube",label:"Cube",icon:a.jsx("div",{className:"size-[16px]",children:a.jsxs("svg",{className:"block size-full",viewBox:"0 0 16 16",fill:"none",children:[a.jsx("path",{d:"M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z",stroke:"var(--foreground)",strokeWidth:"1.2",strokeLinejoin:"round"}),a.jsx("path",{d:"M8 2V8M8 8L2 5.5M8 8L14 5.5",stroke:"var(--foreground)",strokeWidth:"1.2",strokeLinejoin:"round"})]})})},{type:"flowfield",label:"Flow Waves",icon:a.jsx("div",{className:"size-[16px]",children:a.jsxs("svg",{className:"block size-full",viewBox:"0 0 16 16",fill:"none",children:[a.jsx("path",{d:"M1.5 5 Q5 2 8 5 T14.5 5",stroke:"var(--foreground)",strokeWidth:"1.2",strokeLinecap:"round"}),a.jsx("path",{d:"M1.5 8 Q5 5 8 8 T14.5 8",stroke:"var(--foreground)",strokeWidth:"1.2",strokeLinecap:"round"}),a.jsx("path",{d:"M1.5 11 Q5 8 8 11 T14.5 11",stroke:"var(--foreground)",strokeWidth:"1.2",strokeLinecap:"round"})]})})}];function Uo({value:i,onChange:t,onPreview:e}){const[o,r]=c.useState(!1),n=c.useRef(null),s=c.useRef(null),[f,m]=c.useState({top:0,left:0,width:0}),d=_t.find(u=>u.type===i)??_t[0];return c.useEffect(()=>{var T;if(!o)return;const u=(T=n.current)==null?void 0:T.getBoundingClientRect();if(!u)return;const k=Math.max(u.width,180);m({top:u.top,left:u.right+8,width:k}),requestAnimationFrame(()=>{const _=s.current;if(!_)return;const S=_.offsetHeight;let M=u.top+u.height/2-S/2;M=Math.max(8,Math.min(M,window.innerHeight-S-8)),m(L=>({...L,top:M}))})},[o]),c.useEffect(()=>{o||e(null)},[o,e]),c.useEffect(()=>{if(!o)return;const u=k=>{s.current&&!s.current.contains(k.target)&&n.current&&!n.current.contains(k.target)&&r(!1)};return document.addEventListener("mousedown",u),()=>document.removeEventListener("mousedown",u)},[o]),a.jsxs("div",{className:"flex flex-col gap-[2px] w-full",children:[a.jsxs("button",{ref:n,onClick:()=>r(u=>!u),className:"flex items-center justify-between w-full h-[34px] cursor-pointer",children:[a.jsxs("div",{className:"flex items-center gap-[8px]",children:[a.jsx("img",{src:"/Shape.svg",alt:"",width:16,height:16,className:"shrink-0 size-[16px] object-contain"}),a.jsx("span",{className:"text-[14px] font-medium text-foreground tracking-[-0.2px]",children:"Modes"})]}),a.jsxs("div",{className:"flex items-center gap-[4px]",children:[a.jsx("span",{className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px]",children:d.label}),a.jsx("svg",{className:"size-[16px] text-muted-foreground",viewBox:"0 0 16 16",fill:"none",children:a.jsx("path",{d:"M6 4L10 8L6 12",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]})]}),o&&yt.createPortal(a.jsx("div",{ref:s,className:"fixed z-[9999] bg-card border border-border rounded-[var(--radius-card)] shadow-lg overflow-hidden",style:{top:f.top,left:f.left,minWidth:f.width,maxHeight:"calc(100vh - 16px)"},onMouseLeave:()=>e(null),children:_t.map(u=>{const k=i===u.type;return a.jsxs("button",{onMouseEnter:()=>e(u.type),onClick:()=>{t(u.type),e(null),r(!1)},className:`w-full flex items-center justify-between px-[12px] py-[10px] hover:bg-muted transition-colors cursor-pointer ${k?"bg-muted":""}`,children:[a.jsx("div",{className:"flex items-center gap-[8px]",children:a.jsx("span",{className:"text-[14px] font-normal text-foreground tracking-[-0.2px]",children:u.label})}),k&&a.jsx("svg",{className:"size-[16px] flex-shrink-0 text-muted-foreground",viewBox:"0 0 16 16",fill:"none",children:a.jsx("path",{d:"M3 8L6.5 11.5L13 5",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]},u.type)})}),document.body)]})}function Do({text:i,fontFamily:t,onTextChange:e,onFontChange:o}){return a.jsxs("div",{className:"flex flex-col gap-[2px] w-full",children:[a.jsxs("div",{className:"flex items-center justify-between",children:[a.jsx("p",{className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px]",children:"Text"}),a.jsx("div",{"data-help-id":"particles.font",children:a.jsx(Vo,{value:t,onChange:o})})]}),a.jsx("textarea",{value:i,onChange:r=>e(r.target.value),placeholder:"Type to shape particles…",rows:3,"data-help-id":"particles.text",className:"w-full rounded-[var(--radius-button)] border border-border bg-transparent px-[10px] py-[7px] text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"})]})}function zo(){const{settings:i,handleDensityChange:t,handleFrequencyChange:e,handleParticleSizeChange:o,handleParticleColorChange:r,handleBgColorChange:n,handleTextChange:s,handleFontFamilyChange:f,handleImageSelect:m,handleImageClear:d,handleImageZoomChange:u,handleImageOriginalColorChange:k,handleVisualizationChange:T,handleVisualizationPreview:_,handleSphereSizeChange:S,handleRotationSpeedChange:P,handleOrganicAmountChange:M,handleFlowGridZoomChange:L,handleFlowDepthChange:y,handleFlowWavesChange:F,handleFlowRandomizeChange:E,handleFlowWaveSpeedChange:G,handleFlowRotationChange:U,handleVibrationChange:H,handleVibrationAreaChange:D,handleHandleXChange:K,handleHandleYChange:ye,resetToolControls:se}=ur(),me=fr("particles"),Se=me||Xr("particles"),Ae=qr(),{density:le,frequency:ge,particleSize:Y,particleColor:Q,bgColor:oe,text:Ce,fontFamily:W,sources:He,imageFileName:ot,imageSrc:Ye,imageZoom:Pe,imageOriginalColor:xe,visualization:ee,sphereSize:mt,rotationSpeed:Re,organicAmount:at,flowGridZoom:$e,flowDepth:Z,flowWaves:ce,flowRandomize:te,flowWaveSpeed:ve,flowRotation:ue,vibration:We,vibrationArea:it}=i,be=Math.round(Math.max(0,Math.min(100,(He[0].x+1)*100))),je=Math.round(Math.max(0,Math.min(100,(He[0].y+1)*100))),ke=Ce.trim().length>0,Be=!!Ye||me;return a.jsx(oo,{controls:a.jsx(no,{top:a.jsxs(a.Fragment,{children:[!Se&&a.jsxs("div",{className:"flex flex-col gap-[8px] w-full",children:[a.jsxs("div",{className:"flex items-center gap-[8px] h-[34px]",children:[a.jsx("img",{src:"/Upload.svg",alt:"",width:16,height:16,className:"shrink-0 size-[16px] object-contain"}),a.jsx("span",{className:"text-[14px] font-medium text-foreground tracking-[-0.2px]",children:"Upload file"})]}),a.jsx($r,{fileName:ot,accept:"image/*,.svg,video/mp4,video/quicktime,video/webm",onFileSelect:m,onClear:d,formats:"SVG, PNG, JPG, MP4, MOV",helpId:"particles.upload"})]}),!me&&a.jsx("div",{"data-help-id":"particles.styleSelector",children:a.jsx(Uo,{value:ee,onChange:T,onPreview:_})})]}),topInnerGapClass:"gap-[16px]",drawersTopMarginClass:"mt-[16px]",parameters:Be?a.jsxs("div",{className:"flex flex-col gap-[14px] w-full",children:[a.jsx(O,{label:"Density",paramKey:"density",value:le,onChange:t,min:1,max:100,step:1,helpId:"particles.density"}),a.jsx(O,{label:"Zoom",value:Pe,onChange:u,min:0,max:200,step:1,unit:"%",helpId:"particles.imageZoom"}),a.jsx(O,{label:"Particle Size",paramKey:"particleSize",value:Y,onChange:o,min:.5,max:5,step:.1,unit:"px",helpId:"particles.particleSize"})]}):ee==="chladni"?a.jsxs("div",{className:"flex flex-col gap-[14px] w-full",children:[a.jsxs("div",{style:{opacity:ke?.35:1,transition:"opacity 0.2s",pointerEvents:ke?"none":"auto"},className:"flex flex-col gap-[14px]",children:[a.jsx(O,{label:"Handle X",paramKey:"handleX",value:be,onChange:K,min:0,max:100,step:1,helpId:"particles.handleX"}),a.jsx(O,{label:"Handle Y",paramKey:"handleY",value:je,onChange:ye,min:0,max:100,step:1,helpId:"particles.handleY"}),a.jsx(O,{label:"Frequency",paramKey:"frequency",value:ge,onChange:e,min:1,max:20,step:.1,helpId:"particles.frequency"})]}),a.jsx(O,{label:"Density",paramKey:"density",value:le,onChange:t,min:1,max:100,step:1,helpId:"particles.density"}),a.jsx(O,{label:"Particle Size",paramKey:"particleSize",value:Y,onChange:o,min:.5,max:5,step:.1,unit:"px",helpId:"particles.particleSize"}),a.jsx(O,{label:"Vibration",paramKey:"vibration",value:We,onChange:H,min:0,max:100,step:1,unit:"%",helpId:"particles.vibration"}),a.jsx(O,{label:"Vibration Area",paramKey:"vibrationArea",value:it,onChange:D,min:0,max:100,step:1,unit:"%",helpId:"particles.vibrationArea"})]}):a.jsxs("div",{className:"flex flex-col gap-[14px] w-full",children:[a.jsx(O,{label:"Density",paramKey:"density",value:le,onChange:t,min:1,max:100,step:1,helpId:"particles.density"}),ee==="sphere"||ee==="cube"?a.jsxs(a.Fragment,{children:[a.jsx(O,{label:"Size",paramKey:"sphereSize",value:mt,onChange:S,min:10,max:100,step:1,helpId:"particles.sphereSize"}),a.jsx(O,{label:"Rotation Speed",paramKey:"rotationSpeed",value:Re,onChange:P,min:0,max:2,step:.1,helpId:"particles.rotationSpeed"})]}):null,(ee==="sphere"||ee==="cube")&&a.jsx(O,{label:"Organic",paramKey:"organicAmount",value:at,onChange:M,min:0,max:100,step:1,helpId:"particles.organicAmount"}),ee==="flowfield"&&a.jsxs(a.Fragment,{children:[a.jsx(O,{label:"Zoom",paramKey:"flowGridZoom",value:$e,onChange:L,min:100,max:200,step:1,unit:"%",helpId:"particles.flowGridZoom"}),a.jsx(O,{label:"Depth",paramKey:"flowDepth",value:Z,onChange:y,min:0,max:1e3,step:1,helpId:"particles.flowDepth"}),a.jsx(O,{label:"Waves",paramKey:"flowWaves",value:ce,onChange:F,min:0,max:300,step:1,helpId:"particles.flowWaves"}),a.jsx(O,{label:"Randomize",paramKey:"flowRandomize",value:te,onChange:E,min:0,max:1e3,step:1,helpId:"particles.flowRandomize"}),a.jsx(O,{label:"Wave Speed",paramKey:"flowWaveSpeed",value:ve,onChange:G,min:0,max:100,step:1,unit:"%",helpId:"particles.flowWaveSpeed"}),a.jsx(O,{label:"Rotation",paramKey:"flowRotation",value:ue,onChange:U,min:-180,max:180,step:1,unit:"°",helpId:"particles.flowRotation"})]}),a.jsx(O,{label:"Particle Size",paramKey:"particleSize",value:Y,onChange:o,min:.5,max:5,step:.1,unit:"px",helpId:"particles.particleSize"})]}),colors:a.jsxs("div",{className:"flex flex-col gap-[12px] w-full",children:[a.jsxs("div",{className:"flex items-start gap-[16px] w-full justify-start",children:[a.jsx("div",{"data-help-id":"particles.particleColor",children:a.jsx(cr,{label:"Particle",value:Q,onChange:r})}),a.jsx("div",{"data-help-id":"particles.bgColor",children:a.jsx(cr,{label:"Background",value:oe,onChange:n})})]}),Be&&a.jsxs("label",{className:"flex items-center gap-[8px] cursor-pointer select-none w-fit","data-help-id":"particles.originalColor",children:[a.jsx("input",{type:"checkbox",checked:xe,onChange:Ie=>k(Ie.target.checked),className:"sr-only"}),a.jsx("div",{className:"flex items-center justify-center rounded-[4px] border transition-colors shrink-0",style:{width:16,height:16,background:xe?"var(--foreground)":"transparent",borderColor:xe?"var(--foreground)":"#d0d3bc"},children:xe&&a.jsx("svg",{width:"10",height:"8",viewBox:"0 0 10 8",fill:"none",children:a.jsx("path",{d:"M1 4L3.5 6.5L9 1",stroke:"white",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})}),a.jsx("span",{className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px]",children:"Original color"})]})]}),text:Ae?null:a.jsx(Do,{text:Ce,fontFamily:W,onTextChange:s,onFontChange:f}),onResetAll:se,resetDisabled:Yr(i)})})}function Ho({className:i}){return a.jsxs("svg",{className:i||"size-5",viewBox:"0 0 20 20",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[a.jsx("circle",{cx:"4",cy:"4",r:"2",fill:"currentColor",opacity:"1"}),a.jsx("circle",{cx:"10",cy:"3",r:"1.5",fill:"currentColor",opacity:"0.7"}),a.jsx("circle",{cx:"16",cy:"6",r:"1",fill:"currentColor",opacity:"0.5"}),a.jsx("circle",{cx:"3",cy:"11",r:"1.5",fill:"currentColor",opacity:"0.6"}),a.jsx("circle",{cx:"9",cy:"9",r:"2.5",fill:"currentColor",opacity:"1"}),a.jsx("circle",{cx:"15",cy:"12",r:"2",fill:"currentColor",opacity:"0.8"}),a.jsx("circle",{cx:"6",cy:"16",r:"1",fill:"currentColor",opacity:"0.5"}),a.jsx("circle",{cx:"13",cy:"17",r:"1.5",fill:"currentColor",opacity:"0.7"}),a.jsx("circle",{cx:"17",cy:"16",r:"2",fill:"currentColor",opacity:"1"})]})}const Zo={id:"particles",name:"Particles",Icon:Ho,Canvas:No,Sidebar:zo,StateProvider:to,exportCapabilities:{canExportPNG:!0,canExportSVG:!0,canCopySVG:!0},useExportHandlers:eo};export{Zo as default};
