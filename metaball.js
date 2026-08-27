import{ad as ge,v as ve,aL as Te,be as Re,h as ye,r as n,l as Q,j as Ee,k as B,m as Se,i as we,bL as re,t as Y,q as l,bM as ke,dO as Be,d as je,ak as Me,Q as _e,bo as De,bp as Pe,R as Fe,Y as Ie,bx as Ae,bg as Ne,bh as Ue,bk as Oe,bl as Le,bm as He,S as ze,G as Xe,H as Ge}from"./index-CN-691Z9.js";import{C as Ve,u as Ke,a as We}from"./ControlsEffectsTabs-Dzh_Y3Uo.js";import{T as Ye}from"./ToolControlsDrawerPanel-CT3VRW7t.js";import{a as $e}from"./ColorPicker-CiEMejDG.js";import"./BlockOpacitySlider-yaLZ_wDg.js";import"./Star.es-DFdc5VZK.js";const qe=[{value:0,label:"Full (X + Y)"},{value:1,label:"Vertical only"},{value:2,label:"Horizontal only"},{value:3,label:"None"}],_={thermal:{label:"Thermal",c0:"#0C0406",c1:"#121C36",c2:"#325B58",c3:"#DBC99E",c4:"#F7660E",c5:"#E01107"},glacier:{label:"Dark Glacier",c0:"#010103",c1:"#1e2446",c2:"#2d3775",c3:"#2f3771",c4:"#7ca5b6",c5:"#e1efef"},coral:{label:"Astral Fire",c0:"#0f1418",c1:"#191b20",c2:"#0d383c",c3:"#6f6d5e",c4:"#fb843d",c5:"#8c1c25"},nebula:{label:"Beach Day",c0:"#001f91",c1:"#44afee",c2:"#dfffff",c3:"#fda953",c4:"#ca4e27",c5:"#df4e12"},solar:{label:"Sunset",c0:"#a9579a",c1:"#614c97",c2:"#bc6c76",c3:"#cd6a5c",c4:"#f63a31",c5:"#ff910b"}},Je=[...Object.entries(_).map(([e,t])=>({key:e,label:t.label})),{key:"custom",label:"Custom"}],h={cols:6,rows:6,sym:1,speed:1.23,variance:1,baseRadius:.5,softness:1.07,coreSize:.4,coreBrightness:.7,contrast:1.58,brightness:1.38,bgDark:0,bloomThreshold:1,bloomIntensity:0,playing:!0,seedOffset:0,paletteKey:"thermal",customColor0:_.thermal.c0,customColor1:_.thermal.c1,customColor2:_.thermal.c2,customColor3:_.thermal.c3,customColor4:_.thermal.c4,customColor5:_.thermal.c5};function Qe(e){const t=h;return e.cols===t.cols&&e.rows===t.rows&&e.sym===t.sym&&e.speed===t.speed&&e.variance===t.variance&&e.baseRadius===t.baseRadius&&e.softness===t.softness&&e.coreSize===t.coreSize&&e.coreBrightness===t.coreBrightness&&e.contrast===t.contrast&&e.brightness===t.brightness&&e.bgDark===t.bgDark&&e.bloomThreshold===t.bloomThreshold&&e.bloomIntensity===t.bloomIntensity&&e.playing===t.playing&&e.seedOffset===t.seedOffset&&e.paletteKey===t.paletteKey&&e.customColor0===t.customColor0&&e.customColor1===t.customColor1&&e.customColor2===t.customColor2&&e.customColor3===t.customColor3&&e.customColor4===t.customColor4&&e.customColor5===t.customColor5}function Z(e){const t=e.startsWith("#")?e.slice(1):e;if(t.length!==6)return[.02,.02,.04];const u=parseInt(t.slice(0,2),16)/255,i=parseInt(t.slice(2,4),16)/255,c=parseInt(t.slice(4,6),16)/255;return[u,i,c]}function pe(e){if(e.paletteKey==="custom")return[e.customColor0,e.customColor1,e.customColor2,e.customColor3,e.customColor4,e.customColor5];const t=_[e.paletteKey]??_.thermal;return[t.c0,t.c1,t.c2,t.c3,t.c4,t.c5]}function Ze(e){const t=e.paletteKey==="custom",u=t?null:_[e.paletteKey]??_.thermal,i=t?e.customColor0:u.c0,c=t?e.customColor1:u.c1,m=t?e.customColor2:u.c2,a=t?e.customColor3:u.c3,r=t?e.customColor4:u.c4,v=t?e.customColor5:u.c5;return{c0:Z(i),c1:Z(c),c2:Z(m),c3:Z(a),c4:Z(r),c5:Z(v)}}const xe=n.createContext(null);function ae(){const e=n.useContext(xe);if(!e)throw new Error("useMetaball must be inside MetaballProvider");return e}function eo({children:e}){const t=ge(),u=t!=null&&t.enabled?ve("input","metaball"):null,i=Te(),[c,m]=Re(i,()=>({settings:u?ke(u,{...h}):{...h}})),{settings:a}=c;ye(u,()=>Be(a));const r=n.useCallback(s=>{m({settings:{...c.settings,...s}})},[c.settings,m]),v=n.useCallback(s=>r({cols:Math.round(s)}),[r]),D=n.useCallback(s=>r({rows:Math.round(s)}),[r]),A=n.useCallback(s=>r({sym:s}),[r]),y=n.useCallback(s=>r({speed:s}),[r]),g=n.useCallback(s=>r({variance:s}),[r]),P=n.useCallback(s=>r({baseRadius:s}),[r]),X=n.useCallback(s=>r({softness:s}),[r]),j=n.useCallback(s=>r({coreSize:s}),[r]),f=n.useCallback(s=>r({coreBrightness:s}),[r]),o=n.useCallback(s=>r({contrast:s}),[r]),N=n.useCallback(s=>r({brightness:s}),[r]),E=n.useCallback(s=>r({bgDark:s}),[r]),T=n.useCallback(s=>r({bloomThreshold:s}),[r]),U=n.useCallback(s=>r({bloomIntensity:s}),[r]),C=n.useCallback(()=>{r({playing:!c.settings.playing})},[r,c.settings.playing]),ee=n.useCallback(()=>{r({seedOffset:Math.random()*1e3})},[r]),O=n.useCallback(s=>r({paletteKey:s}),[r]),J=n.useCallback((s,p)=>{const W=p.trim(),M=/^#?([0-9a-fA-F]{6})$/.exec(W),k=M?`#${M[1].toUpperCase()}`:p,x=pe(c.settings),R={paletteKey:"custom",customColor0:x[0],customColor1:x[1],customColor2:x[2],customColor3:x[3],customColor4:x[4],customColor5:x[5]};s===0?R.customColor0=k:s===1?R.customColor1=k:s===2?R.customColor2=k:s===3?R.customColor3=k:s===4?R.customColor4=k:R.customColor5=k,r(R)},[r,c.settings]),L=n.useCallback(()=>{m({settings:{...h}})},[m]),F=n.useCallback(s=>r({customColor0:Q(s,c.settings.customColor0)}),[r,c.settings.customColor0]),S=n.useCallback(s=>r({customColor1:Q(s,c.settings.customColor1)}),[r,c.settings.customColor1]),w=n.useCallback(s=>r({customColor2:Q(s,c.settings.customColor2)}),[r,c.settings.customColor2]),G=n.useCallback(s=>r({customColor3:Q(s,c.settings.customColor3)}),[r,c.settings.customColor3]),q=n.useCallback(s=>r({customColor4:Q(s,c.settings.customColor4)}),[r,c.settings.customColor4]),V=n.useCallback(s=>r({customColor5:Q(s,c.settings.customColor5)}),[r,c.settings.customColor5]);Ee(n.useMemo(()=>({cols:v,rows:D,speed:y,variance:g,baseRadius:P,softness:X,coreSize:j,coreBrightness:f,contrast:o,brightness:N,bgDark:E,bloomThreshold:T,bloomIntensity:U,color_customColor0:F,color_customColor1:S,color_customColor2:w,color_customColor3:G,color_customColor4:q,color_customColor5:V}),[v,D,y,g,P,X,j,f,o,N,E,T,U,F,S,w,G,q,V]),n.useMemo(()=>({cols:h.cols,rows:h.rows,speed:h.speed,variance:h.variance,baseRadius:h.baseRadius,softness:h.softness,coreSize:h.coreSize,coreBrightness:h.coreBrightness,contrast:h.contrast,brightness:h.brightness,bgDark:h.bgDark,bloomThreshold:h.bloomThreshold,bloomIntensity:h.bloomIntensity,color_customColor0:B(h.customColor0),color_customColor1:B(h.customColor1),color_customColor2:B(h.customColor2),color_customColor3:B(h.customColor3),color_customColor4:B(h.customColor4),color_customColor5:B(h.customColor5)}),[]),void 0,n.useMemo(()=>({cols:a.cols,rows:a.rows,speed:a.speed,variance:a.variance,baseRadius:a.baseRadius,softness:a.softness,coreSize:a.coreSize,coreBrightness:a.coreBrightness,contrast:a.contrast,brightness:a.brightness,bgDark:a.bgDark,bloomThreshold:a.bloomThreshold,bloomIntensity:a.bloomIntensity,color_customColor0:B(a.customColor0),color_customColor1:B(a.customColor1),color_customColor2:B(a.customColor2),color_customColor3:B(a.customColor3),color_customColor4:B(a.customColor4),color_customColor5:B(a.customColor5)}),[a.cols,a.rows,a.speed,a.variance,a.baseRadius,a.softness,a.coreSize,a.coreBrightness,a.contrast,a.brightness,a.bgDark,a.bloomThreshold,a.bloomIntensity,a.customColor0,a.customColor1,a.customColor2,a.customColor3,a.customColor4,a.customColor5])),Se(n.useMemo(()=>({paletteKey:s=>O(s)}),[O]),n.useMemo(()=>({paletteKey:h.paletteKey}),[]));const I=n.useRef(null),de=n.useCallback(s=>{I.current=s},[]),K=n.useCallback(()=>{const s=I.current;return s?we(s,null):Promise.resolve(null)},[]),oe=n.useCallback((s=1)=>{const p=I.current;if(!p||p.width<=0||p.height<=0)return{width:re,height:re};const M=Math.max(1,re/Math.min(p.width,p.height))*Math.max(1,s);return{width:Math.round(p.width*M),height:Math.round(p.height*M)}},[]),H=n.useCallback((s=1)=>{const p=I.current;if(!p){Y.error("No canvas to export");return}const W=p.width,M=p.height,k=Math.max(1,re/Math.min(W,M))*Math.max(1,s),x=document.createElement("canvas");x.width=Math.round(W*k),x.height=Math.round(M*k);const R=x.getContext("2d");if(!R){Y.error("Export failed");return}R.drawImage(p,0,0,x.width,x.height),x.toBlob(se=>{if(!se){Y.error("Export failed");return}const z=document.createElement("a");z.href=URL.createObjectURL(se),z.download="metaball.png",z.click(),URL.revokeObjectURL(z.href),Y.success("PNG downloaded!")},"image/png")},[]),d=n.useCallback((s=1)=>{const p=I.current;if(!p){Y.error("No canvas to export");return}const W=p.width,M=p.height,k=Math.max(1,re/Math.min(W,M))*Math.max(1,s),x=document.createElement("canvas");x.width=Math.round(W*k),x.height=Math.round(M*k);const R=x.getContext("2d");if(!R){Y.error("Export failed");return}R.drawImage(p,0,0,x.width,x.height),x.toBlob(se=>{if(!se){Y.error("Export failed");return}const z=document.createElement("a");z.href=URL.createObjectURL(se),z.download="metaball.jpg",z.click(),URL.revokeObjectURL(z.href),Y.success("JPEG downloaded!")},"image/jpeg",.92)},[]),le=n.useCallback(()=>{},[]),b=n.useCallback(()=>{},[]),te=a.playing&&a.speed>0,ne=n.useMemo(()=>({captureAsPNG:K,handleDownloadPNG:H,handleDownloadJPEG:d,handleDownloadMOV:le,handleDownloadMP4:b,getExportDimensions:oe,isAnimating:te,isVideoMode:!0}),[te,K,le,b,H,d,oe]);return l.jsx(xe.Provider,{value:{settings:a,handleColsChange:v,handleRowsChange:D,handleSymChange:A,handleSpeedChange:y,handleVarianceChange:g,handleBaseRadiusChange:P,handleSoftnessChange:X,handleCoreSizeChange:j,handleCoreBrightnessChange:f,handleContrastChange:o,handleBrightnessChange:N,handleBgDarkChange:E,handleBloomThresholdChange:T,handleBloomIntensityChange:U,handleTogglePlaying:C,handleReseed:ee,handlePaletteChange:O,handleCustomColorChange:J,handleCanvasReady:de,resetToolControls:L,exportHandlers:ne},children:e})}function oo(){return ae().exportHandlers}const ce=`#version 300 es
void main(){
  vec2 pos = vec2(-1.0,-1.0);
  if(gl_VertexID == 1) pos = vec2(3.0,-1.0);
  if(gl_VertexID == 2) pos = vec2(-1.0,3.0);
  gl_Position = vec4(pos, 0.0, 1.0);
}`,to=`#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uResolution;
uniform float uTime;
uniform float uCols;
uniform float uRows;
uniform float uBaseRadius;
uniform float uSoftness;
uniform float uVariance;
uniform float uSpeed;
uniform float uContrast;
uniform float uBrightness;
uniform float uCoreBrightness;
uniform float uCoreSize;
uniform float uSym;       // 0 full, 1 vertical, 2 horizontal, 3 none
uniform float uBgDark;
uniform float uSeedOffset;
uniform vec3  uC0;
uniform vec3  uC1;
uniform vec3  uC2;
uniform vec3  uC3;
uniform vec3  uC4;
uniform vec3  uC5;

float hash21(vec2 p){
  p = fract(p*vec2(123.45,678.91));
  p += dot(p,p+34.56);
  return fract(p.x*p.y);
}

float baseRadiusNorm(float baseRadius, float cellH, float coreBrightness){
  float b = baseRadius*cellH*0.5;
  // (1+coreBrightness) matches the combined halo+core peak at blob center.
  // Factor 1.3 targets t≈0.85 for an isolated blob -> sits in high-orange zone.
  return max(b*b*1.3*(1.0+coreBrightness), 0.00001);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2((uv.x-0.5)*aspect, uv.y-0.5);

  float C = uCols;
  float R = uRows;
  float cellH = 1.0 / R;

  float field = 0.0;

  for(int ii=0; ii<32; ii++){
    float i = float(ii);
    if(i >= C) break;
    for(int jj=0; jj<32; jj++){
      float j = float(jj);
      if(j >= R) break;

      // Mirroring the SEED index (not the geometry) gives perfect axial
      // symmetry: opposite cells animate identically, but each cell still
      // renders at its own true position.
      float mi = i;
      float mj = j;
      if(uSym < 0.5){ mi = min(i, C-1.0-i); mj = min(j, R-1.0-j); }
      else if(uSym < 1.5){ mi = min(i, C-1.0-i); }
      else if(uSym < 2.5){ mj = min(j, R-1.0-j); }

      float seed = mi*53.0 + mj*17.0 + uSeedOffset;
      float phase = hash21(vec2(seed, seed*0.37)) * 6.2831853;

      float baseR = uBaseRadius*cellH*0.5;
      float r = baseR + uVariance*baseR*0.5*( sin(uTime*uSpeed+phase) + 0.5*sin(uTime*uSpeed*1.7 + phase*1.3) );
      r = max(r, 0.0001);

      float cx = ((i+0.5)/C - 0.5)*aspect;
      float cy = (j+0.5)/R - 0.5;
      float dx = p.x-cx;
      float dy = p.y-cy;
      float d2 = dx*dx + dy*dy;

      // Wide halo: r^2 weighting keeps larger blobs dominant during merging.
      float sigma = max(r*uSoftness, 0.0005);
      field += (r*r) * exp(-d2/(2.0*sigma*sigma));

      // Tight core feeds into the field scalar (not a separate color layer),
      // pushing the heatmap toward the hot end at each blob center.
      float coreSigma = max(sigma*uCoreSize, 0.0003);
      field += uCoreBrightness * (r*r) * exp(-d2/(2.0*coreSigma*coreSigma));
    }
  }

  // Calibrated so an isolated blob at rest maps to t≈0.85 (high orange).
  // Overlapping blobs push past 1.0 -> clamped to deep red — the additive
  // saturation that produces the gooey merge in the heatmap colors.
  float norm = baseRadiusNorm(uBaseRadius, cellH, uCoreBrightness);
  float t = clamp((field*uBrightness) / norm, 0.0, 1.0);
  t = pow(t, uContrast);

  // 6-stop LUT (background -> halo -> mid -> warm -> hot -> core), driven by
  // the active palette/custom colors. No white — the colormap itself drives
  // all perceived brightness.
  vec3 col;
  if(t < 0.12)      col = mix(uC0,uC1, t/0.12);
  else if(t < 0.36) col = mix(uC1,uC2, (t-0.12)/0.24);
  else if(t < 0.55) col = mix(uC2,uC3, (t-0.36)/0.19);
  else if(t < 0.78) col = mix(uC3,uC4, (t-0.55)/0.23);
  else              col = mix(uC4,uC5, (t-0.78)/0.22);

  outColor = vec4(col,1.0);
}`,so=`#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uThreshold;
void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 c = texture(uTex, uv).rgb;
  float lum = dot(c, vec3(0.299,0.587,0.114));
  float k = smoothstep(uThreshold, uThreshold+0.25, lum);
  outColor = vec4(c*k, 1.0);
}`,ro=`#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uDir;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  float w[5];
  w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
  vec3 sum = texture(uTex, uv).rgb * w[0];
  for(int k=1;k<5;k++){
    vec2 o = uDir*uTexel*float(k)*1.5;
    sum += texture(uTex, uv+o).rgb * w[k];
    sum += texture(uTex, uv-o).rgb * w[k];
  }
  outColor = vec4(sum,1.0);
}`,ao=`#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uBloomIntensity;
void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 base = texture(uBase, uv).rgb;
  vec3 bloom = texture(uBloom, uv).rgb;
  vec3 col = base + bloom*uBloomIntensity;
  col = col/(1.0+col*0.25);
  outColor = vec4(col,1.0);
}`;function Ce(e,t,u){const i=e.createShader(t);return e.shaderSource(i,u),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)||console.error("[Metaball] shader compile error:",e.getShaderInfoLog(i)),i}function ue(e,t,u){const i=Ce(e,e.VERTEX_SHADER,t),c=Ce(e,e.FRAGMENT_SHADER,u),m=e.createProgram();return e.attachShader(m,i),e.attachShader(m,c),e.linkProgram(m),e.getProgramParameter(m,e.LINK_STATUS)||console.error("[Metaball] program link error:",e.getProgramInfoLog(m)),m}function ie(e,t,u){const i={};for(const c of u)i[c]=e.getUniformLocation(t,c);return i}function me(e,t,u){const i=e.createTexture();e.bindTexture(e.TEXTURE_2D,i),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,u,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const c=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,c),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,i,0),e.bindFramebuffer(e.FRAMEBUFFER,null),{fbo:c,tex:i}}function fe(e,t){t&&(e.deleteFramebuffer(t.fbo),e.deleteTexture(t.tex))}function lo(){var j;const{settings:e,handleCanvasReady:t}=ae(),{registerCanvas:u}=je(),i=Me(),c=((j=_e())==null?void 0:j.preset.inputMinShortPx)??1080,m=De(),a=Pe(),r=n.useRef(null),v=n.useRef(0),D=n.useRef(e);D.current=e;const A=Fe(),y=n.useRef(A);y.current=A;const g=n.useRef(performance.now()),P=n.useRef(0);n.useEffect(()=>{const f=r.current;if(f)return t(f),u(f),()=>u(null)},[t,u]);const X=n.useCallback(()=>{const f=r.current;if(!f)return;f.width<1&&(f.width=960),f.height<1&&(f.height=960);const o=f.getContext("webgl2",{antialias:!1,alpha:!1,preserveDrawingBuffer:!0,powerPreference:"high-performance"});if(!o){console.error("[Metaball] WebGL2 not available");return}const N=ue(o,ce,to),E=ue(o,ce,so),T=ue(o,ce,ro),U=ue(o,ce,ao),C=ie(o,N,["uResolution","uTime","uCols","uRows","uBaseRadius","uSoftness","uVariance","uSpeed","uContrast","uBrightness","uCoreBrightness","uCoreSize","uSym","uBgDark","uSeedOffset","uC0","uC1","uC2","uC3","uC4","uC5"]),ee=ie(o,E,["uTex","uResolution","uThreshold"]),O=ie(o,T,["uTex","uTexel","uDir"]),J=ie(o,U,["uBase","uBloom","uResolution","uBloomIntensity"]);o.disable(o.DEPTH_TEST),o.disable(o.BLEND);let L=0,F=0,S=0,w=0,G=null,q=null,V=null,I=null;const de=()=>{const H=f.width,d=f.height;H===L&&d===F||(L=H,F=d,S=Math.max(1,Math.floor(H/2)),w=Math.max(1,Math.floor(d/2)),fe(o,G),fe(o,q),fe(o,V),fe(o,I),G=me(o,L,F),q=me(o,S,w),V=me(o,S,w),I=me(o,S,w))},K=()=>o.drawArrays(o.TRIANGLES,0,3),oe=H=>{if(!r.current)return;de();const d=D.current,le=(H-g.current)/1e3;g.current=H,y.current!==null?P.current=y.current.timeSec:d.playing&&(P.current+=le),o.bindFramebuffer(o.FRAMEBUFFER,G.fbo),o.viewport(0,0,L,F),o.useProgram(N),o.uniform2f(C.uResolution,L,F),o.uniform1f(C.uTime,P.current),o.uniform1f(C.uCols,d.cols),o.uniform1f(C.uRows,d.rows),o.uniform1f(C.uBaseRadius,d.baseRadius),o.uniform1f(C.uSoftness,d.softness),o.uniform1f(C.uVariance,d.variance),o.uniform1f(C.uSpeed,d.speed),o.uniform1f(C.uContrast,d.contrast),o.uniform1f(C.uBrightness,d.brightness),o.uniform1f(C.uCoreBrightness,d.coreBrightness),o.uniform1f(C.uCoreSize,d.coreSize),o.uniform1f(C.uSym,d.sym),o.uniform1f(C.uBgDark,d.bgDark),o.uniform1f(C.uSeedOffset,d.seedOffset);const b=Ze(d);o.uniform3f(C.uC0,b.c0[0],b.c0[1],b.c0[2]),o.uniform3f(C.uC1,b.c1[0],b.c1[1],b.c1[2]),o.uniform3f(C.uC2,b.c2[0],b.c2[1],b.c2[2]),o.uniform3f(C.uC3,b.c3[0],b.c3[1],b.c3[2]),o.uniform3f(C.uC4,b.c4[0],b.c4[1],b.c4[2]),o.uniform3f(C.uC5,b.c5[0],b.c5[1],b.c5[2]),K(),o.bindFramebuffer(o.FRAMEBUFFER,q.fbo),o.viewport(0,0,S,w),o.useProgram(E),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,G.tex),o.uniform1i(ee.uTex,0),o.uniform2f(ee.uResolution,S,w),o.uniform1f(ee.uThreshold,d.bloomThreshold),K(),o.useProgram(T),o.uniform2f(O.uTexel,1/S,1/w);let te=q;for(let ne=0;ne<2;ne++)o.bindFramebuffer(o.FRAMEBUFFER,I.fbo),o.viewport(0,0,S,w),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,te.tex),o.uniform1i(O.uTex,0),o.uniform2f(O.uDir,1,0),K(),o.bindFramebuffer(o.FRAMEBUFFER,V.fbo),o.viewport(0,0,S,w),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,I.tex),o.uniform1i(O.uTex,0),o.uniform2f(O.uDir,0,1),K(),te=V;o.bindFramebuffer(o.FRAMEBUFFER,null),o.viewport(0,0,L,F),o.useProgram(U),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,G.tex),o.uniform1i(J.uBase,0),o.activeTexture(o.TEXTURE1),o.bindTexture(o.TEXTURE_2D,V.tex),o.uniform1i(J.uBloom,1),o.uniform2f(J.uResolution,L,F),o.uniform1f(J.uBloomIntensity,d.bloomIntensity),K(),v.current=requestAnimationFrame(oe)};v.current=requestAnimationFrame(oe)},[]);return n.useEffect(()=>(X(),()=>{cancelAnimationFrame(v.current)}),[X]),n.useEffect(()=>{const f=r.current;if(!f)return;const o=(E,T)=>{if(E<1||T<1)return;const U=Ae(Math.min(E,T),void 0,m,a);f.width=Math.round(E*U),f.height=Math.round(T*U)};o(f.clientWidth,f.clientHeight);const N=new ResizeObserver(E=>{for(const T of E)o(T.contentRect.width,T.contentRect.height)});return N.observe(f),()=>N.disconnect()},[c,m,a]),l.jsx("canvas",{ref:r,[Ie]:"",style:{...i}})}function $({label:e,paramKey:t,value:u,onChange:i,min:c=0,max:m=100,step:a=1,unit:r="",decimals:v=2,helpId:D}){const A=(u-c)/(m-c)*100,{touch:y,beginDrag:g,endDrag:P}=Ke(),X=We();return l.jsxs("div",{className:"flex flex-col gap-[2px] w-full","data-help-id":D,children:[l.jsxs("div",{className:"flex items-center justify-between w-full",children:[l.jsx(ze,{label:e,paramKey:t}),l.jsx(Xe,{value:u,onCommit:j=>{i(j),y(t,j)},min:c,max:m,step:a,unit:r,decimals:v})]}),l.jsx("div",{className:"relative w-full px-2",children:l.jsxs("div",{className:"py-[11px] relative w-full",children:[l.jsxs("div",{className:"relative w-full",children:[l.jsx("div",{className:"bg-border h-[2px] rounded-[10px] w-full"}),l.jsx("div",{className:"absolute bg-foreground h-[4px] left-0 top-0 rounded-[10px] transition-all",style:{width:`${A}%`}})]}),l.jsx("input",{type:"range",min:c,max:m,step:a,value:u,onChange:j=>{const f=Number(j.target.value);i(f),y(t,f)},onPointerDown:()=>{g(t),t&&X({paramKey:t,label:e,min:c,max:m})},onPointerUp:()=>P(t),onPointerCancel:()=>P(t),className:"peer absolute left-0 top-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing"}),l.jsx(Ge,{className:"absolute transition-all pointer-events-none",style:{left:`${A}%`,top:"50%",transform:"translate(-50%, -50%)"}})]})})]})}function he({children:e}){return l.jsx("p",{className:"text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70 first:mt-0 mt-[4px]",children:e})}function be({onClick:e,children:t}){return l.jsx("button",{type:"button",onClick:e,className:"w-full text-center text-[13px] font-normal tracking-[-0.2px] text-muted-foreground border border-border/80 rounded-[var(--radius-button)] py-[10px] px-4 hover:text-foreground hover:border-border cursor-pointer",children:t})}function no(){const{settings:e,handleColsChange:t,handleRowsChange:u,handleSymChange:i,handleSpeedChange:c,handleTogglePlaying:m,handleReseed:a,handleBaseRadiusChange:r,handleSoftnessChange:v,handleCoreBrightnessChange:D,handleContrastChange:A,handleBrightnessChange:y}=ae();return l.jsxs("div",{className:"flex flex-col gap-[16px] w-full",children:[l.jsx(he,{children:"Grid & symmetry"}),l.jsx($,{label:"Columns",paramKey:"cols",value:e.cols,onChange:t,min:4,max:18,step:1,decimals:0,helpId:"metaball.columns"}),l.jsx($,{label:"Rows",paramKey:"rows",value:e.rows,onChange:u,min:4,max:24,step:1,decimals:0,helpId:"metaball.rows"}),l.jsxs("div",{className:"flex flex-col gap-[2px] w-full","data-help-id":"metaball.symmetry",children:[l.jsx("p",{className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px]",children:"Symmetry"}),l.jsxs(Ne,{value:String(e.sym),onValueChange:g=>i(Number(g)),children:[l.jsx(Ue,{className:"w-full h-[44px] rounded-[var(--radius-button)] border border-border bg-background text-[14px] gap-2",children:l.jsx(Oe,{placeholder:"Symmetry"})}),l.jsx(Le,{position:"popper",sideOffset:4,className:"z-[60]",children:qe.map(g=>l.jsx(He,{value:String(g.value),className:"text-[14px] py-[8px]",children:g.label},g.value))})]})]}),l.jsx("div",{"data-help-id":"metaball.reseed",children:l.jsx(be,{onClick:a,children:"Reseed pattern"})}),l.jsx(he,{children:"Motion"}),l.jsx($,{label:"Pulse speed",paramKey:"speed",value:e.speed,onChange:c,min:0,max:2,step:.01,helpId:"metaball.speed"}),l.jsx("div",{"data-help-id":"metaball.playPause",children:l.jsx(be,{onClick:m,children:e.playing?"Pause":"Resume"})}),l.jsx(he,{children:"Look"}),l.jsx($,{label:"Blob size",paramKey:"baseRadius",value:e.baseRadius,onChange:r,min:.15,max:1,step:.01,helpId:"metaball.blobSize"}),l.jsx($,{label:"Merge / softness",paramKey:"softness",value:e.softness,onChange:v,min:.3,max:1.6,step:.01,helpId:"metaball.softness"}),l.jsx($,{label:"Core glow",paramKey:"coreBrightness",value:e.coreBrightness,onChange:D,min:0,max:2.5,step:.01,helpId:"metaball.coreGlow"}),l.jsx($,{label:"Contrast",paramKey:"contrast",value:e.contrast,onChange:A,min:.4,max:3,step:.01,helpId:"metaball.contrast"}),l.jsx($,{label:"Brightness",paramKey:"brightness",value:e.brightness,onChange:y,min:.3,max:3,step:.01,helpId:"metaball.brightness"})]})}function co(){const{settings:e,handlePaletteChange:t,handleCustomColorChange:u}=ae(),i=pe(e);return l.jsxs("div",{className:"flex flex-col gap-[16px] w-full",children:[l.jsxs("div",{className:"flex flex-col gap-[2px]","data-help-id":"metaball.palette",children:[l.jsx("p",{className:"text-[14px] font-normal text-muted-foreground tracking-[-0.2px]",children:"Color theme"}),l.jsx("select",{value:e.paletteKey,onChange:c=>t(c.target.value),className:"h-8 rounded-md border border-border bg-card px-2 text-[13px] text-foreground",children:Je.map(c=>l.jsx("option",{value:c.key,children:c.label},c.key))})]}),l.jsx("div",{className:"flex flex-row flex-wrap items-center gap-[12px] w-full","data-help-id":"metaball.customColors",children:i.map((c,m)=>l.jsx($e,{value:c,onChange:a=>u(m,a),size:28},m))})]})}function uo(){const{settings:e,resetToolControls:t}=ae();return l.jsx(Ve,{controls:l.jsx(Ye,{parameters:l.jsx(no,{}),colors:l.jsx(co,{}),onResetAll:t,resetDisabled:Qe(e)})})}function io({className:e}){return l.jsxs("svg",{className:e||"size-5",viewBox:"0 0 20 20",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[l.jsx("circle",{cx:"7",cy:"7.5",r:"4.5",fill:"currentColor",fillOpacity:"0.85"}),l.jsx("circle",{cx:"13.5",cy:"12",r:"3.25",fill:"currentColor",fillOpacity:"0.55"}),l.jsx("circle",{cx:"7.5",cy:"14.5",r:"1.75",fill:"currentColor",fillOpacity:"0.35"})]})}const xo={id:"metaball",name:"Molecules",Icon:io,Canvas:lo,Sidebar:uo,StateProvider:eo,exportCapabilities:{canExportPNG:!0,canExportSVG:!1,canCopySVG:!1},useExportHandlers:oo};export{xo as default};
