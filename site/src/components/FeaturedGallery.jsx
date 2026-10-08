import React, { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useArchiveCursor } from '../hooks/useArchiveCursor'
import { useCursorGate } from '../hooks/useCursorGate'
import { useInView } from '../hooks/useInView.js'
import { shouldEnableSectionWebGL } from '../utils/webglPolicy'
import { dissolveVertexShader, dissolveFrontFragment, dissolveBackFragment } from '../shaders/dissolve'

gsap.registerPlugin(ScrollTrigger)

// `imgBack` is the image the dissolve uncovers, and is a field rather than something
// derived from `img`, so swapping these placeholders for the real assets is a data edit
// and not a code change. Picsum seeds follow the archive's convention (Archives.jsx)
// and are per-project, so a given card always resolves to the same picture. 1/1 is
// square (650x650), matching .gl-media__frame, so the back layer cover-fits without recropping.
const featured = [
  { name: 'AlFly',  role: 'Transport App for save tickets', img: 'Alfly/alfly-open.png',  align: [0.5, 0.5], imgBack: 'https://picsum.photos/seed/alfly/400/300' },
  { name: 'SISALFUNCLUB',    role: 'New game experience', img: 'sisalfunclub/sisalfunclub-open.png',   align: [0.5, 0.5], imgBack: 'https://picsum.photos/seed/sisalfunclub/400/300' },
  { name: 'iTour',     role: 'Travel apps for connecting with strangers',    img: 'iTour/itour-open.png',  align: [0.5, 0.5], imgBack: 'https://picsum.photos/seed/itour/400/300' },
  { name: 'uBank',       role: 'Home Banking for busy people', img: 'ubank/ubank-open.png',    align: [0.5, 0.5], imgBack: 'https://picsum.photos/seed/ubank/400/300' },
  { name: 'Policlinico di Milano',         role: 'New Experience for donations blood',  img: 'policlinico-milano/policliMi-open.png',      align: [0.5, 0.5], imgBack: 'https://picsum.photos/seed/policlinico/400/300' },
  { name: 'Twitch', role: 'Redesign app for new Experience', img: 'twitch-redesign/twitch-open.png', align: [0.5, 0.5], imgBack: 'https://picsum.photos/seed/twitch/400/300' }
]

