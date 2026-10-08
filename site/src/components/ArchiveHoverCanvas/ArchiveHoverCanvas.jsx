import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { isAnimatedImage } from '../../utils/archiveMedia'

/**
 * ArchiveHoverCanvas — directional-wind distortion overlay.
 *
 * Cursor velocity defines a wind direction & strength. A travelling wave
 * propagates along that direction, laterally scaling grid shapes (soft
 * circles) — larger near the wave crest, smaller behind it.
 *
 * At rest (no wind): renders the clean cover-fit image with zero distortion.
 * On movement the image refracts slightly through the wind field, the grid
 * shapes breathe with the wave, and chromatic aberration tracks intensity.
 *
 * An FXAA post-processing pass smooths the edges for cleaner rendering.
 */

const GRID_CELLS = 10
const DEFAULT_TINT = '#3ad7ff'
// Fallbacks only; the real size is read from clientWidth/clientHeight on every resize.
// These must match PendulumCanvas's fixed 3:2 box, because they seed the initial render
// target and uPlaneAspect. The old 340x440 was portrait 0.77, so both were wrong until
// the first resize landed.
const WIDTH = 420
const HEIGHT = 280

// ---- wind tunables ----
const CA_SCALE = 5.5
const DISTORT_K = 0.28
const WIND_DECAY = 1.0
const SIDE_DECAY = 1.6
const WAVE_FREQ = 5.0
const WAVE_SPEED = 3.0
const SHAPE_BASE = 0.28
const SHAPE_MOD = 0.7

// ---- gravitational wave tunables ----
const WAVE_COMPLEXITY = 3
const WAVE_PROPAGATION = 2.5
const FLUTTER_FREQ = 8.0
const FLUTTER_SPEED = 3.0
const CRUMBLE_START = 0.6
const CRUMBLE_END = 1.0
const CRUMBLE_K = 0.15

