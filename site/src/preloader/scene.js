// Three.js single-pass renderer for the preloader shader.
//
// One fullscreen quad, one fragment shader (see shader.js — designed with the
// /www-gl.md skill: Pixelate tiling/quantization + BlockDissolve mask logic).
// dpr capped (2 desktop / 1.5 mobile). Throws if WebGL is unavailable so the
// orchestrator (index.js) can fall back to the DOM path.

import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shader.js'
import { createCounterTexture } from './counter-texture.js'
import { FRONT_PROFILE } from './wavefront.js'
import { TILE_SIZE } from './config.js'
import { pixelRatioFor } from '../utils/renderScale.js'

const GREY = new THREE.Vector3(0xad / 255, 0xa8 / 255, 0x9f / 255) // warm grey opening
const PAPER = new THREE.Vector3(0xf5 / 255, 0xf1 / 255, 0xea / 255) // #F5F1EA
const INK = new THREE.Vector3(0x11 / 255, 0x11 / 255, 0x11 / 255) // #111

// The preloader canvas used to ask for min(dpr, 2) on a full-viewport surface —
// 5120x2880, 14.7 Mpx, measured — making the loading screen the largest renderer
// on the site while the site it covers was still loading. The counter is a
// texture with its own size, and the rest is a soft tile wave, so the budget costs
// nothing here.
function dprFor(width, height) {
  return pixelRatioFor(width, height, window.devicePixelRatio || 1)
}

export function createPreloaderScene(parent, { reducedMotion = false } = {}) {
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

  const scene = new THREE.Scene()
  const camera = new THREE.Camera()

  const counter = createCounterTexture()
  const counterTex = new THREE.CanvasTexture(counter.canvas)
  counterTex.minFilter = THREE.NearestFilter
  counterTex.magFilter = THREE.NearestFilter
  counterTex.generateMipmaps = false

  const uniforms = {
    uCounter: { value: counterTex },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTileSize: { value: TILE_SIZE },
    uReveal: { value: 0 },
    uFront: { value: 0 },
    uFrontMode: { value: 0 },
    uShowTiles: { value: 0 },
    uAberration: { value: 0.85 },
    uGrain: { value: 0.5 },
    uBand: { value: FRONT_PROFILE.band },
    uCore: { value: FRONT_PROFILE.core },
    uTrail: { value: FRONT_PROFILE.trail },
    uEdge: { value: 0.006 },
    uGrey: { value: GREY },
    uPaper: { value: PAPER },
    uInk: { value: INK },
    uTime: { value: 0 },
    uReducedMotion: { value: reducedMotion ? 1 : 0 },
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
  }
  resize()

  const startedAt = performance.now()
  let rafId = 0
  let disposed = false

  function frame() {
    if (disposed) return
    uniforms.uTime.value = (performance.now() - startedAt) / 1000
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(frame)
  }
  rafId = requestAnimationFrame(frame)

  return {
    canvas,
    scene,
    camera,
    renderer,
    setFront(p) {
      uniforms.uFront.value = p
    },
    setFrontMode(mode) {
      uniforms.uFrontMode.value = mode
    },
    setShowTiles(on) {
      uniforms.uShowTiles.value = on ? 1 : 0
    },
    setReveal(p) {
      uniforms.uReveal.value = p
    },
    setReducedMotion(b) {
      uniforms.uReducedMotion.value = b ? 1 : 0
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
      counterTex.dispose()
      renderer.dispose()
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    },
  }
}