export const vertexShader = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
export const fragmentShader = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uPlaneAspect;
  uniform float uImgAspect;
  uniform vec2 uAlign;
  varying vec2 vUv;
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
  void main(){
    vec2 uv = vUv;
    vec2 coverUV = coverUv(uv, uAlign);
    vec3 col = texture2D(uTex, coverUV).rgb;

    if (uHover > 0.01) {
      float dt = uTime;
      vec2 toC = coverUV - uMouse;
      float d = length(toC * vec2(uPlaneAspect * 2.4, 2.4));
      float fall = 1.0 - smoothstep(0.05, 0.9, d);

      // FBM ripple + curl-noise flow field (fluid-like, organic displacement)
      vec2 p = coverUV * 4.0 + dt * 0.3;
      float n1 = sin(p.x * 3.0 + dt) * cos(p.y * 2.0 - dt * 0.7);
      float n2 = sin(p.x * 1.5 - dt * 0.5) * cos(p.y * 3.0 + dt * 0.3);
      float n3 = sin((p.x + p.y) * 2.0 + dt * 0.8);
      vec2 flow = vec2(n1 - n2, n2 - n3) * fall * 0.008 * uHover;
      coverUV += flow;

      float ca = 0.015 * uHover * clamp(1.0 - d, 0.0, 1.0);
      col.r = texture2D(uTex, coverUV + vec2(ca, 0.0)).r;
      col.g = texture2D(uTex, coverUV).g;
      col.b = texture2D(uTex, coverUV - vec2(ca, 0.0)).b;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

// Module-level: the gallery owns exactly one WebGL context per card for the
// page lifetime. Built once and cached, so StrictMode remounts and re-renders
// reuse the same renderers — contexts are NEVER created per hover/per mount
// (that churn is what used to trigger Chrome's context-loss storm).
let galleryGL = null

function buildGalleryGL(frames, cursorInput) {
  const items = []
  const loader = new THREE.TextureLoader()
  let dead = false
  let pending = 0
  let running = false
  let raf = 0
  const startTime = performance.now()

  function settle() {
    pending--
    if (pending <= 0) startLoop()
  }

  frames.forEach((elFrame) => {
    const img = elFrame.querySelector('img')
    const canvas = elFrame.querySelector('canvas.gl-media__canvas')
    if (!img || !canvas) return
    // ponytail: hover zone is the whole card (title included), not just the
    // frame — entering/leaving anywhere on the card drives the dissolve.
    const hoverZone = elFrame.closest('.gl-media') || elFrame

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setClearColor(0x000000, 1)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setSize(canvas.offsetWidth || 1, canvas.offsetHeight || 1)
    } catch (e) {
      canvas.style.display = 'none'
      return
    }

    // far was 1 with the mesh at z=0 and the camera at z=1, i.e. the mesh sat exactly
    // on the far plane. The back layer now sits at z=-0.1, which is 1.1 away and would
    // be clipped away entirely, so the frustum is extended to 10 to hold both.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10)
    camera.position.z = 1
    const scene = new THREE.Scene()

    const src = (img.currentSrc && img.currentSrc !== '') ? img.currentSrc : img.src
    const srcBack = elFrame.dataset.imgBack
    if (!src) { canvas.style.display = 'none'; return }

    // L'immagine rivelata e' la STESSA del poster ma a colori: un solo load.
    // Il back riusa lo stesso texture object del front, così il dissolve mostra
    // B&N -> colore della medesima immagine (niente picsum, niente doppio fetch).
    pending += 1
    const loaded = { front: null, back: null, frontFailed: false, backFailed: false, built: false }

    function buildCard() {
      if (dead || loaded.built) return
      if (!loaded.front) return
      loaded.back = loaded.front
      loaded.built = true
      const tex = loaded.front
      const backTex = loaded.back

      tex.minFilter = THREE.LinearFilter
      tex.generateMipmaps = false
      tex.colorSpace = THREE.SRGBColorSpace
      backTex.minFilter = THREE.LinearFilter
      backTex.generateMipmaps = false
      backTex.colorSpace = THREE.SRGBColorSpace

      const imgAspect = (tex.image && tex.image.width && tex.image.height)
        ? tex.image.width / tex.image.height
        : 1.0
      const backAspect = (backTex.image && backTex.image.width && backTex.image.height)
        ? backTex.image.width / backTex.image.height
        : 1.0

      const alignX = parseFloat(elFrame.dataset.alignX) || 0.5
      const alignY = parseFloat(elFrame.dataset.alignY) || 0.5

      // One renderer, one scene, two meshes. NOT two canvases: six contexts are
      // already spent on this section and a seventh-plus set is the context-loss
      // storm this function's own comment warns about.
      const backMat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: backTex },
          uTime: { value: 0 },
          uHover: { value: 0 },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uPlaneAspect: { value: 1 },
          uImgAspect: { value: backAspect },
          uAlign: { value: new THREE.Vector2(alignX, alignY) },
          uRippleActive: { value: 0 },
          uDarkness: { value: 1 },
        },
        vertexShader: dissolveVertexShader,
        fragmentShader: dissolveBackFragment,
        transparent: false,
      })
      const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backMat)
      backMesh.position.z = -0.1
      scene.add(backMesh)

      const frontMat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: tex },
          uDissolve: { value: 0 },
          // The card's centre, per the request. Constant on purpose — the cursor is
          // NOT wired to this, unlike uMouse.
          uCenter: { value: new THREE.Vector2(0.5, 0.5) },
          uPlaneAspect: { value: 1 },
          uImgAspect: { value: imgAspect },
          uAlign: { value: new THREE.Vector2(alignX, alignY) },
          uGrayscale: { value: 1 },
          uEdgeIntensity: { value: 0 },
          uEdgeBrightness: { value: 1 },
          uPixelSize: { value: 24.0 },
          uCAAmplitude: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: dissolveVertexShader,
        fragmentShader: dissolveFrontFragment,
        transparent: true,
      })
      const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), frontMat)
      scene.add(frontMesh)

      const item = {
        frame: elFrame, hoverZone, canvas, renderer, camera, scene,
        backMesh, frontMesh, backMat, frontMat,
        dissolve: 0,
          targetHover: 0, mx: 0.5, my: 0.5, onMove: null, onLeave: null, dissolveTween: null,
          // Last reveal state the touch path asked for. Change-guarded so the tick
          // creates ONE tween per transition instead of one per frame.
          revealTarget: 0,
      }
      items.push(item)
      elFrame.classList.add('is-ready')
      canvas.style.display = 'block'

      // Kept on the item so disposeAll can detach them; anonymous arrows would
      // be unreferenceable and would outlive the renderer.
      item.onMove = (e) => {
        const r = elFrame.getBoundingClientRect()
        item.targetHover = 1
        item.mx = (e.clientX - r.left) / r.width
        item.my = 1 - (e.clientY - r.top) / r.height
        const cap = elFrame.closest('.gl-media')?.querySelector('.gl-media__cap')
        if (cap) {
          const sp = parseFloat(cap.dataset.parallaxSpeed || '0') || 0
          cap.style.transform = `translate3d(${((item.mx - 0.5) * sp * 80).toFixed(2)}px,${((item.my - 0.5) * sp * 80).toFixed(2)}px,0)`
        }
      }
      item.onLeave = (e) => {
        item.targetHover = 0
        // ponytail: per-event input truth, not device capability — touch-screen
        // laptops report isTouch but their mouse hover must still dissolve.
        if ((e?.pointerType || 'mouse') !== 'touch') tweenDissolve(item, 0)
        const cap = elFrame.closest('.gl-media')?.querySelector('.gl-media__cap')
        if (cap) cap.style.transform = 'translate3d(0,0,0)'
      }
      elFrame.addEventListener('pointermove', item.onMove)
      hoverZone.addEventListener('pointerleave', item.onLeave)

      // The dissolve's own hover pair, attached HERE rather than in a loop over
      // `items` after the frames are walked. That loop is the obvious place for it and
      // it silently does nothing: `items` is filled by the async texture callback, so
      // any code running at the end of buildGalleryGL is iterating an empty array. The
      // listeners were never attached and the dissolve never fired on hover at all.
      // Symptom was invisible because the CSS scale(1.02) hover lift still changed the
      // pixels, so a screenshot diff looked like a working effect.
    item.onFrameEnter = (e) => {
      // ponytail: same per-event gate as onLeave — mouse always dissolves,
      // touch fingers use the parked-cursor tick path instead.
      if ((e?.pointerType || 'mouse') === 'touch') return
      tweenDissolve(item, 1)
    }
      hoverZone.addEventListener('pointerenter', item.onFrameEnter)
    }

    // Both loads run, and both always call settle() exactly once — success or failure.
    // Whichever finishes LAST triggers the build, so the first frame can never show a
    // half-built card. `loaded.built` guards the case where they land in either order.
    const done = () => {
      if (dead) return
      settle()
      buildCard()
    }

    loader.load(src, (t) => { loaded.front = t; done() }, undefined, () => {
      // The front image IS the card, so a failure here is fatal for it: hide the
      // canvas and let the plain <img> path (or nothing) stand.
      loaded.frontFailed = true
      canvas.style.display = 'none'
      done()
    })
  })

  function startLoop() {
    if (running || dead || !items.length) return
    running = true
    ;(function tick() {
      if (!running) return
      if (cursorInput.inViewRef && !cursorInput.inViewRef.current) {
        raf = requestAnimationFrame(tick)
        return
      }
      const t = (performance.now() - startTime) / 1000
      for (const it of items) {
        // The ripple's cursor tracking lives on the BACK layer only. The front layer
        // has no uHover/uMouse uniforms at all, so there is no code path by which the
        // un-revealed image can ripple — the restriction is structural, not a gate
        // someone can flip.
        const bu = it.backMat.uniforms
        bu.uTime.value = t
        if (cursorInput.isTouch) {
          const r = it.frame.getBoundingClientRect()
          const cur = cursorInput.cursorRef.current
          // Mobile grid: conta la posizione parcheggiata anche da addormentata —
          // e l'hover del cursor mobile, dissolve in griglia senza aprire canvas.
          // Il gate AWAKE resta per tutti gli altri effetti (torus, callout...).
          const active = !!cur
            && cur.x >= r.left && cur.x <= r.right
            && cur.y >= r.top && cur.y <= r.bottom
          if (active) {
            it.targetHover = 1
            it.mx = (cur.x - r.left) / r.width
            it.my = 1 - (cur.y - r.top) / r.height
          } else {
            it.targetHover = 0
          }
          // The reveal follows the CURSOR on touch, same predicate as the ripple, so
          // the two can never disagree. Change-guarded: calling tweenDissolve every
          // frame would kill and rebuild the tween 60 times a second and the card
          // would never move.
          const wantReveal = active ? 1 : 0
          if (it.revealTarget !== wantReveal) {
            it.revealTarget = wantReveal
            tweenDissolve(it, wantReveal)
          }
        }
        bu.uHover.value += (it.targetHover - bu.uHover.value) * 0.065
        bu.uMouse.value.x += (it.mx - bu.uMouse.value.x) * 0.1
        bu.uMouse.value.y += (it.my - bu.uMouse.value.y) * 0.1

        const d = it.dissolve
        // A ramp, not a step: the ripple has to arrive WITH the reveal rather than
        // snapping on the frame the dissolve completes.
        bu.uRippleActive.value = Math.max(0, Math.min(1, (d - 0.9) / 0.1))
        // Dark while hidden, full once uncovered — this is what stops the two layers
        // reading as a plain cross-fade.
        bu.uDarkness.value = Math.max(0, 1 - Math.min(1, d * 1.1))

        const fu = it.frontMat.uniforms
        fu.uDissolve.value = d
        fu.uTime.value = t
        // Poster B&N fisso: il colore e' nel layer sottostante.
        fu.uGrayscale.value = 1
        fu.uEdgeIntensity.value = d * 0.5
        fu.uEdgeBrightness.value = 1 - d
        // CA lives only on the disintegration front; zero at idle (d === 0).
        fu.uCAAmplitude.value = d * 0.003

        const r = it.frame.getBoundingClientRect()
        const aspect = r.width / r.height
        bu.uPlaneAspect.value = aspect
        fu.uPlaneAspect.value = aspect
        it.renderer.render(it.scene, it.camera)
      }
      raf = requestAnimationFrame(tick)
    })()
  }

  function stopLoop() {
    running = false
    cancelAnimationFrame(raf)
  }

  const onResize = () => {
    for (const it of items) {
      const r = it.canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width))
      const h = Math.max(1, Math.round(r.height))
      if (it.canvas.width !== w * it.renderer.getPixelRatio() || it.canvas.height !== h * it.renderer.getPixelRatio()) {
        it.renderer.setSize(w, h, false)
      }
    }
  }
  window.addEventListener('resize', onResize, { passive: true })
  setTimeout(onResize, 50)

  const onVisibility = () => { if (!document.hidden) startLoop() }
  document.addEventListener('visibilitychange', onVisibility)

  return {
    frames,
    items,
    startLoop,
    stopLoop,
    disposeAll() {
      dead = true
      stopLoop()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const it of items) {
        try {
          it.frame.removeEventListener('pointermove', it.onMove)
          it.hoverZone.removeEventListener('pointerleave', it.onLeave)
          it.hoverZone.removeEventListener('pointerenter', it.onFrameEnter)
          // A live tween holds a reference to a uniform on a disposed renderer, so it
          // has to be killed here or it keeps writing after the context is gone.
          it.dissolveTween?.kill()
          it.renderer.dispose()
          it.renderer.forceContextLoss()
          it.scene.traverse(o => {
            if (o.geometry) o.geometry.dispose()
            if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material]
              mats.forEach(m => {
                if (m.uniforms && m.uniforms.uTex) m.uniforms.uTex.value?.dispose?.()
                m.dispose()
              })
            }
          })
        } catch (e) { }
      }
    }
  }
}