// ---- JS-side wind computation ----
const SPEED_NORMALISE = 12
const SPEED_SMOOTH = 0.22
const DIR_SMOOTH = 0.12

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindForce;
  uniform vec2 uWindDir2D;
  
  varying vec2 vUv;
  varying float vDeformation;
  varying vec2 vDispDir;
  varying vec2 vDispPos;
  
  #define LEATHER 0.5
  #define SMOOTHNESS 0.5
  #define WAVE_AMPLITUDE 0.15
  #define MIN_FORCE 0.03
  
  void main() {
    vUv = uv;
    
    vec3 pos = position;
    float force = uWindForce;
    
    if (force > MIN_FORCE) {
      float rigidity = 1.0 - LEATHER * 0.4;
      float smoothFactor = mix(0.4, 1.0, SMOOTHNESS);
      
      float waveX = sin(pos.y * 4.0 + uTime * 2.5) * cos(pos.x * 3.0 + uTime * 1.8);
      float waveY = cos(pos.x * 3.5 + uTime * 2.0) * sin(pos.y * 4.5 - uTime * 1.5);
      
      float ripple = sin(pos.x * 6.0 + pos.y * 5.0 + uTime * 3.5) * 0.25;
      waveX += ripple;
      waveY += ripple * 0.8;
      
      // Pin the wind field at the frame rim: displaced vertices push UVs out of
      // [0,1] and the sampler clamp smears edge pixels — a stretch that flickers
      // with every cursor/pendulum gust. Full force inside, zero at the border,
      // so vDispPos never leaves [-1,1] and the clamp never engages.
      float edgeMask = (1.0 - smoothstep(0.7, 1.0, abs(pos.x)))
                     * (1.0 - smoothstep(0.7, 1.0, abs(pos.y)));
      float dx = waveX * force * WAVE_AMPLITUDE * rigidity * smoothFactor * edgeMask;
      float dy = waveY * force * WAVE_AMPLITUDE * rigidity * smoothFactor * edgeMask;
      
      pos.x += dx;
      pos.y += dy;
      
      vDispDir = vec2(dx, dy);
      vDeformation = length(vDispDir) / WAVE_AMPLITUDE;
    } else {
      vDispDir = vec2(0.0);
      vDeformation = 0.0;
    }
    
    vDispPos = pos.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  #define CA_SCALE 5.5
  varying vec2 vUv;
  varying float vDeformation;
  varying vec2 vDispDir;
  varying vec2 vDispPos;
  
  uniform float uTime;
  uniform sampler2D uImage;
  uniform float uHasImage;
  uniform float uImgAspect;
  uniform float uPlaneAspect;
  uniform vec3 uTint;
  uniform sampler2D uPrevImage;
  uniform float uHasPrev;
  uniform float uTransition;
  uniform float uSlideDir;
  uniform float uCAOffsetR;
  uniform float uCAOffsetG;
  uniform float uCAOffsetB;
  
  vec2 coverUv(vec2 pos, float imgAspect, float planeAspect) {
    vec2 uv = pos * 0.5 + 0.5;
    vec2 scale = vec2(1.0);
    if (imgAspect > planeAspect) scale.y = planeAspect / imgAspect;
    else scale.x = imgAspect / planeAspect;
    return (uv - 0.5) * scale + 0.5;
  }
  
  // The transition as a function of UV, so the chromatic aberration can be applied to
  // its result rather than replacing it. Cost: three evaluations per fragment (one per
  // channel) instead of one. That is the price of having both a slide and a split.
  //
  // suv arrives ALREADY cover-fitted from main(). Calling coverUv again here mapped
  // the UV twice and threw the image off-canvas, so the cover fit happens exactly once,
  // in main(), and this function only slides and selects.
  vec3 sampleTransition(vec2 suv) {
    // No outgoing image, or the transition has finished: a single resting sample.
    if (uHasPrev < 0.5 || uTransition >= 0.999 || uTransition < 0.001) {
      return uHasImage > 0.5 ? texture2D(uImage, suv).rgb : uTint.rgb;
    }

    float t = uTransition;
    float ease = t * t * (3.0 - 2.0 * t);

    // Rigid slide: each half samples only its own valid rows, so the wipe edge
    // coincides with UV validity by construction and no edge pixels ever smear.
    // dir +1 (content travels up, incoming from below): prev shifts down in UV
    // and owns y >= ease; incoming owns y < ease. dir -1 is the exact mirror.
    // clamp() is floating-point safety only — it never engages mid-frame.
    vec2 prevUv = clamp(suv + vec2(0.0, -ease * uSlideDir), 0.0, 1.0);
    vec2 nextUv = clamp(suv + vec2(0.0, (1.0 - ease) * uSlideDir), 0.0, 1.0);

    vec3 prevCol = texture2D(uPrevImage, prevUv).rgb;
    vec3 nextCol = uHasImage > 0.5 ? texture2D(uImage, nextUv).rgb : uTint.rgb;

    // Hard edge travelling along the slide axis. uSlideDir +1: the incoming image enters
    // from below, so the boundary sweeps top -> bottom and the incoming image owns
    // y < ease. uSlideDir -1 is the exact mirror. At ease 0 the outgoing image fills the
    // frame; at ease 1 the incoming image does.
    bool incomingFromBelow = uSlideDir > 0.0;
    float p = incomingFromBelow ? ease : 1.0 - ease;
    bool takeIncoming = incomingFromBelow ? (suv.y < p) : (suv.y > p);
    return takeIncoming ? nextCol : prevCol;
  }
  
  void main() {
    vec2 baseUv = coverUv(vDispPos, uImgAspect, uPlaneAspect);

    // True channel split: R leads and B trails proportionally to the deform,
    // G stays anchored (plus the transition offsets). Equal offsets = clean image.
    float caBase = min(vDeformation * 0.45, 0.09);
    float caR = caBase + uCAOffsetR;
    float caG = uCAOffsetG;
    float caB = uCAOffsetB - caBase;

    // Each channel is the slide, sampled at its own horizontal offset. The outgoing
    // image survives into the frame because the composite lives inside the function.
    vec3 col = sampleTransition(baseUv + vec2(caR, 0.0));
    col.g = sampleTransition(baseUv + vec2(caG, 0.0)).g;
    col.b = sampleTransition(baseUv + vec2(caB, 0.0)).b;

        // Alpha follows uHasImage, not 1.0. uTint is a saturated cyan used as the
        // "no media yet" fill, and the video path only raises uHasImage on canplay —
        // so a fixed alpha 1.0 painted a solid cyan rectangle for the whole load,
        // which read as a blue background flashing before the image appeared.
        // Transparent means the page shows through until the texture is real.
        gl_FragColor = vec4(col, uHasImage);
  }
`

// ---- FXAA post-processing pass (anti-aliasing for smoother edges) ----
const FXAA_QUALITY_SUBPIX = 0.75
const FXAA_QUALITY_EDGE_THRESHOLD = 0.166
const FXAA_QUALITY_EDGE_THRESHOLD_MIN = 0.0833

const fxaaFragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  varying vec2 vUv;

  #ifndef FXAA_REDUCE_MIN
  #define FXAA_REDUCE_MIN (1.0 / 128.0)
  #endif
  #ifndef FXAA_REDUCE_MUL
  #define FXAA_REDUCE_MUL (1.0 / 8.0)
  #endif
  #ifndef FXAA_SPAN_MAX
  #define FXAA_SPAN_MAX 8.0
  #endif

  vec4 FxaaPixelShader(vec2 fragCoord) {
    vec2 inverseVP = 1.0 / uResolution;
    vec4 rgbaNW = texture2D(tDiffuse, fragCoord + vec2(-1.0, 1.0) * inverseVP);
    vec4 rgbaNE = texture2D(tDiffuse, fragCoord + vec2(1.0, 1.0) * inverseVP);
    vec4 rgbaSW = texture2D(tDiffuse, fragCoord + vec2(-1.0, -1.0) * inverseVP);
    vec4 rgbaSE = texture2D(tDiffuse, fragCoord + vec2(1.0, -1.0) * inverseVP);
    vec4 rgbaM = texture2D(tDiffuse, fragCoord);
    vec3 luma = vec3(0.299, 0.587, 0.114);
    float lumaNW = dot(rgbaNW.rgb, luma);
    float lumaNE = dot(rgbaNE.rgb, luma);
    float lumaSW = dot(rgbaSW.rgb, luma);
    float lumaSE = dot(rgbaSE.rgb, luma);
    float lumaM = dot(rgbaM.rgb, luma);
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 / 8.0), 1.0 / 128.0);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = min(vec2(8.0, 8.0), max(vec2(-8.0, -8.0), dir * rcpDirMin)) * inverseVP;
    vec4 rgbA = 0.5 * (texture2D(tDiffuse, fragCoord + dir * (1.0 / 3.0 - 0.5)) + texture2D(tDiffuse, fragCoord + dir * (2.0 / 3.0 - 0.5)));
    vec4 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, fragCoord + dir * -0.5) + texture2D(tDiffuse, fragCoord + dir * 0.5));
    float lumaB = dot(rgbB.rgb, luma);
    float lumaBi = step(lumaMin, lumaB) * step(lumaB, lumaMax);
    vec4 result = mix(rgbA, rgbB, lumaBi);
    return result;
  }

  void main() {
    gl_FragColor = FxaaPixelShader(vUv);
  }
`

function ArchiveHoverCanvas({
  pendulumRef,
  cursorRef,
  image,
  videoPath,
  gifPath,
  stripImages,
  stripTarget = 0,
  stripVideos,
  stripGifs,
  tint = DEFAULT_TINT,
  visible = true,
  className = '',
  style,
  glLockRef = { current: false },
  gateIsTouch = false,
  gateIsAwake = null,
  onReady = null,
}) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const visibleRef = useRef(visible)
  const onReadyRef = useRef(null)
  const readyFiredRef = useRef(false)
  // Continuous strip state: float position chasing the integer target row.
  // Textures are preloaded posters shared across frames — never disposed
  // per-frame. Rows with video/gif hold LIVE textures (playing media) instead
  // of static posters, so animated rows glide exactly like image rows: no
  // settle wait, no poster→media wipe, no overlay. Entries own only their
  // pump/element; their texture is released with the strip, once, on teardown.
  const stripTex = useRef([])
  const stripEntries = useRef([])
  const stripState = useRef({ pos: 0, last: 0, dir: 1 })
  const stripTargetRef = useRef(stripTarget)
  const stripListsRef = useRef({ videos: stripVideos, gifs: stripGifs })
  const snapStripRef = useRef(true)
  const lastTargetRef = useRef(-1)
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

  // ponytail: match the pattern used in FeaturedGallery + MobileCanvas for consistency
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Mirror live props for the RAF loop (which closes over first-render values):
  // integer strip target, per-row media lists, snap-on-reopen. Live videos
  // pause while hidden and resume on return.
  useEffect(() => {
    const was = visibleRef.current
    visibleRef.current = visible
    onReadyRef.current = onReady
    stripTargetRef.current = stripTarget
    stripListsRef.current = { videos: stripVideos, gifs: stripGifs }
    if (visible && !was) snapStripRef.current = true
    if (visible !== was) {
      const entries = stripEntries.current
      for (let i = 0; i < entries.length; i++) {
        const v = entries[i]?.video
        if (!v) continue
        if (visible) { v.play().catch(() => {}) }
        else { try { v.pause() } catch (e) {} }
      }
    }
  })

  // Effects run only while the deliberate mobile cursor is grabbed. isAwake is a ref
  // that changes without a re-render, so this has to be read at the point of use —
  // capturing it in a dependency array would freeze a stale value.
  const effectsGated = () => !!(gateIsTouch && gateIsAwake && !gateIsAwake.current)

  // ---- one-time WebGL setup ----
  useEffect(() => {
    // ponytail: skip WebGL entirely when reduced motion is preferred — no renderer,
    // no RAF loop, no ResizeObserver. Static image shown via fallback <img>.
    if (reduceMotion) return

    const canvas = canvasRef.current
    if (!canvas) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch (e) {
      console.warn('ArchiveHoverCanvas: WebGL unavailable', e)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10)
    camera.position.z = 1

    const uniforms = {
      uTime: { value: 0 },
      uImage: { value: null },
      uHasImage: { value: 0 },
      uImgAspect: { value: 1 },
      // Measured, not the 340/440 constant. coverUv() is correct but it needs the
      // PLANE aspect, and a wrong initial value squashed every image on the first
      // frame until the ResizeObserver below corrected it — which it does in both
      // branches, so this only has to get frame one right.
      uPlaneAspect: {
        value: (canvas.clientWidth || WIDTH) / (canvas.clientHeight || HEIGHT || 1),
      },
      uGrid: { value: GRID_CELLS },
      uTint: { value: new THREE.Color(tint) },
      uWindDir: { value: new THREE.Vector2(0, 0) },
      uWindStr: { value: 0 },
      uWindOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uPrevImage: { value: null },
      uHasPrev: { value: 0 },
      uTransition: { value: 0 },
      uSlideDir: { value: 0 },
      uWindForce: { value: 0 },
      uWindDir2D: { value: new THREE.Vector2(0, 0) },
      uCAOffsetR: { value: 0 },
      uCAOffsetG: { value: 0 },
      uCAOffsetB: { value: 0 },
    }

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const GRID_SEGMENTS = 10
const geometry = new THREE.PlaneGeometry(2, 2, GRID_SEGMENTS, GRID_SEGMENTS)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // ---- FXAA post-processing: render scene to a target, then AA onto canvas ----
    const renderTarget = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    })
    const quadScene = new THREE.Scene()
    const fxaaVertexShader = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
    const fxaaMaterial = new THREE.ShaderMaterial({
      vertexShader: fxaaVertexShader,
      fragmentShader: fxaaFragmentShader,
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        uResolution: { value: new THREE.Vector2(WIDTH, HEIGHT) },
      },
      depthTest: false,
      depthWrite: false,
    })
    const quadGeometry = new THREE.PlaneGeometry(2, 2)
    const quad = new THREE.Mesh(quadGeometry, fxaaMaterial)
    quadScene.add(quad)

    // Debounced backing-store realloc so hover aspect-tweens never churn; declared
    // BEFORE resize is defined (and before the first synchronous resize() below),
    // otherwise it sits in the TDZ when the effect body starts top-to-bottom.
    let resizeTimer = 0
    const resize = () => {
      const w = canvas.clientWidth || WIDTH
      const h = canvas.clientHeight || HEIGHT
      // During an active drag the canvas CSS size changes every frame. Re-allocating
      // the render target on every ResizeObserver callback there causes the GL layer to
      // churn (flicker/jump) behind the static image. glLockRef keeps the backing store
      // and render target at their last committed size; only the cheap aspect uniform
      // moves. The lock is released on pointerup so the next resize commits cleanly.
      if (glLockRef.current) {
        uniforms.uPlaneAspect.value = w / h
        return
      }
      // Debounced backing-store realloc so hover aspect-tweens never churn;
      // the aspect uniform tracks immediately. 120ms ≈ end of the size tween.
      uniforms.uPlaneAspect.value = w / h
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        renderer.setSize(w, h, false)
        const dpr = renderer.getPixelRatio()
        const rw = Math.max(1, Math.floor(w * dpr))
        const rh = Math.max(1, Math.floor(h * dpr))
        renderTarget.setSize(rw, rh)
        fxaaMaterial.uniforms.uResolution.value.set(rw, rh)
      }, 120)
    }
    resize()
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    const timer = new THREE.Timer()
    let raf = 0

    // ---- wind state (EMA-smoothed) ----
    let prevCursor = { x: cursorRef?.current?.x ?? 0, y: cursorRef?.current?.y ?? 0 }
    let smoothDirX = 0, smoothDirY = 0, smoothStr = 0

    const loop = () => {
      timer.update()
      const dt = Math.min(timer.getDelta(), 0.05)
      uniforms.uTime.value += dt

      if (!visibleRef.current) {
        raf = requestAnimationFrame(loop)
        return
      }

      // ---- wind from cursor velocity ----
      const cur = cursorRef?.current
      let rawDirX = 0, rawDirY = 0, rawStr = 0
      if (cur && cur.x > -9000 && visibleRef.current) {
        const dx = cur.x - prevCursor.x
        const dy = cur.y - prevCursor.y
        prevCursor.x = cur.x
        prevCursor.y = cur.y
        const speed = Math.hypot(dx, dy)
        rawStr = Math.min(1, speed / SPEED_NORMALISE)
        if (speed > 1) {
          rawDirX = dx / speed
          rawDirY = dy / speed
        }
      } else if (cur) {
        prevCursor.x = cur.x
        prevCursor.y = cur.y
      }

      // Also consider pendulum swing as a secondary wind source
      let pendStr = 0
      if (pendulumRef?.current) {
        const p = pendulumRef.current
        if (typeof p.omega === 'number') {
          pendStr = Math.min(1, Math.abs(p.omega) * 0.4)
          if (p.lean !== 0 && rawStr < 0.01) {
            rawDirX = p.lean
            rawDirY = 0
          }
        }
      }
      rawStr = Math.max(rawStr, pendStr)

      // EMA-smooth direction & strength (prevents jitter)
      smoothStr += (rawStr - smoothStr) * SPEED_SMOOTH
      if (rawStr > 0.05) {
        smoothDirX += (rawDirX - smoothDirX) * DIR_SMOOTH
        smoothDirY += (rawDirY - smoothDirY) * DIR_SMOOTH
      } else {
        // Decelerate wind when cursor stops
        smoothDirX *= 0.92
        smoothDirY *= 0.92
        smoothStr *= 0.9
      }

      if (effectsGated()) {
        // A clean tap moves the cursor within a single frame while prevCursor still
        // holds the pre-tap position, so the velocity delta spikes, rawStr saturates
        // and caBase reaches its 0.09 cap — a visible RGB split on every tap. Snap
        // rather than decay: an EMA tail would keep the aberration on screen for
        // frames after the gate closed.
        rawStr = 0
        smoothStr = 0
        smoothDirX = 0
        smoothDirY = 0
        if (cur) { prevCursor.x = cur.x; prevCursor.y = cur.y }
      }

      uniforms.uWindDir.value.set(smoothDirX, smoothDirY)
      uniforms.uWindStr.value = smoothStr
      uniforms.uWindForce.value = smoothStr
      uniforms.uWindDir2D.value.set(smoothDirX, smoothDirY)

      // Wind origin: cursor position projected into canvas UV space
      if (cur && cur.x > -9000 && visibleRef.current) {
        const glEl = canvasRef.current
        if (glEl) {
          const r = glEl.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            uniforms.uWindOrigin.value.set(
              clamp((cur.x - r.left) / r.width, 0, 1),
              clamp((cur.y - r.top) / r.height, 0, 1),
            )
          }
        }
      }

      // ---- continuous vertical strip driver ----
      // A float position chases the integer target row with dt-corrected
      // exponential smoothing, so images flow one after another at a speed that
      // follows the user's movement by itself, and reversals are smooth curves
      // (the pair mapping below is flip-continuous: t_new = 1 - t_old with the
      // roles swapped, so no snap is possible mid-glide).
      {
        const S = stripState.current
        const T = stripTex.current
        const N = T.length
        if (N > 0) {
          let target = Math.round(stripTargetRef.current ?? 0)
          if (target < 0) target = 0
          if (target > N - 1) target = N - 1
          if (snapStripRef.current) {
            snapStripRef.current = false
            S.pos = target
            S.last = target
          }
          // Trapezoidal chase (GSAP-style ease-out feel, per-frame because the
          // target is live): exponential approach capped at a max rows/sec, so
          // multi-row jumps start linear with no kick and still land soft.
          const gap = target - S.pos
          const k = 1 - Math.exp(-dt * 6.5)
          const maxStep = 7 * dt
          S.pos += Math.max(-maxStep, Math.min(maxStep, gap * k))
          if (Math.abs(target - S.pos) < 0.002) S.pos = target
          const dPos = S.pos - S.last
          if (dPos > 0.0005) S.dir = 1
          else if (dPos < -0.0005) S.dir = -1
          S.last = S.pos
          // Restart live media on arrival: entering an animated row replays it
          // from frame 0 (muted+looping, so play() never needs a gesture; GIF
          // decoders loop on their own) — the strip shows motion immediately,
          // no settle wait, no wipe, no overlay.
          if (target !== lastTargetRef.current) {
            lastTargetRef.current = target
            const v = stripEntries.current[target]?.video
            if (v) {
              try { v.currentTime = 0 } catch (e) {}
              v.play().catch(() => {})
            }
          }
            if (S.pos === target) {
              // At rest: single settled frame (shader early-out shows uImage).
              const tx = nearestTex(target)
              if (tx) {
                uniforms.uImage.value = tx
                uniforms.uHasImage.value = 1
                uniforms.uHasPrev.value = 0
                uniforms.uTransition.value = 0
                if (tx.userData.aspect) uniforms.uImgAspect.value = tx.userData.aspect
                if (tx.userData.aspect && !readyFiredRef.current) {
                  readyFiredRef.current = true
                  onReadyRef.current?.(target)
                }
              }
            } else {
              // Mid-glide: adjacent pair with fractional progress. Either side
              // still preloading resolves to its nearest loaded neighbor, so a
              // slow file never freezes the strip — only an empty strip holds.
              let prev = null, next = null, t = 0
              if (S.dir > 0) {
                const i0 = Math.max(0, Math.min(N - 1, Math.floor(S.pos)))
                const i1 = Math.max(0, Math.min(N - 1, i0 + 1))
                prev = nearestTex(i0); next = nearestTex(i1); t = S.pos - Math.floor(S.pos)
              } else {
                const i1 = Math.max(0, Math.min(N - 1, Math.ceil(S.pos)))
                const i0 = Math.max(0, Math.min(N - 1, i1 - 1))
                prev = nearestTex(i1); next = nearestTex(i0); t = Math.ceil(S.pos) - S.pos
              }
              if (prev && next) {
                uniforms.uPrevImage.value = prev
                uniforms.uImage.value = next
                uniforms.uHasPrev.value = 1
                uniforms.uHasImage.value = 1
                uniforms.uTransition.value = clamp(t, 0, 1)
                uniforms.uSlideDir.value = S.dir
                // Morph the plane aspect with the same smoothstep the shader
                // uses for the wipe: switching aspect mid-blend rescales the
                // cover-fit in one frame = visible pop. pA/nA guard missing dims.
                const pA = prev.userData.aspect
                const nA = next.userData.aspect
                if (pA && nA) {
                  const te = t * t * (3.0 - 2.0 * t)
                  uniforms.uImgAspect.value = pA + (nA - pA) * te
                } else if (pA) {
                  uniforms.uImgAspect.value = pA
                }
                if (!readyFiredRef.current) {
                  readyFiredRef.current = true
                  onReadyRef.current?.(S.pos)
                }
            }
            }
        }
      }

      renderer.setRenderTarget(renderTarget)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(quadScene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    stateRef.current = { renderer, scene, camera, material, geometry, uniforms, renderTarget, fxaaMaterial, quadScene, quadGeometry }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', resize)
      ro.disconnect()
      geometry.dispose()
      material.dispose()
      quadGeometry.dispose()
      fxaaMaterial.dispose()
      renderTarget.dispose()
      renderer.dispose()
      // Never dispose strip textures here: they are shared across frames and
      // owned by the preload effect (entries and posters alike).
      const shared = new Set(stripTex.current.filter(Boolean))
      if (uniforms.uImage.value && !shared.has(uniforms.uImage.value)) uniforms.uImage.value.dispose()
      if (uniforms.uPrevImage.value && !shared.has(uniforms.uPrevImage.value)) uniforms.uPrevImage.value.dispose()
      stateRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- strip preload: one texture per row, by media kind ----
  // Static rows keep byte-identical behavior (TextureLoader poster). Rows with
  // video hold a LIVE muted texture (playing from mount, restarted on enter);
  // gif-only rows hold a live CanvasTexture mirroring the decoder. Every kind
  // flows through the same pair mapping, so animated rows glide exactly like
  // image rows — no settle wait, no poster→media wipe, no overlay.
  useEffect(() => {
    if (reduceMotion) return
    const st = stateRef.current
    if (!st || !stripImages || !stripImages.length) return
    const videos = stripVideos || []
    const gifs = stripGifs || []
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    let cancelled = false
    const arr = stripTex.current
    const entries = stripEntries.current

    const startVideoEntry = (i, src) => {
      const video = document.createElement('video')
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.preload = 'auto'
      video.crossOrigin = 'anonymous'
      video.setAttribute('aria-hidden', 'true')
      // Detached on purpose: video decodes on the media clock regardless of
      // paint, so the element never enters the DOM (no stacking hazards).
      video.src = src
      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.NoColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = false
      const entry = { tex, video, img: null, raf: 0, alive: true }
      const poke = () => {
        if (!entry.alive) return
        if (video.readyState >= 2) {
          tex.needsUpdate = true
          if (!tex.userData.aspect && video.videoWidth > 0) {
            tex.userData.aspect = video.videoWidth / video.videoHeight
          }
        }
        entry.raf = requestAnimationFrame(poke)
      }
      const onError = () => {
        entry.alive = false
        console.warn('[ArchiveHoverCanvas] strip video failed:', src)
      }
      video.addEventListener('error', onError)
      entry.cancel = () => video.removeEventListener('error', onError)
      entry.raf = requestAnimationFrame(poke)
      video.play().catch(() => {})
      arr[i] = tex
      entries[i] = entry
    }

    const startGifEntry = (i, src) => {
      // Animated GIFs only advance while their <img> is actually painted, so
      // it stays attached full-size under the GL canvas while the texture
      // mirrors the live decoder frame each tick.
      const container = canvasRef.current?.parentElement
      const img = document.createElement('img')
      img.crossOrigin = 'anonymous'
      img.src = src
      img.alt = ''
      img.setAttribute('aria-hidden', 'true')
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;'
      container?.appendChild(img)
      const draw = document.createElement('canvas')
      const ctx = draw.getContext('2d')
      if (!ctx) { img.remove(); return }
      const tex = new THREE.CanvasTexture(draw)
      tex.colorSpace = THREE.NoColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      const entry = { tex, video: null, img, raf: 0, alive: true }
      const drawFrame = () => {
        if (!entry.alive) return
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          if (draw.width !== img.naturalWidth || draw.height !== img.naturalHeight) {
            draw.width = img.naturalWidth
            draw.height = img.naturalHeight
          }
          ctx.drawImage(img, 0, 0)
          tex.needsUpdate = true
          tex.userData.aspect = img.naturalWidth / img.naturalHeight
        }
        entry.raf = requestAnimationFrame(drawFrame)
      }
      img.onload = () => { if (entry.alive) drawFrame() }
      img.onerror = () => {
        entry.alive = false
        console.warn('[ArchiveHoverCanvas] strip gif failed:', src)
      }
      entry.cancel = () => { img.onload = null; img.onerror = null }
      arr[i] = tex
      entries[i] = entry
    }

    stripImages.forEach((src, i) => {
      if (arr[i]) return
      if (videos[i]) { startVideoEntry(i, videos[i]); return }
      if (gifs[i] && isAnimatedImage(gifs[i])) { startGifEntry(i, gifs[i]); return }
      if (!src) return
      loader.load(src, (tex) => {
        if (cancelled) { tex.dispose(); return }
        // Zero-size image (still decoding, e.g. heavy GIF first frame) binds
        // as an incomplete texture and samples BLACK for a frame — reject it
        // so nearestTex keeps substituting a loaded neighbor instead.
        const iw = tex.image.width, ih = tex.image.height
        if (!iw || !ih) { tex.dispose(); return }
        tex.colorSpace = THREE.NoColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        tex.userData.aspect = iw / ih
        arr[i] = tex
      }, undefined, () => { console.warn('[ArchiveHoverCanvas] strip poster failed:', src) })
    })
    return () => {
      cancelled = true
      for (const e of entries) {
        if (!e) continue
        e.alive = false
        if (e.raf) cancelAnimationFrame(e.raf)
        try { e.cancel?.() } catch (err) {}
        if (e.video) { try { e.video.pause() } catch (err) {} }
        if (e.img) e.img.remove()
      }
      stripEntries.current = []
      arr.forEach((t) => { if (t) t.dispose() })
      stripTex.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripImages, stripVideos, stripGifs])

  // Nearest loaded poster around an index. Big/slow files (multi-MB GIFs)
  // take a while to decode — without this the strip would hold its last frame
  // every time a glide touches their index and read as frozen. The neighbor
  // keeps the carousel moving; the real texture takes over seamlessly once
  // its load lands. Returns null only when nothing is loaded yet.
  const nearestTex = (idx) => {
    const T = stripTex.current
    const N = T.length
    if (N === 0) return null
    let c = Math.max(0, Math.min(N - 1, Math.round(idx)))
    if (T[c]) return T[c]
    for (let d = 1; d < N; d++) {
      if (c - d >= 0 && T[c - d]) return T[c - d]
      if (c + d < N && T[c + d]) return T[c + d]
    }
    return null
  }
  // ---- tint updates ----
  useEffect(() => {
    const st = stateRef.current
    if (st) st.uniforms.uTint.value.set(tint)
  }, [tint])

  return (
    <div
      className={`archive-hover-canvas${className ? ` ${className}` : ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        transformOrigin: 'center center',
        willChange: 'transform, opacity',
        ...style,
      }}
    >
      {reduceMotion
        ? (
            <img
              src={gifPath || image || undefined}
              alt=""
              onLoad={() => onReady?.(stripTarget)}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )
        : (
            <canvas
              ref={canvasRef}
              className="archive-hover-canvas__gl"
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
          )}
    </div>
  )
}

export default ArchiveHoverCanvas
export { ArchiveHoverCanvas }
