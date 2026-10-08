// src/hero-glass/engine.js
// Isolated Three.js mount. No React, GSAP, ScrollTrigger, CSS or preloader.

import * as THREE from 'three'
import {
  BOUNDING_RADIUS,
  CAMERA_Z,
  LOGO_GLASS,
  LOGO_OSC,
  LOGO_SPIN,
  LOGO_TILT,
  LOGO_X_LIMIT,
  REDUCED_ROTATION,
  ROTATION,
  layoutFor,
  logoLayoutFor,
  logoParallaxYFor,
  logoPlacementFor,
  logoScaleFor,
  parallaxYFor,
  readSiteBackground,
  torusPlacementFor,
  torusScaleFor,
} from './params.js'
import { buildEnvironment, buildTorusKnot } from './geometry.js'
import { buildLogoMesh, logoNaturalSize } from './logoMesh.js'
import { createBackdrop } from './backdrop.js'
import { createTextLayer } from './textLayer.js'
import { normalizeRows } from './textRows.js'
import { pixelRatioFor } from '../utils/renderScale.js'

export async function mountTorusKnot(canvas, options = {}) {
  if (!canvas) return null

  const { animated = true, textStyles = {} } = options
  const textRows = normalizeRows(options.rows)

  let renderer = null
  let scene = null
  let camera = null
  let startedAt = 0
  let envMap = null
  let torus = null
  let logo = null
  let logoGeometry = null
  let logoMaterial = null
  let logoSize = null
  let backdrop = null
  let textLayer = null
  let lastBox = null
  let lastScreen = null
  let isDisposed = false
  const pointer = { x: 0, y: 0 }
  let scrollProgress = 0
  let lastPauseToggle = 0

  // The resolution policy lives in utils/renderScale.js; this is only the three.js
  // binding of it. It used to be `Math.min(devicePixelRatio, 2)` written twice,
  // which is a ceiling on the multiplier and not a budget: at 2560x1440 on a
  // retina display that is 5120x2880, 14.7 Mpx, measured on this section — the
  // largest surface on the site. Declared here so mount and resize cannot drift.
  function applyPixelRatio(cssWidth, cssHeight) {
    if (!renderer) return
    renderer.setPixelRatio(
      pixelRatioFor(
        Math.max(cssWidth || 0, 1),
        Math.max(cssHeight || 0, 1),
        typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      ),
    )
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    applyPixelRatio(canvas.clientWidth, canvas.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.NoToneMapping

    // Production only. The PMREM GGX pass makes the ANGLE driver log X4122
    // constant-folding warnings for three's own shader; checkShaderErrors is the
    // only lever, and it must stay on in dev or a shader that fails to compile
    // becomes a silently invisible object.
    renderer.debug.checkShaderErrors = !import.meta.env.PROD

    // clientWidth/Height, not canvas.width/height: the latter is the backing
  // store (CSS px × dpr), which halves the aspect on a 2x display and skews
  // the framing. resize() below already uses the CSS box.
  const aspect = (canvas.clientWidth || 1) / Math.max(canvas.clientHeight || 1, 1)
    camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 100)
    camera.position.z = CAMERA_Z

    scene = new THREE.Scene()
    envMap = buildEnvironment(renderer)
    scene.environment = envMap

    function applyFraming(width) {
      const layout = layoutFor(width)
      const scale = torusScaleFor(camera) * layout.scaleMultiplier
      torus.scale.setScalar(scale)
      const rest = torusPlacementFor(camera, scale, layout)
      torus.position.x = rest.x
      torus.position.y = rest.y + parallaxYFor(
        rest.y,
        scale * BOUNDING_RADIUS,
        scrollProgress,
        layout.parallax,
      )

      // Second object: the brand mark. It rises on scroll (logoParallaxYFor),
      // against the sinking torus, so the pair separates as the hero leaves.
      if (logo && logoSize) {
        const logoLayout = logoLayoutFor(width)
        const logoScale = logoScaleFor(camera, logoSize.y, logoLayout)
        // Negative Y: the SVG extrude is y-down, this turns it upright.
        // three flips frontFace for negative-determinant matrices, so the
        // glass shades exactly like a normally-wound mesh.
        logo.scale.set(logoScale, -logoScale, logoScale)
        const half = {
          x: (logoSize.x * logoScale) / 2,
          y: (logoSize.y * logoScale) / 2,
        }
        const logoRest = logoPlacementFor(camera, half, logoLayout)
        logo.position.x = logoRest.x
        logo.position.y =
          logoRest.y + logoParallaxYFor(camera, scrollProgress, logoLayout.parallax)
      }
    }

    const built = buildTorusKnot()
    torus = built.mesh
    scene.add(torus)

    // The mark must never take the hero down: a bad SVG parse skips the logo
    // and the torus + text still mount.
    try {
      const logoBuilt = buildLogoMesh()
      logo = logoBuilt.mesh
      logo.rotation.set(LOGO_TILT.x, LOGO_TILT.y, LOGO_TILT.z)
      logoGeometry = logoBuilt.geometry
      logoMaterial = logoBuilt.material
      logoSize = logoNaturalSize(logoGeometry)
      scene.add(logo)
    } catch (logoError) {
      console.warn('[hero-glass] logo skipped', logoError)
      logo = null
      logoGeometry = null
      logoMaterial = null
      logoSize = null
    }

    applyFraming(window.innerWidth || canvas.width || 1)

    backdrop = createBackdrop({ color: readSiteBackground() })
    backdrop.fitToViewport(camera)
    scene.add(backdrop.mesh)

    textLayer = createTextLayer({
      renderer,
      camera,
      fontFamily: textStyles.fontFamily || 'serif',
      fontWeight: textStyles.fontWeight || 'normal',
      color: textStyles.color || '#111111',
      accentColor: textStyles.accentColor || textStyles.color || '#083D2A',
      lineHeight: textStyles.lineHeight || .71,
    })
    scene.add(textLayer.group)

    function applyText() {
      if (!textLayer || !lastBox || !lastScreen) return
      textLayer.build(textRows, { box: lastBox, screen: lastScreen })
    }

    function frame() {
      const t = (performance.now() - startedAt) / 1000
      torus.rotation.x = t * ROTATION.xSpeed + pointer.y * ROTATION.pointerY
      torus.rotation.y = t * ROTATION.ySpeed + pointer.x * ROTATION.pointerX
      // The mark spins on top of its presentation tilt, gentler than the
      // torus, with a softer pointer drift. The micro-surface map drifts on
      // the same clock so the glass stays alive; frozen clock (reduced
      // motion) simply holds the distortion still.
      if (logo) {
        // X in ping-pong dentro ±31°: il seno rallenta agli estremi e torna
        // indietro in loop, mai girotondo, mai capovolto. Clamp solo di guardia.
        const oscX = Math.sin(t * LOGO_OSC.speed) * LOGO_OSC.amplitude
        const rawX = LOGO_TILT.x + oscX + pointer.y * LOGO_SPIN.pointerX
        logo.rotation.x = Math.max(-LOGO_X_LIMIT, Math.min(LOGO_X_LIMIT, rawX))
        logo.rotation.y = LOGO_TILT.y + t * LOGO_SPIN.ySpeed + pointer.x * LOGO_SPIN.pointerY
        if (logoMaterial && logoMaterial.normalMap) {
          logoMaterial.normalMap.offset.x = (t * LOGO_GLASS.driftX) % 1
          logoMaterial.normalMap.offset.y = (t * LOGO_GLASS.driftY) % 1
        }
      }
      textLayer.update(t)
      renderer.render(scene, camera)
    }

    if (animated) {
      startedAt = performance.now()
      renderer.setAnimationLoop(frame)
    } else {
      torus.rotation.set(REDUCED_ROTATION.x, REDUCED_ROTATION.y, REDUCED_ROTATION.z)
      renderer.render(scene, camera)
    }

    return {
      resize(width, height, box) {
        if (isDisposed || !renderer) return
        const w = Math.max(width, 1)
        const h = Math.max(height, 1)
        applyPixelRatio(w, h)
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        applyFraming(window.innerWidth || w)
        backdrop.fitToViewport(camera)
        lastScreen = { width: w, height: h }
        if (box) lastBox = box
        applyText()
      },

      // Called once the webfont resolves: the fit measured on the fallback face
      // is wrong, and the atlas is rasterised text, not a live DOM box.
      rebuildText(box) {
        if (isDisposed) return
        if (box) lastBox = box
        applyText()
        if (!animated) renderer.render(scene, camera)
      },

      textStatus() {
        return {
          rows: textRows.length,
          planes: textLayer ? textLayer.rowCount : 0,
          behind: textRows.filter((row) => row.behind).length,
        }
      },

      setScrollProgress(progress) {
        if (isDisposed) return
        scrollProgress = progress
        applyFraming(window.innerWidth || 1)
        if (!animated) renderer.render(scene, camera)
      },

      setPointer(nx, ny) {
        pointer.x = nx
        pointer.y = ny
      },

      // Visibility gate — no-op unless animated, so reduced-motion never
      // gets a running loop back. Ignora toggle rapidi (<100ms): l'IO con
      // margine spara true->false->true in scroll veloce e ogni toggle
      // riavvia il loop GL a meta-frame = flicker.
      setPaused(paused) {
        if (isDisposed || !renderer || !animated) return
        const now = typeof performance !== 'undefined' ? performance.now() : 0
        if (now - lastPauseToggle < 100) return
        lastPauseToggle = now
        renderer.setAnimationLoop(paused ? null : frame)
      },

      status() {
        return {
          rotationX: torus ? torus.rotation.x : 0,
          rotationY: torus ? torus.rotation.y : 0,
          scale: torus ? torus.scale.x : 0,
          backdropColor: backdrop ? `#${backdrop.material.color.getHexString()}` : '',
          animated,
          disposed: isDisposed,
        }
      },

      dispose() {
        if (isDisposed) return
        isDisposed = true
        if (renderer) renderer.setAnimationLoop(null)
        if (torus) {
          scene.remove(torus)
          torus.geometry.dispose()
          torus.material.dispose()
          torus = null
        }
        if (logo) {
          scene.remove(logo)
          if (logoGeometry) logoGeometry.dispose()
          if (logoMaterial) {
            if (logoMaterial.normalMap) logoMaterial.normalMap.dispose()
            logoMaterial.dispose()
          }
          logo = null
          logoGeometry = null
          logoMaterial = null
          logoSize = null
        }
        if (backdrop) {
          scene.remove(backdrop.mesh)
          backdrop.dispose()
          backdrop = null
        }
        if (textLayer) {
          scene.remove(textLayer.group)
          textLayer.dispose()
          textLayer = null
        }
        if (envMap) {
          envMap.dispose()
          envMap = null
        }
        scene = null
        camera = null
        startedAt = 0
        if (renderer) {
          renderer.dispose()
          renderer = null
        }
      },
    }
  } catch (err) {
    if (torus) {
      if (scene) scene.remove(torus)
      torus.geometry.dispose()
      torus.material.dispose()
      torus = null
    }
    if (logo) {
      if (scene) scene.remove(logo)
      if (logoGeometry) logoGeometry.dispose()
      if (logoMaterial) {
        if (logoMaterial.normalMap) logoMaterial.normalMap.dispose()
        logoMaterial.dispose()
      }
      logo = null
      logoGeometry = null
      logoMaterial = null
      logoSize = null
    }
    if (backdrop) {
      if (scene) scene.remove(backdrop.mesh)
      backdrop.dispose()
      backdrop = null
    }
    if (textLayer) {
      if (scene) scene.remove(textLayer.group)
      textLayer.dispose()
      textLayer = null
    }
    if (envMap) envMap.dispose()
    if (renderer) renderer.dispose()
    throw err
  }
}
