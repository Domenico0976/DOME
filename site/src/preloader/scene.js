// Three.js renderer for the preloader — V3, two passes, ONE WebGL context.
//
//   Pass A: the text ring (ring.js, same strip/geometry as HeroTextRing) is
//           drawn into a WebGLRenderTarget sized to the drawing buffer.
//   Pass B: one fullscreen quad, one fragment shader (see shader.js — designed
//           with the /www-gl.md skill: Pixelate tiling + BlockDissolve mask)
//           samples that target + the grid-res counter bitmap and kills cells
//           per tile. Uniform uContent is the RT texture; uPhase picks the
//           machine (0 = consume the preload, 1 = shrinking cover).
//
// dpr capped (pixelRatioFor). Throws if WebGL is unavailable so the
// orchestrator (index.js) can fall back.

import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shader.js'
import { createCounterTexture } from './counter-texture.js'
import { createRingRig } from './ring.js'
import { FRONT_PROFILE, sweepFront } from './wavefront.js'
import { TILE_SIZE, COVER_START } from './config.js'
import { pixelRatioFor } from '../utils/renderScale.js'

const BG = new THREE.Vector3(0.9608, 0.9451, 0.9176) // paper field / cover colour
const INK = new THREE.Vector3(0.0667, 0.0667, 0.0667) // ink counter digits
const RING_INK = 0x111111

// The preloader canvas used to ask for min(dpr, 2) on a full-viewport surface —
// 5120x2880, 14.7 Mpx, measured — making the loading screen the largest renderer
// on the site while the site it covers was still loading. The counter is a
// texture with its own size, and the rest is a soft tile wave, so the budget costs
// nothing here.
function dprFor(width, height) {
  return pixelRatioFor(width, height, window.devicePixelRatio || 1)
}

export function createPreloaderScene(parent) {
  const canvas = document.createElement('canvas')
  canvas.className = 'preloader__gl'
  parent.appendChild(canvas)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
  })
  renderer.setClearColor(0x000000, 0)
  // resize() below recomputes this from the measured box; set it here too so the
  // very first frame is not rendered at an uncapped ratio.
  renderer.setPixelRatio(
    dprFor(parent.clientWidth || window.innerWidth, parent.clientHeight || window.innerHeight),
  )

  // ── pass B: the fullscreen tile quad ──────────────────────────────────────
  const scene = new THREE.Scene()
  const camera = new THREE.Camera()

  const counter = createCounterTexture()
  const counterTex = new THREE.CanvasTexture(counter.canvas)
  counterTex.minFilter = THREE.NearestFilter
  counterTex.magFilter = THREE.NearestFilter
  counterTex.generateMipmaps = false

  // Pass-A target. Sized to the drawing buffer in resize() so the RT sampling
  // stays pixel-aligned with the tile grid math in the fragment shader.
  const rt = new THREE.WebGLRenderTarget(2, 2, {
    depthBuffer: true,
    stencilBuffer: false,
  })

  const uniforms = {
    uContent: { value: rt.texture },
    uCounter: { value: counterTex },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTileSize: { value: TILE_SIZE },
    // Parked off the corner: sweepFront(0) = -band, so with a fresh scene the
    // wave-1 front consumes nothing — exactly the standby look.
    uFront: { value: sweepFront(0) },
    uCoverR: { value: COVER_START },
    uPhase: { value: 0 },
    uGrain: { value: 0.5 },
    uTrail: { value: FRONT_PROFILE.trail },
    uBG: { value: BG },
    uInk: { value: INK },
    uTime: { value: 0 },
    uDigitGate: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  scene.add(mesh)

  // ── pass A: the text ring ───────────────────────────────────────────────────
  const ringRig = createRingRig({ ink: RING_INK })
  const ringScene = new THREE.Scene()
  ringScene.add(ringRig.group)

  function resize() {
    const w = parent.clientWidth || window.innerWidth
    const h = parent.clientHeight || window.innerHeight
    renderer.setPixelRatio(dprFor(w, h))
    renderer.setSize(w, h, false)
    uniforms.uResolution.value.set(w, h)
    const gw = Math.max(1, Math.floor(w / TILE_SIZE))
    const gh = Math.max(1, Math.floor(h / TILE_SIZE))
    counter.resize(gw, gh)
    counterTex.needsUpdate = true
    // RT to the actual drawing buffer: on a dpr-capped screen this keeps the
    // ring silhouette pixel-aligned with the tile grid above it.
    const buf = new THREE.Vector2()
    renderer.getDrawingBufferSize(buf)
    rt.setSize(Math.max(2, Math.round(buf.x)), Math.max(2, Math.round(buf.y)))
    ringRig.resize(w, h)
  }
  resize()

  // Warm-up front: compile both passes NOW (mount time), so the first frame
  // after the click has no program-build hitch. compileAsync is async; on old
  // three builds fall back to the synchronous compile. Failures never reject —
  // the first regular draw reports the error instead.
  const ready = Promise.resolve().then(() => {
    const jobs = []
    if (typeof renderer.compileAsync === 'function') {
      jobs.push(renderer.compileAsync(scene, camera))
      jobs.push(renderer.compileAsync(ringScene, ringRig.camera))
    } else {
      jobs.push(Promise.resolve().then(() => renderer.compile(scene, camera)))
      jobs.push(Promise.resolve().then(() => renderer.compile(ringScene, ringRig.camera)))
    }
    return Promise.all(jobs).catch((err) => {
      console.error('[preloader] shader warm-up failed (continuing on first draw):', err)
    })
  })

  const startedAt = performance.now()
  let rafId = 0
  let disposed = false

  function frame() {
    if (disposed) return
    const nowMs = performance.now()
    const t = (nowMs - startedAt) / 1000
    uniforms.uTime.value = t
    ringRig.update(nowMs)
    // Only feed the RT while the tile shader can consume it: in phase 1 (the
    // shrinking cover) the content is dead anyway — skip pass A entirely.
    if (uniforms.uPhase.value < 0.5) {
      // autoClear gives each pass a fresh canvas/RT; the RT clears to the
      // renderer's transparent black, so untouched RT pixels stay alpha 0.
      renderer.setRenderTarget(rt)
      renderer.render(ringScene, ringRig.camera)
      renderer.setRenderTarget(null)
    }
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(frame)
  }
  rafId = requestAnimationFrame(frame)

  return {
    canvas,
    scene,
    camera,
    renderer,
    ready,
    setPhase(mode) {
      uniforms.uPhase.value = mode >= 0.5 ? 1 : 0
    },
    setFront(p) {
      uniforms.uFront.value = p
    },
    setCoverR(r) {
      uniforms.uCoverR.value = r
    },
    setDigitGate(v) {
      uniforms.uDigitGate.value = v
    },
    setRingDock(p) {
      ringRig.setDock(p)
    },
    redrawCounter(value) {
      if (counter.update(value)) counterTex.needsUpdate = true
    },
    getStats() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
      }
    },
    resize,
    dispose() {
      disposed = true
      cancelAnimationFrame(rafId)
      mesh.geometry.dispose()
      material.dispose()
      rt.dispose()
      ringRig.dispose()
      counterTex.dispose()
      renderer.dispose()
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    },
  }
}
