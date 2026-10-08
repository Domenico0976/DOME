import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  vertexShader as featuredVertexShader,
  fragmentShader as featuredFragmentShader,
} from './FeaturedGallery'
import { tweenDissolve } from './FeaturedGallery'
import {
  dissolveVertexShader,
  dissolveFrontFragment,
  dissolveBackFragment,
} from '../shaders/dissolve'
import {
  vertexShader as tilesVertexShader,
  fragmentShader as tilesFragmentShader,
} from './SelectedProjects'
import { useCursorGate } from '../hooks/useCursorGate'

const TILE_CELL_PX = 60

export default function MobileSectionCanvas({
  effectType,
  image,
  cursorRef,
  glLockRef = { current: false },
  effectOpts = null,
  style,
}) {
  const canvasRef = useRef(null)
  const optsRef = useRef(effectOpts)
  optsRef.current = effectOpts
  // Gate sveglio-parcheggiato, stessa semantica del tick desktop (FeaturedGallery).
  const { isOver } = useCursorGate()

  const reduceMotion = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  , [])

  useEffect(() => {
    if (reduceMotion) return
    const canvas = canvasRef.current
    if (!canvas || !image) return

    const isTiles = effectType === 'tile-reveal'
    const isDissolve = effectType === 'featured-ripple'
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: isTiles || isDissolve })
    } catch (e) {
      canvas.style.display = 'none'
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    if (isDissolve) renderer.setClearColor(0x000000, 0)
    else if (!isTiles) renderer.setClearColor(0x000000, 1)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    camera.position.z = 1

    const uniforms = {
      uTex: { value: null },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uPlaneAspect: { value: 1 },
      uImgAspect: { value: 1 },
    }
    let material
    let backMat = null
    let frontMat = null
    let backMesh = null
    let frontMesh = null
    // Proxy compatibile con tweenDissolve del desktop (dissolve + dissolveTween).
    const dissState = { dissolve: 0, dissolveTween: null, revealTarget: 0, targetHover: 0, mx: 0.5, my: 0.5 }
    if (isTiles) {
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      uniforms.uReveal = { value: 1 }
      uniforms.uGrid = { value: new THREE.Vector2(
        Math.max(4, Math.round(w / TILE_CELL_PX)),
        Math.max(4, Math.round(h / TILE_CELL_PX)),
      ) }
      uniforms.uSeed = { value: Math.random() * 100.0 }
      material = new THREE.ShaderMaterial({
        uniforms, vertexShader: tilesVertexShader, fragmentShader: tilesFragmentShader, transparent: true,
      })
    } else if (isDissolve) {
      // Coppia dissolve identica al desktop: dietro colore+ripple, davanti B&N
      // che si disintegra (uGrayscale=1 forza il B&N da una sola texture).
      const opts = optsRef.current || {}
      const align = new THREE.Vector2(
        Number.isFinite(opts.alignX) ? opts.alignX : 0.5,
        Number.isFinite(opts.alignY) ? opts.alignY : 0.5,
      )
      backMat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: null },
          uTime: { value: 0 },
          uHover: { value: 0 },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uPlaneAspect: { value: 1 },
          uImgAspect: { value: 1 },
          uAlign: { value: align },
          uRippleActive: { value: 0 },
          uDarkness: { value: 1 },
        },
        vertexShader: dissolveVertexShader, fragmentShader: dissolveBackFragment, transparent: false,
      })
      frontMat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: null },
          uDissolve: { value: 0 },
          uCenter: { value: new THREE.Vector2(0.5, 0.5) },
          uPlaneAspect: { value: 1 },
          uImgAspect: { value: 1 },
          uAlign: { value: align },
          uGrayscale: { value: 1 },
          uEdgeIntensity: { value: 0 },
          uEdgeBrightness: { value: 1 },
          uPixelSize: { value: 24.0 },
          uCAAmplitude: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: dissolveVertexShader, fragmentShader: dissolveFrontFragment, transparent: true,
      })
      backMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backMat)
      backMesh.position.z = -0.1
      frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), frontMat)
      scene.add(backMesh)
      scene.add(frontMesh)
      material = frontMat
    } else {
      const opts = optsRef.current || {}
      uniforms.uAlign = { value: new THREE.Vector2(
        Number.isFinite(opts.alignX) ? opts.alignX : 0.5,
        Number.isFinite(opts.alignY) ? opts.alignY : 0.5,
      ) }
      material = new THREE.ShaderMaterial({
        uniforms, vertexShader: featuredVertexShader, fragmentShader: featuredFragmentShader, transparent: false,
      })
    }
    const mesh = (!isDissolve) ? new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      material,
    ) : null
    if (mesh) scene.add(mesh)

    const resize = () => {
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      if (glLockRef.current) {
        uniforms.uPlaneAspect.value = w / h
        if (backMat) backMat.uniforms.uPlaneAspect.value = w / h
        if (frontMat) frontMat.uniforms.uPlaneAspect.value = w / h
        return
      }
      renderer.setSize(w, h, false)
      uniforms.uPlaneAspect.value = w / h
      if (backMat) backMat.uniforms.uPlaneAspect.value = w / h
      if (frontMat) frontMat.uniforms.uPlaneAspect.value = w / h
    }

    let raf = 0
    let disposed = false
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    const hover = { target: 0, mx: 0.5, my: 0.5 }
    const startTime = performance.now()
    const tick = () => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      uniforms.uTime.value = (performance.now() - startTime) / 1000
      const r = canvas.getBoundingClientRect()
      const cur = cursorRef?.current
      if (isDissolve && backMat && frontMat) {
        // Stessa logica del tick desktop: reveal segue il parked cursor sveglio.
        const active = isOver(r)
        if (active && cur) {
          dissState.targetHover = 1
          dissState.mx = (cur.x - r.left) / r.width
          dissState.my = 1 - (cur.y - r.top) / r.height
        } else {
          dissState.targetHover = 0
        }
        const wantReveal = active ? 1 : 0
        if (dissState.revealTarget !== wantReveal) {
          dissState.revealTarget = wantReveal
          tweenDissolve(dissState, wantReveal)
        }
        const bu = backMat.uniforms
        bu.uTime.value = uniforms.uTime.value
        bu.uHover.value += (dissState.targetHover - bu.uHover.value) * 0.065
        bu.uMouse.value.x += (dissState.mx - bu.uMouse.value.x) * 0.1
        bu.uMouse.value.y += (dissState.my - bu.uMouse.value.y) * 0.1
        const d = dissState.dissolve
        bu.uRippleActive.value = Math.max(0, Math.min(1, (d - 0.9) / 0.1))
        bu.uDarkness.value = Math.max(0, 1 - Math.min(1, d * 1.1))
        const fu = frontMat.uniforms
        fu.uDissolve.value = d
        fu.uTime.value = uniforms.uTime.value
        fu.uGrayscale.value = 1
        fu.uEdgeIntensity.value = d * 0.5
        fu.uEdgeBrightness.value = 1 - d
        fu.uCAAmplitude.value = d * 0.003
        if (r.width > 0 && r.height > 0) {
          bu.uPlaneAspect.value = r.width / r.height
          fu.uPlaneAspect.value = r.width / r.height
        }
      } else {
        const inside = !!cur && r.width > 0 && r.height > 0
          && cur.x >= r.left && cur.x <= r.right && cur.y >= r.top && cur.y <= r.bottom
        if (inside) {
          hover.target = 1
          hover.mx = (cur.x - r.left) / r.width
          hover.my = 1 - (cur.y - r.top) / r.height
        } else {
          hover.target = 0
        }
        uniforms.uHover.value += (hover.target - uniforms.uHover.value) * 0.065
        uniforms.uMouse.value.x += (hover.mx - uniforms.uMouse.value.x) * 0.1
        uniforms.uMouse.value.y += (hover.my - uniforms.uMouse.value.y) * 0.1
        if (r.width > 0 && r.height > 0) uniforms.uPlaneAspect.value = r.width / r.height
      }
      renderer.render(scene, camera)
    }

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(image,
      (tex) => {
        if (disposed) { tex.dispose(); return }
        tex.minFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        if (!isTiles) tex.colorSpace = THREE.SRGBColorSpace
        uniforms.uTex.value = tex
        uniforms.uImgAspect.value = (tex.image?.width && tex.image?.height)
          ? tex.image.width / tex.image.height : 1
        // Stessa texture per entrambi i layer dissolve (il davanti forza B&N via shader).
        if (backMat) {
          backMat.uniforms.uTex.value = tex
          backMat.uniforms.uImgAspect.value = uniforms.uImgAspect.value
        }
        if (frontMat) {
          frontMat.uniforms.uTex.value = tex
          frontMat.uniforms.uImgAspect.value = uniforms.uImgAspect.value
        }
        resize()
        canvas.style.display = 'block'
        tick()
      },
      undefined,
      () => { if (!disposed) canvas.style.display = 'none' },
    )

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (dissState.dissolveTween) dissState.dissolveTween.kill()
      if (mesh) mesh.geometry.dispose()
      material.dispose()
      if (backMesh) backMesh.geometry.dispose()
      if (backMat) backMat.dispose()
      if (frontMesh) frontMesh.geometry.dispose()
      if (frontMat) frontMat.dispose()
      if (uniforms.uTex.value) uniforms.uTex.value.dispose()
      renderer.dispose()
    }
  }, [image, effectType, reduceMotion, cursorRef, glLockRef])

  if (reduceMotion) return null
  return (
    <canvas
      ref={canvasRef}
      className="mobile-section-canvas__gl"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'none', ...style }}
    />
  )
}