// GSAP drives uDissolve rather than the loop's own lerp. The 0.065 lerp exists to
// smooth a continuously-tracked cursor value; the dissolve is a discrete 0→1 event
// and needs a real curve, and GSAP is already this file's animation language.
//
// The two directions are NOT symmetric, deliberately. The forward pass is the one the
// visitor is actually watching — an image eroding away from its own centre — so it is
// slow (0.9s) and uses a full in-out curve, which gives the erosion somewhere to
// breathe at both ends instead of lunging out of the card. The reverse is the visitor
// letting go, so it stays short and ease-out: waiting out a ceremony on the way out
// reads as lag.
//
// Both start from the CURRENT value rather than 0, so re-entering mid-reverse continues
// from where it was instead of snapping to the start.
// 1.25s ma ease OUT: parte SUBITO al hover (niente inerzia iniziale) e rallenta
// verso la fine, evidenziando la sgretolatura a cella pixel invece di scattare.
const DISSOLVE_IN = { duration: 1.25, ease: 'power2.out' }
const DISSOLVE_OUT = { duration: 0.85, ease: 'power4.out' }

function tweenDissolve(item, to) {
  if (item.dissolveTween) item.dissolveTween.kill()
  const proxy = { v: item.dissolve }
  item.dissolveTween = gsap.to(proxy, {
    v: to,
    ...(to === 1 ? DISSOLVE_IN : DISSOLVE_OUT),
    // Skip the ones already there, so a re-enter on a fully-dissolved card does not
    // replay a 0.6s no-op.
    overwrite: true,
    onUpdate: () => { item.dissolve = proxy.v },
    onComplete: () => {
      item.dissolve = proxy.v
      item.dissolveTween = null
    },
  })
}

