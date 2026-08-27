import{b$ as Ee,c0 as Re,bL as X,p as le,c1 as ke,a as ie,u as Me,b as Ae,bC as je,r as s,i as ae,t as k,f as De,ad as Ie,v as Fe,aL as Le,be as Ue,h as Ne,l as K,j as Oe,k as U,m as Be,q as c,bM as Te,c2 as He,d as Ve,ag as Ge,ah as We,c as Ke,ak as qe,Q as ze,bo as Xe,bp as Ye,U as $e,R as Je,Y as Ze,ai as Qe,aE as et,S as tt,G as ot,H as at}from"./index-CN-691Z9.js";import{u as rt,a as st,C as nt}from"./ControlsEffectsTabs-Dzh_Y3Uo.js";import{T as ct}from"./ToolControlsDrawerPanel-CT3VRW7t.js";import{a as lt}from"./ColorPicker-CiEMejDG.js";import"./BlockOpacitySlider-yaLZ_wDg.js";import"./Star.es-DFdc5VZK.js";const O={spectral:{mode:1,c1:"#d32146",c2:"#342b5a",c3:"#0171a2",c4:"#40f677",c5:"#daa54a"},blueamber:{mode:1,c1:"#000000",c2:"#163f43",c3:"#fd843d",c4:"#c31a27",c5:"#721f20"},amberInverted:{mode:1,c1:"#121a33",c2:"#010107",c3:"#2727ac",c4:"#ffbc20",c5:"#912525"},fire:{mode:1,c1:"#d7d2c2",c2:"#d3cebe",c3:"#d43b4b",c4:"#1c1a16",c5:"#6a2d35"},ocean:{mode:1,c1:"#010005",c2:"#000022",c3:"#213e76",c4:"#67e1f5",c5:"#b7c8d0"},neon:{mode:1,c1:"#ff88ff",c2:"#ff00ff",c3:"#8844ff",c4:"#00ffff",c5:"#000008"},sunset:{mode:1,c1:"#a35898",c2:"#68529c",c3:"#f64836",c4:"#f09738",c5:"#ff9106"},custom:{mode:1,c1:"#00001a",c2:"#2962ff",c3:"#40bcff",c4:"#ffb8b5",c5:"#ffc14f"}},h={speed:57,scale:2.2,warpDepth:3.1,octaves:1.5,bands:48,softBandEdges:!0,panX:0,panY:0,paletteKey:"amberInverted",customColor1:O.amberInverted.c1,customColor2:O.amberInverted.c2,customColor3:O.amberInverted.c3,customColor4:O.amberInverted.c4,customColor5:O.amberInverted.c5};function it(e){return e.speed===h.speed&&e.scale===h.scale&&e.warpDepth===h.warpDepth&&e.octaves===h.octaves&&e.bands===h.bands&&e.softBandEdges===h.softBandEdges&&e.panX===h.panX&&e.panY===h.panY&&e.paletteKey===h.paletteKey&&e.customColor1===h.customColor1&&e.customColor2===h.customColor2&&e.customColor3===h.customColor3&&e.customColor4===h.customColor4&&e.customColor5===h.customColor5}function q(e){const o=e.startsWith("#")?e.slice(1):e;if(o.length!==6)return[.02,.02,.04];const l=parseInt(o.slice(0,2),16)/255,u=parseInt(o.slice(2,4),16)/255,a=parseInt(o.slice(4,6),16)/255;return[l,u,a]}function ue(e){if(e.paletteKey==="custom")return[e.customColor1,e.customColor2,e.customColor3,e.customColor4,e.customColor5];const o=O[e.paletteKey]??O.amberInverted;return[o.c1,o.c2,o.c3,o.c4,o.c5]}function ut(e){const o=O[e.paletteKey],l=e.paletteKey==="custom",u=l?e.customColor1:o.c1,a=l?e.customColor2:o.c2,d=l?e.customColor3:o.c3,r=l?e.customColor4:o.c4,w=l?e.customColor5:o.c5;return{mode:o.mode,col1:q(u),col2:q(a),col3:q(d),col4:q(r),col5:q(w)}}const dt=30;function re(e,o,l){return new Promise((u,a)=>{var L;const d=MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")?"video/mp4;codecs=avc1":MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm",r=d.includes("mp4")?"mp4":"webm",w=(l==null?void 0:l.container)??null,S=l==null?void 0:l.effects,n=document.createElement("canvas"),v=document.createElement("canvas");let g=0;const j=Ee(w,e),{canvas:_,hasBakedWavesOrAberration:p}=j,m=_.width||e.width||1,x=_.height||e.height||1,b=Math.max(1,X/Math.min(m,x)),{width:M,height:y}=Re(Math.round(m*b),Math.round(x*b));n.width=M,n.height=y;const B=n.captureStream(0),A=B.getVideoTracks()[0],V=1e3/dt;let F=0;const T=Math.min(m,x),i=P=>{var E;if(P-F<V)return;F=P;const f=_.width,t=_.height;if(f<=0||t<=0)return;const I=n.getContext("2d");if(I.clearRect(0,0,M,y),!le(S))I.drawImage(_,0,0,M,y);else{(v.width!==f||v.height!==t)&&(v.width=f,v.height=t);const C=v.getContext("2d");C.drawImage(_,0,0),p?ke(C,f,t,S,T):ie(C,f,t,S,T),I.drawImage(v,0,0,M,y)}(E=A==null?void 0:A.requestFrame)==null||E.call(A)},D=P=>{i(P),g=requestAnimationFrame(D)};i(performance.now()),(L=A==null?void 0:A.requestFrame)==null||L.call(A);const N=new MediaRecorder(B,{mimeType:d,videoBitsPerSecond:24e6}),H=[];N.ondataavailable=P=>{P.data.size>0&&H.push(P.data)},N.onstop=()=>{cancelAnimationFrame(g),u({blob:new Blob(H,{type:d}),ext:r})},N.onerror=()=>{cancelAnimationFrame(g),a(new Error("Recording failed"))},N.start(),g=requestAnimationFrame(D),setTimeout(()=>N.stop(),o*1e3)})}const te=10;function ft(e){return e>1}function se(e,o,l=1){const u=e.width,a=e.height;if(u<=0||a<=0)return null;const d=Math.max(1,X/Math.min(u,a))*Math.max(1,l),r=Math.round(u*d),w=Math.round(a*d),S=document.createElement("canvas");S.width=r,S.height=w;const n=S.getContext("2d");return n?(n.drawImage(e,0,0,r,w),le(o)&&ie(n,r,w,o),S):null}function mt(e,o){const{checkPremiumAccess:l,openPremiumModal:u}=Me(),a=Ae(),d=je(),r=s.useCallback(()=>e.current,[e]),w=s.useCallback(p=>{const m=r();if(!m||m.width<=0||m.height<=0)return{width:X,height:X};const b=Math.max(1,X/Math.min(m.width,m.height))*Math.max(1,p);return{width:Math.round(m.width*b),height:Math.round(m.height*b)}},[r]),S=s.useCallback(()=>{const p=r();return p?ae(p,a):Promise.resolve(null)},[r,a]),n=s.useCallback(p=>{if(!l()){u("premium");return}const m=r();if(!m){k.error("No canvas to export");return}const x=se(m,a,p??1);if(!x){k.error("Export failed");return}x.toBlob(b=>{if(!b){k.error("Export failed");return}const M=URL.createObjectURL(b),y=document.createElement("a");y.href=M,y.download="shaders.png",y.click(),URL.revokeObjectURL(M),k.success("PNG downloaded!")},"image/png")},[l,u,r,a]),v=s.useCallback(p=>{if(!l()){u("premium");return}const m=r();if(!m){k.error("No canvas to export");return}const x=se(m,a,p??1);if(!x){k.error("Export failed");return}x.toBlob(b=>{if(!b){k.error("Export failed");return}const M=URL.createObjectURL(b),y=document.createElement("a");y.href=M,y.download="shaders.jpg",y.click(),URL.revokeObjectURL(M),k.success("JPEG downloaded!")},"image/jpeg",.92)},[l,u,r,a]),g=s.useCallback(async()=>{if(!l()){u("premium");return}const p=r();if(!p){k.error("Nothing to copy");return}const m=await ae(p,a);if(!m){k.error("Copy failed");return}try{await navigator.clipboard.write([new ClipboardItem({"image/png":m})]),k.success("Image copied to clipboard")}catch{k.error("Clipboard image not supported in this browser")}},[l,u,r,a]),j=s.useCallback(async p=>{if(!l()){u("premium");return}const m=r();if(!m){k.error("No canvas available");return}const x="shaders-video";k.loading(`Recording ${te}s…`,{id:x});try{const{blob:b}=await re(m,te,{container:d==null?void 0:d.current,effects:a});await De(b,{format:p,fileBase:"shaders",toastId:x}),k.success("Video downloaded!",{id:x})}catch{k.error("Recording failed",{id:x})}},[l,u,r,d,a]),_=s.useCallback(async()=>{const p=r();if(!p)return null;try{const{blob:m,ext:x}=await re(p,te,{container:d==null?void 0:d.current,effects:a});return new File([m],`shaders.${x}`,{type:m.type})}catch{return null}},[r,d,a]);return s.useMemo(()=>{const p=ft(o.speed);return{captureAsPNG:S,handleDownloadPNG:n,handleDownloadJPEG:v,handleCopySVG:g,captureVideoAsFile:_,handleDownloadMOV:()=>j("mov"),handleDownloadMP4:()=>j("mp4"),getExportDimensions:w,isAnimating:p,isVideoMode:!0}},[o.speed,S,_,n,v,g,j,w])}const de=s.createContext(null);function Y(){const e=s.useContext(de);if(!e)throw new Error("useShaders must be used within ShadersProvider");return e}function pt({children:e}){const o=Ie(),l=o!=null&&o.enabled?Fe("input","shaders"):null,u=Le(),[a,d]=Ue(u,()=>({settings:l?Te(l,{...h}):{...h}})),{settings:r}=a,w=s.useRef(null),S=mt(w,r);Ne(l,()=>He(r));const n=s.useCallback(i=>{d({settings:{...a.settings,...i}})},[a.settings,d]),v=s.useCallback(i=>n({speed:i}),[n]),g=s.useCallback(i=>n({scale:i}),[n]),j=s.useCallback(i=>n({warpDepth:i}),[n]),_=s.useCallback(i=>n({octaves:i}),[n]),p=s.useCallback(i=>n({bands:Math.max(1,Math.min(48,Math.round(i)))}),[n]),m=s.useCallback(i=>n({softBandEdges:i}),[n]),x=s.useCallback((i,D)=>n({panX:i,panY:D}),[n]),b=s.useCallback(i=>n({paletteKey:i}),[n]),M=s.useCallback((i,D)=>{const N=D.trim(),H=/^#?([0-9a-fA-F]{6})$/.exec(N),L=H?`#${H[1].toUpperCase()}`:D,P=ue(a.settings),f={paletteKey:"custom",customColor1:P[0],customColor2:P[1],customColor3:P[2],customColor4:P[3],customColor5:P[4]};i===1?f.customColor1=L:i===2?f.customColor2=L:i===3?f.customColor3=L:i===4?f.customColor4=L:f.customColor5=L,n(f)},[n,a.settings]),y=s.useCallback(()=>{d({settings:{...h}})},[d]),B=s.useCallback(i=>n({customColor1:K(i,a.settings.customColor1)}),[n,a.settings.customColor1]),A=s.useCallback(i=>n({customColor2:K(i,a.settings.customColor2)}),[n,a.settings.customColor2]),V=s.useCallback(i=>n({customColor3:K(i,a.settings.customColor3)}),[n,a.settings.customColor3]),F=s.useCallback(i=>n({customColor4:K(i,a.settings.customColor4)}),[n,a.settings.customColor4]),T=s.useCallback(i=>n({customColor5:K(i,a.settings.customColor5)}),[n,a.settings.customColor5]);return Oe(s.useMemo(()=>({speed:v,scale:g,warpDepth:j,octaves:_,bands:p,color_customColor1:B,color_customColor2:A,color_customColor3:V,color_customColor4:F,color_customColor5:T}),[v,g,j,_,p,B,A,V,F,T]),s.useMemo(()=>({speed:h.speed,scale:h.scale,warpDepth:h.warpDepth,octaves:h.octaves,bands:h.bands,color_customColor1:U(h.customColor1),color_customColor2:U(h.customColor2),color_customColor3:U(h.customColor3),color_customColor4:U(h.customColor4),color_customColor5:U(h.customColor5)}),[]),void 0,s.useMemo(()=>({speed:r.speed,scale:r.scale,warpDepth:r.warpDepth,octaves:r.octaves,bands:r.bands,color_customColor1:U(r.customColor1),color_customColor2:U(r.customColor2),color_customColor3:U(r.customColor3),color_customColor4:U(r.customColor4),color_customColor5:U(r.customColor5)}),[r.speed,r.scale,r.warpDepth,r.octaves,r.bands,r.customColor1,r.customColor2,r.customColor3,r.customColor4,r.customColor5])),Be(s.useMemo(()=>({paletteKey:i=>b(i)}),[b]),s.useMemo(()=>({paletteKey:h.paletteKey}),[])),c.jsx(de.Provider,{value:{settings:r,handleSpeedChange:v,handleScaleChange:g,handleWarpDepthChange:j,handleOctavesChange:_,handleBandsChange:p,handleSoftBandEdgesChange:m,handlePanChange:x,handlePaletteChange:b,handleCustomColorChange:M,shadersCanvasRef:w,exportHandlers:S,resetToolControls:y},children:e})}const ht=`#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`,Ct=`#version 300 es
precision highp float;

const float K_SHARP = 2.2;

uniform vec2  u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_scale;
uniform vec2  u_pan;
uniform vec2  u_seed;
uniform float u_warp;
uniform float u_oct;
uniform int   u_mode;   // 0 = spectral, 1 = custom 5-stop ramp
uniform float u_bands;  // 1 = smooth; >1 quantizes ramp (discrete bands)
uniform float u_softBands; // 1 = eased band edges; 0 = harsh floor quantization
uniform vec3  u_col1;
uniform vec3  u_col2;
uniform vec3  u_col3;
uniform vec3  u_col4;
uniform vec3  u_col5;

out vec4 outColor;

vec3 spectral_colour(float l) {
  float r = 0.0, g = 0.0, b = 0.0;
  if      (l >= 400.0 && l < 410.0) { float t = (l-400.0)/10.0;  r =  0.33*t - 0.20*t*t; }
  else if (l >= 410.0 && l < 475.0) { float t = (l-410.0)/65.0;  r =  0.14   - 0.13*t*t; }
  else if (l >= 545.0 && l < 595.0) { float t = (l-545.0)/50.0;  r =  1.98*t -      t*t; }
  else if (l >= 595.0 && l < 650.0) { float t = (l-595.0)/55.0;  r =  0.98 + 0.06*t - 0.40*t*t; }
  else if (l >= 650.0 && l < 700.0) { float t = (l-650.0)/50.0;  r =  0.65 - 0.84*t + 0.20*t*t; }
  if      (l >= 415.0 && l < 475.0) { float t = (l-415.0)/60.0;  g =  0.80*t*t; }
  else if (l >= 475.0 && l < 590.0) { float t = (l-475.0)/115.0; g =  0.8  + 0.76*t - 0.80*t*t; }
  else if (l >= 585.0 && l < 639.0) { float t = (l-585.0)/54.0;  g =  0.82 - 0.80*t; }
  if      (l >= 400.0 && l < 475.0) { float t = (l-400.0)/75.0;  b =  2.20*t - 1.50*t*t; }
  else if (l >= 475.0 && l < 560.0) { float t = (l-475.0)/85.0;  b =  0.7  -      t + 0.30*t*t; }
  return vec3(r, g, b);
}

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

// Fractional octaves: e.g. 2.5 = two full layers + half weight on the third.
float fbmOctFloat(vec2 p, float oct) {
  oct = clamp(oct, 1.0, 8.0);
  float v = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= oct) break;
    float layerW = min(1.0, oct - fi);
    v += amp * vnoise(p * freq) * layerW;
    amp *= 0.5;
    freq *= 2.13;
  }
  return v;
}

vec2 rot2(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

// Scalar field + anchored motion (see spectral_shader_anchored.html).
float warpFieldAnchored(vec2 p, float t, float w, float oct) {
  vec2 p1 = rot2(p, t * 0.07);
  vec2 q = vec2(
    fbmOctFloat(p1 + vec2(0.0, 0.0), oct),
    fbmOctFloat(p1 + vec2(5.2, 1.3), oct)
  );

  vec2 p2 = rot2(p + vec2(0.3, -0.2), -t * 0.11);
  vec2 r = vec2(
    fbmOctFloat(p2 + w * q + vec2(1.7, 9.2), oct),
    fbmOctFloat(p2 + w * q + vec2(8.3, 2.8), oct)
  );

  float radial = length(p) * 0.4;
  float pulse = sin(t * 0.13 + radial) * 0.3;

  vec2 p3 = rot2(p, t * 0.05 + 1.57);
  vec2 s = vec2(
    fbmOctFloat(p3 + w * r + vec2(3.1, 4.7), oct),
    fbmOctFloat(p3 + w * r + vec2(6.4, 0.9), oct)
  );

  float field = fbmOctFloat(p + w * s + pulse, oct);
  field += s.x * 0.3 + q.y * 0.15;
  return field;
}

float hardPosterizeCoord(float raw, float bandsCount) {
  if (bandsCount <= 1.0) return clamp(raw, 0.0, 1.0);
  float n1 = max(bandsCount - 1.0, 1e-5);
  float t = clamp(raw * n1, 0.0, n1);
  return floor(t + 1e-5) / n1;
}

// Soft staircase: edge width scales up when band count is low (less harsh fragmentation).
float smoothedPosterizeCoord(float raw, float bandsCount) {
  if (bandsCount <= 1.0) return clamp(raw, 0.0, 1.0);
  float nb = bandsCount;
  float n1 = max(nb - 1.0, 1e-5);
  float t = clamp(raw * n1, 0.0, n1);
  float fi = floor(t + 1e-6);
  float fr = clamp(t - fi, 0.0, 1.0);
  float blendW = clamp(4.4 / nb, 0.07, 0.39);
  blendW = min(blendW, 0.48);
  float frEased = smoothstep(blendW, 1.0 - blendW, fr);
  return clamp((fi + frEased) / n1, 0.0, 1.0);
}

// Field → [0,1] then optional band quantization, then 5-stop lerp (shadow → highlight).
vec3 quintColor(float f, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, float sharp, float bands) {
  float s = pow(abs(f), sharp) * sign(f) * 0.5 + 0.5;
  s = clamp(s, 0.0, 1.0);
  float nb = max(bands, 1.0);
  if (nb > 1.0) {
    s = u_softBands > 0.5 ? smoothedPosterizeCoord(s, nb) : hardPosterizeCoord(s, nb);
  }
  float x = s * 4.0;
  if (x >= 4.0) return c5;
  if (x < 1.0) return mix(c1, c2, x);
  if (x < 2.0) return mix(c2, c3, x - 1.0);
  if (x < 3.0) return mix(c3, c4, x - 2.0);
  return mix(c4, c5, x - 3.0);
}

void main() {
  // Uniform scale from center so min(width,height) matches legacy 1:1 framing scale;
  // long side sees more of the field — fills the frame with no empty bands.
  float m = min(u_res.x, u_res.y);
  vec2 d = gl_FragCoord.xy - 0.5 * u_res;
  vec2 uv0 = (2.0 * d) / m;

  uv0 *= u_scale;
  uv0 += u_pan;
  uv0 += (u_seed - 0.5) * 0.08;

  float t = u_time * u_speed;
  vec2 p = uv0 * 0.7 + (u_seed - 0.5) * 0.12;
  float raw = warpFieldAnchored(p, t, u_warp, u_oct);
  float f0 = tanh(raw * 1.25);
  float field = pow(max(abs(f0), 1e-5), 1.0 / K_SHARP) * sign(f0);

  vec3 col;
  if (u_mode == 0) {
    float lambda = field * 135.0 + 495.0 + sin(t * 0.11) * 6.5;
    lambda = clamp(lambda, 401.0, 698.999);
    float nb = max(u_bands, 1.0);
    if (nb > 1.0) {
      float norm = (lambda - 401.0) / 297.999;
      norm = clamp(norm, 0.0, 1.0);
      norm = u_softBands > 0.5 ? smoothedPosterizeCoord(norm, nb) : hardPosterizeCoord(norm, nb);
      lambda = norm * 297.999 + 401.0;
    }
    col = spectral_colour(lambda);
  } else {
    col = quintColor(field, u_col1, u_col2, u_col3, u_col4, u_col5, K_SHARP, u_bands);
  }

  outColor = vec4(col, 1.0);
}
`;function ne(e,o,l){const u=e.createShader(o);if(e.shaderSource(u,l),e.compileShader(u),!e.getShaderParameter(u,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(u)??"compile error");return u}function bt(e){const o=e.createProgram();if(e.attachShader(o,ne(e,e.VERTEX_SHADER,ht)),e.attachShader(o,ne(e,e.FRAGMENT_SHADER,Ct)),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(o)??"link error");return o}const ce={active:!1,pointerId:-1,startX:0,startY:0,panX:0,panY:0};function xt(){const{settings:e,handlePanChange:o,shadersCanvasRef:l}=Y(),{registerCanvas:u}=Ve(),{animatedValueRef:a,blockAnimatedValuesRef:d}=Ge(),r=We(),w=s.useRef(r);w.current=r;const{aspectRatio:S}=Ke(),n=qe(),v=ze(),g=v==null?void 0:v.preset,j=Xe(),_=Ye(),p=g?g.hostSizeForced?g.inputMinShortPx*_:Math.min(g.previewBackingCeilingShortPx,Math.max(g.inputMinShortPx,Math.round(g.inputMinShortPx*Math.max(1,j)*_))):1080,{width:m,height:x}=s.useMemo(()=>$e(S,p),[S,p]),b=s.useRef(null),M=s.useRef(null),y=s.useRef(null),B=s.useRef(0),A=s.useRef(performance.now()),V=s.useRef([Math.random(),Math.random()]),F=s.useRef(ce),T=Je(),i=s.useRef(T);i.current=T;const D=s.useRef(e);D.current=e;const N=s.useCallback(f=>{b.current=f,l.current=f},[l]),H=s.useCallback(f=>{if(f.button!==0)return;f.currentTarget.setPointerCapture(f.pointerId);const{panX:t,panY:I}=D.current;F.current={active:!0,pointerId:f.pointerId,startX:f.clientX,startY:f.clientY,panX:t,panY:I}},[]),L=s.useCallback(f=>{const t=F.current;if(!t.active||f.pointerId!==t.pointerId)return;const I=b.current;if(!I)return;const E=I.width,C=I.height;if(E<1||C<1)return;const G=D.current.scale,J=Math.min(E,C),Z=f.clientX-t.startX,Q=f.clientY-t.startY,$=2*G/J;o(t.panX-$*Z,t.panY+$*Q)},[o]),P=s.useCallback(f=>{const t=F.current;t.active&&f.pointerId===t.pointerId&&(F.current=ce)},[]);return s.useEffect(()=>{const f=b.current;if(f)return u(f),()=>u(null)},[u]),s.useEffect(()=>{const f=b.current;if(!f)return;const t=f.getContext("webgl2",{alpha:!1,antialias:!0,preserveDrawingBuffer:!0,powerPreference:"high-performance"});if(!t){console.warn("WebGL2 not available");return}M.current=t;try{const E=bt(t);y.current=E;const C=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,C),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),t.STATIC_DRAW);const G=t.getAttribLocation(E,"a_pos");t.enableVertexAttribArray(G),t.vertexAttribPointer(G,2,t.FLOAT,!1,0,0)}catch(E){console.error("Shader error:",E)}const I=()=>{const E=b.current,C=y.current;if(!E||!C)return;const{speed:G,scale:J,warpDepth:Z,octaves:Q,bands:$,softBandEdges:fe,panX:me,panY:pe}=D.current,R=ut(D.current),he=i.current!==null?i.current.timeSec:(performance.now()-A.current)/1e3,ee=Qe(w.current,a,d),W=(_e,ye)=>{var oe;return((oe=ee==null?void 0:ee.find(Pe=>Pe.key===_e))==null?void 0:oe.value)??ye},Ce=W("speed",G),be=W("scale",J),xe=W("warpDepth",Z),ve=W("octaves",Q),ge=W("bands",$);t.viewport(0,0,E.width,E.height),t.useProgram(C),t.uniform2f(t.getUniformLocation(C,"u_res"),E.width,E.height),t.uniform1f(t.getUniformLocation(C,"u_time"),he),t.uniform1f(t.getUniformLocation(C,"u_speed"),Ce/50),t.uniform1f(t.getUniformLocation(C,"u_scale"),be),t.uniform2f(t.getUniformLocation(C,"u_pan"),me,pe),t.uniform1f(t.getUniformLocation(C,"u_warp"),xe),t.uniform1f(t.getUniformLocation(C,"u_oct"),Math.min(8,Math.max(1,ve))),t.uniform1f(t.getUniformLocation(C,"u_bands"),Math.max(1,ge)),t.uniform1f(t.getUniformLocation(C,"u_softBands"),fe?1:0);const[we,Se]=V.current;t.uniform2f(t.getUniformLocation(C,"u_seed"),we,Se),t.uniform1i(t.getUniformLocation(C,"u_mode"),R.mode),t.uniform3f(t.getUniformLocation(C,"u_col1"),R.col1[0],R.col1[1],R.col1[2]),t.uniform3f(t.getUniformLocation(C,"u_col2"),R.col2[0],R.col2[1],R.col2[2]),t.uniform3f(t.getUniformLocation(C,"u_col3"),R.col3[0],R.col3[1],R.col3[2]),t.uniform3f(t.getUniformLocation(C,"u_col4"),R.col4[0],R.col4[1],R.col4[2]),t.uniform3f(t.getUniformLocation(C,"u_col5"),R.col5[0],R.col5[1],R.col5[2]),t.drawArrays(t.TRIANGLES,0,6),B.current=requestAnimationFrame(I)};return I(),()=>{cancelAnimationFrame(B.current),M.current=null,y.current=null}},[]),c.jsx("div",{className:"w-full h-full flex items-center justify-center",children:c.jsx("div",{className:"relative inline-block select-none touch-none cursor-grab active:cursor-grabbing",onPointerDown:H,onPointerMove:L,onPointerUp:P,onPointerCancel:P,children:c.jsx("canvas",{ref:N,width:m,height:x,style:n,className:"block",[Ze]:""})})})}function z({label:e,paramKey:o,value:l,onChange:u,min:a=0,max:d=100,step:r=1,unit:w="%",helpId:S}){const n=(l-a)/(d-a)*100,{touch:v,beginDrag:g,endDrag:j}=rt(),_=st();return c.jsxs("div",{className:"flex flex-col gap-[2px] w-full","data-help-id":S,children:[c.jsxs("div",{className:"flex items-center justify-between w-full",children:[c.jsx(tt,{label:e,paramKey:o}),c.jsx(ot,{value:l,onCommit:p=>{u(p),v(o,p)},min:a,max:d,step:r,unit:w})]}),c.jsx("div",{className:"relative w-full px-2",children:c.jsxs("div",{className:"py-[11px] relative w-full",children:[c.jsxs("div",{className:"relative w-full",children:[c.jsx("div",{className:"bg-border h-[2px] rounded-[10px] w-full"}),c.jsx("div",{className:"absolute bg-foreground h-[4px] left-0 top-0 rounded-[10px] transition-all",style:{width:`${n}%`}})]}),c.jsx("input",{type:"range",min:a,max:d,step:r,value:l,onChange:p=>{const m=Number(p.target.value);u(m),v(o,m)},onPointerDown:()=>{g(o),o&&_({paramKey:o,label:e,min:a,max:d})},onPointerUp:()=>j(o),onPointerCancel:()=>j(o),className:"peer absolute left-0 top-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing"}),c.jsx(at,{className:"absolute transition-all pointer-events-none",style:{left:`${n}%`,top:"50%",transform:"translate(-50%, -50%)"}})]})})]})}const vt=Object.entries(O);function gt(e){return e==="blueamber"?"Astral Fire":e==="fire"?"Dark Rose":e==="amberInverted"?"Amber inverted":e.charAt(0).toUpperCase()+e.slice(1)}function wt(){const{settings:e,handleSpeedChange:o,handleScaleChange:l,handleWarpDepthChange:u,handleOctavesChange:a,handleBandsChange:d,handleSoftBandEdgesChange:r}=Y();return c.jsxs("div",{className:"flex flex-col gap-[16px] w-full",children:[c.jsxs("div",{className:"flex items-center gap-[8px] w-full py-[4px]","data-help-id":"shaders.softBands",children:[c.jsx(et,{id:"shaders-soft-bands",checked:e.softBandEdges,onCheckedChange:r}),c.jsx("label",{htmlFor:"shaders-soft-bands",className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px] cursor-pointer",children:"Smooth bands"})]}),c.jsx(z,{label:"Warp depth",paramKey:"warpDepth",value:e.warpDepth,onChange:u,min:.5,max:6,step:.1,unit:"",helpId:"shaders.warpDepth"}),c.jsx(z,{label:"Complexity",paramKey:"octaves",value:e.octaves,onChange:a,min:1,max:6,step:.5,unit:"",helpId:"shaders.complexity"}),c.jsx(z,{label:"Bands",paramKey:"bands",value:e.bands,onChange:d,min:1,max:48,step:1,unit:"",helpId:"shaders.bands"}),c.jsx(z,{label:"Speed",paramKey:"speed",value:e.speed,onChange:o,helpId:"shaders.speed"}),c.jsx(z,{label:"Scale",paramKey:"scale",value:e.scale,onChange:l,min:.25,max:6,step:.05,unit:"x",helpId:"shaders.scale"})]})}function St(){const{settings:e,handlePaletteChange:o,handleCustomColorChange:l}=Y(),u=ue(e);return c.jsxs("div",{className:"flex flex-col gap-[16px] w-full",children:[c.jsxs("div",{className:"flex flex-col gap-[2px]","data-help-id":"shaders.palette",children:[c.jsx("p",{className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px]",children:"Color preset"}),c.jsx("select",{value:e.paletteKey,onChange:a=>o(a.target.value),className:"h-8 rounded-md border border-border bg-card px-2 text-[13px] text-foreground",children:vt.map(([a])=>c.jsx("option",{value:a,children:gt(a)},a))})]}),c.jsx("div",{className:"flex flex-row flex-wrap items-center gap-[12px] w-full","data-help-id":"shaders.customColors",children:u.map((a,d)=>c.jsx(lt,{value:a,onChange:r=>l(d+1,r),size:28},d))})]})}function _t(){const{settings:e,resetToolControls:o}=Y();return c.jsx(nt,{controls:c.jsx(ct,{parameters:c.jsx(wt,{}),colors:c.jsx(St,{}),onResetAll:o,resetDisabled:it(e)})})}function yt({className:e}){return c.jsxs("svg",{className:e||"size-5",viewBox:"0 0 20 20",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[c.jsx("defs",{children:c.jsxs("linearGradient",{id:"sg",x1:"0",y1:"0",x2:"20",y2:"20",gradientUnits:"userSpaceOnUse",children:[c.jsx("stop",{offset:"0%",stopColor:"currentColor",stopOpacity:"1"}),c.jsx("stop",{offset:"100%",stopColor:"currentColor",stopOpacity:"0.3"})]})}),c.jsx("rect",{x:"2",y:"2",width:"16",height:"16",rx:"3",fill:"url(#sg)"}),c.jsx("circle",{cx:"7",cy:"7",r:"2",fill:"currentColor",fillOpacity:"0.9"}),c.jsx("circle",{cx:"13",cy:"13",r:"2",fill:"currentColor",fillOpacity:"0.5"}),c.jsx("line",{x1:"2",y1:"14",x2:"8",y2:"6",stroke:"currentColor",strokeWidth:"1",strokeOpacity:"0.6"}),c.jsx("line",{x1:"12",y1:"4",x2:"18",y2:"16",stroke:"currentColor",strokeWidth:"1",strokeOpacity:"0.6"})]})}function Pt(){return Y().exportHandlers}const Dt={id:"shaders",name:"Shaders",Icon:yt,Canvas:xt,Sidebar:_t,StateProvider:pt,exportCapabilities:{canExportPNG:!0,canExportSVG:!1,canCopySVG:!0,copyBypassSvgEffectsGate:!0},useExportHandlers:Pt};export{Dt as default};