export { tweenDissolve };
export default function FeaturedGallery() {
  const [gridRef, gridInView] = useInView()
  const gridInViewRef = useRef(gridInView)
  const { isMobile, openCanvas, cursorRef } = useArchiveCursor()
  // buildGalleryGL is a plain function outside the component, so it cannot call the
  // hook itself; the gate is threaded in through cursorInput.
  const { isTouch, isAwake } = useCursorGate()
  useEffect(() => { gridInViewRef.current = gridInView }, [gridInView])

  const handleImageTap = useCallback((image, alignX = 0.5, alignY = 0.5) => {
    if (isTouch && !isAwake.current) {
      openCanvas(image, 'featured-ripple', { alignX, alignY })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAwake, openCanvas])

  // One WebGL context per card — six for this section — is the largest single GPU
  // consumer on the page, and Chrome's per-page context budget is finite. The
  // contexts are therefore not created until the gallery is actually on screen;
  // before that the section holds zero. After the first build they are kept, so
  // scrolling away and back does not rebuild them.
  const glBuiltRef = useRef(false)
  useEffect(() => {
    if (!gridInView || glBuiltRef.current) return
    const grid = gridRef.current
    if (!grid) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!shouldEnableSectionWebGL({ isMobile, reduceMotion })) return

    const frames = Array.from(grid.querySelectorAll('.gl-media__frame[data-gl-effect="ripple"]'))
    if (!frames.length) return
    const imgs = frames.map(f => f.querySelector('img')).filter(Boolean)

    let disposed = false
    // The back image is loaded straight from its URL by THREE.TextureLoader, so there
    // is no <img> to await here. buildGalleryGL counts both textures and only starts
    // the render loop once both have landed, which is what keeps the revealed layer
    // from flashing black mid-dissolve.
    Promise.all(imgs.map(img => img.complete
      ? Promise.resolve()
      : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        })
    )).then(() => {
      if (disposed || glBuiltRef.current) return
      const validFrames = frames.filter(f => f.querySelector('img') && f.querySelector('canvas.gl-media__canvas'))
      if (!validFrames.length) return
      // Rebuild only if the frame set changed — across StrictMode remounts the
      // DOM elements persist, so the cached renderers are reused as-is.
      if (!galleryGL || galleryGL.frames[0] !== validFrames[0]) {
        if (galleryGL) galleryGL.disposeAll()
        galleryGL = buildGalleryGL(validFrames, { isTouch, cursorRef, inViewRef: gridInViewRef, isCursorAwake: isAwake })
      }
      glBuiltRef.current = true
      galleryGL.startLoop()
    })
    return () => { disposed = true }
  }, [gridInView, isMobile, isTouch, cursorRef])

  // Disposal lives on unmount only. Tying it to the in-view effect would free the
  // contexts every time the section scrolled away, which is the cost we removed.
  useEffect(() => () => {
    if (galleryGL) {
      galleryGL.stopLoop()
      // disposeAll, not just stopLoop: the renderers, their geometries and the
      // resize/visibilitychange listeners otherwise survive the unmount.
      galleryGL.disposeAll()
    }
    // Must be cleared: StrictMode tears down and re-runs effects in dev, and a
    // still-true flag would make the in-view effect skip the rebuild, leaving the
    // gallery permanently without its WebGL.
    glBuiltRef.current = false
  }, [])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const ctx = gsap.context(() => {
      const figures = grid.querySelectorAll('.gl-media')
      figures.forEach((fig, i) => {
        gsap.fromTo(fig,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: i * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: fig,
              start: 'top 85%',
              once: true,
            }
          }
        )
        gsap.to(fig, {
          y: -20,
          ease: 'none',
          scrollTrigger: {
            trigger: fig,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
            invalidateOnRefresh: true,
          }
        })
      })
    }, grid)

    // Mobile tap handler
    const mobileClickHandler = (e) => {
      const fig = e.target.closest('.gl-media')
      if (!fig) return
      const img = fig.querySelector('img.gl-media__img')
      if (!img) return
      const frame = fig.querySelector('.gl-media__frame')
      const alignX = parseFloat(frame?.dataset.alignX) || 0.5
      const alignY = parseFloat(frame?.dataset.alignY) || 0.5
      handleImageTap(img.src, alignX, alignY)
    }
    grid.addEventListener('click', mobileClickHandler)

    return () => {
      // No GL teardown here: ownership lives in the unmount-only effect above, so
      // that scrolling the gallery out of view does not free the contexts.
      ctx?.revert()
      grid.removeEventListener('click', mobileClickHandler)
    }
  }, [handleImageTap])

  return (
    <section className="featured-region" id="featured" aria-labelledby="featured-title">
      <div className="container">
        <div className="section-head gsap-reveal">
          <h2 id="featured-title">UX\UI Design</h2>
          <span className="count">6 works · 2022 – 2026</span>
        </div>
        <div className="featured-grid" ref={gridRef}>
          {featured.map((item) => (
            <figure className="gl-media" key={item.name} aria-label={item.name}>
              <span
                className="gl-media__frame"
                data-gl-effect="ripple"
                data-align-x={item.align[0]}
                data-align-y={item.align[1]}
                data-img-back={item.imgBack}
              >
                <canvas className="gl-media__canvas" aria-hidden="true"></canvas>
                <img
                  className="gl-media__img"
                  src={`/assets/images/projects/${item.img}`}
                  alt={`${item.name} — poster`}
                  loading="lazy"
                />
              </span>
              <figcaption className="gl-media__cap">
                <span className="gl-media__name">{item.name}</span>
                <span className="gl-media__role">{item.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
