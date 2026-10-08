/**
 * HeroStar — 4-point inflated chrome star composited at the bottom-left
 * of the text-entry section (Approach C, V1).
 *
 * Architecture:
 *   - Single THREE.Group (rig) anchored bottom-left via CSS
 *   - ONE mesh + ShaderMaterial (mercuryStar.js) + ONE wire LineSegments
 *   - stayAlive clock never pauses; morph driven by scroll %
 *   - LookAt via Quaternion.slerpQuaternions, single write per frame
 *
 * Verbatim kept: portal, useIsMobile/useCursorGate, MutationObserver,
 * IntersectionObserver, MQL, square-guard+settle+ResizeObserver,
 * docPtrRef fallback, dispose (trimmed).
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useCursorGate } from '../../hooks/useCursorGate'
import { pixelRatioFor } from '../../utils/renderScale'
import {
  vertexShader,
  fragmentShader,
} from '../../shaders/mercuryStar.js'

const STAR_DESKTOP_CSS = 130
const STAR_MOBILE_CSS  = 72
const LEFT_DESKTOP     = 'clamp(14px, 3.2vw, 44px)'
const LEFT_MOBILE      = 'clamp(8px, 4vw,  24px)'
const BOTTOM_DESKTOP   = 'clamp(14px, 3.5vh, 52px)'
const BOTTOM_MOBILE    = 'clamp(8px, 4vh,  28px)'
const W_LOOK           = 3        // blend-back speed (dt*)
const PARALLAX_Y        = 1.6      // GL units, equivalent to 200px CSS
const PARALLAX_LERP     = 4        // smoothing dt*4
const PARALLAX_DEADBAND = 0.0005
const MORPH_SMOOTH_LO   = 0.15
const MORPH_SMOOTH_HI   = 0.85
const Q_CLAMP_RAD       = 0.35     // ±35° LookAt clamp
const Q_LOOK_SPEED      = 5        // slerp 5/s
const FLOAT_AMP         = 0.03     // sin(0.8t)
const FLOAT_AMP2        = 0.02     // cos(0.6t)
const BREATH_AMP        = 0.015    // sin(1.4t)
const ROT_SPEED         = 0.25     // rad/s around Z
const RAYCAST_MAX_DIST  = 10       // cap for object-space hit
const EPS               = 1e-4

export default function HeroStar() {
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)
  const glRef        = useRef(null)
  const rafRef       = useRef(0)
  const hoveredRef   = useRef(false)
  const scrollRef    = useRef(0)
  const ptrNormRef   = useRef({ x: 0.5, y: 0.5 })
  const docPtrRef    = useRef({ x: -9999, y: -9999 })
  const clockRef     = useRef({ elapsed: 0, delta: 0 })

  const isMobile = useIsMobile()
  const { isAwake, parked } = useCursorGate()

  const leftPos   = isMobile ? LEFT_MOBILE      : LEFT_DESKTOP
  const bottomPos = isMobile ? BOTTOM_MOBILE    : BOTTOM_DESKTOP
  const starSize  = isMobile ? STAR_MOBILE_CSS  : STAR_DESKTOP_CSS

  const [prefersReduced, setPrefersReduced] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setPrefersReduced(e.matches)
    mq.addEventListener('change', onChange, { passive: true })
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const [visible, setVisible] = useState(true)
  const [portalTarget, setPortalTarget] = useState(null)

  // ── Three.js boot ───────────────────────────────────────────
  useEffect(() => {
    if (prefersReduced) return
    if (!portalTarget || !visible) return
    const canvas = canvasRef.current
    if (!canvas) return

    const initW = Math.max(canvas.clientWidth, 1)
    const initH = Math.max(canvas.clientHeight, 1)
    if (initW >= 10 && initH >= 10) {
      canvas.width = initW
      canvas.height = initH
    }

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    } catch {
      canvas.style.display = 'none'
      return
    }
    const pr = pixelRatioFor(initW, initH, undefined, { max: 1.5 })
    renderer.setPixelRatio(pr)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.z = 5

    // ── ShaderMaterial from mercuryStar.js ───────────────────
    const starMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time:           { value: 0 },
        u_morph:          { value: 0 },
        u_front:          { value: 0 },
        u_speed:          { value: 0.82 },
        u_gradientAngle:  { value: 198 },
        u_scale:          { value: 1.387 },
        u_turbAmp:        { value: 1.02 },
        u_turbFreq:       { value: 0.997 },
        u_waveFreq:       { value: 2.362 },
        u_edgeDistance:   { value: 0.023 },
        u_reflection:     { value: 0.64 },
        u_contourStrength:{ value: 0.81 },
        u_colA1:          { value: new THREE.Color(0x001417) },
        u_colA2:          { value: new THREE.Color(0x0d6b7a) },
        u_colA3:          { value: new THREE.Color(0x3bdcff) },
        u_colA4:          { value: new THREE.Color(0xd9f7ff) },
        u_colB1:          { value: new THREE.Color(0x000000) },
        u_colB2:          { value: new THREE.Color(0x7a140d) },
        u_colB3:          { value: new THREE.Color(0xff3b3b) },
        u_colB4:          { value: new THREE.Color(0xffd9d9) },
        u_hoverPos:       { value: new THREE.Vector2(0, 0) },
        u_hoverOn:        { value: 0 },
      },
      transparent:   true,
      side:          THREE.DoubleSide,
      depthWrite:    false,
      blending:      THREE.AdditiveBlending,
      depthTest:     true,
    })

    // ── 4-point star shape (N E S O), valleys ±170, Bézier fillet ───
    const shape = new THREE.Shape()
    shape.moveTo(500, 20)
    shape.bezierCurveTo(560, 180, 930, 180, 930, 500)
    shape.bezierCurveTo(930, 820, 560, 820, 500, 980)
    shape.bezierCurveTo(440, 820, 70,  820, 70,  500)
    shape.bezierCurveTo(70,  180, 440, 180, 500, 20)
    shape.closePath()

    // Pillow-inflate helper: displace along normal by gaussian falloff
    function inflateGeo(geo, strength = 0.075) {
      const pos = geo.attributes.position
      geo.computeVertexNormals()
      const norm = geo.attributes.normal
      const cx = 500, cy = 500, maxR = 500
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) - cx
        const y = pos.getY(i) - cy
        const r = Math.sqrt(x * x + y * y)
        const t = Math.min(r / Math.max(maxR, EPS), 1)
        const falloff = Math.exp(-(t * t) / 0.18)
        const inf = strength * falloff
        pos.setZ(i, pos.getZ(i) + inf)
        const nx = norm.getX(i)
        const ny = norm.getY(i)
        pos.setX(i, pos.getX(i) + nx * inf)
        pos.setY(i, pos.getY(i) + ny * inf)
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
      return geo
    }

    // Extrude → inflate → normalise to r≈1
    let geo = new THREE.ExtrudeGeometry(shape, {
      depth:            0.12,
      bevelThickness:   0.08,
      bevelSize:        0.06,
      bevelSegments:    8,
      curveSegments:    24,
    })
    geo = inflateGeo(geo, 0.075)
    const bbox = new THREE.Box3().setFromBufferAttribute(geo.attributes.position)
    const center = bbox.getCenter(new THREE.Vector3())
    const size = bbox.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, EPS)
    const s = 2 / maxDim
    geo.translate(-center.x, -center.y, -center.z)
    geo.scale(s, s, s)

    const wireGeo = new THREE.WireframeGeometry(geo)

    // ── Rig + mesh + wire ────────────────────────────────────────────
    const rig = new THREE.Group()
    const starMesh = new THREE.Mesh(geo, starMat)
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x9ff3ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
    const wire = new THREE.LineSegments(wireGeo, wireMat)
    rig.add(starMesh)
    rig.add(wire)
    scene.add(rig)

    // ── Resize (square-guard + settle + DPR cap 1.5) ────────────────
    const resize = () => {
      const w = Math.max(canvas.clientWidth, 1)
      const h = Math.max(canvas.clientHeight, 1)
      if (w < 10 || h < 10) return
      const ratio = w / h
      if (ratio < 0.9 || ratio > 1.1) return
      const targetW = w * pr
      const targetH = h * pr
      if (canvas.width === targetW && canvas.height === targetH) return
      canvas.width = targetW
      canvas.height = targetH
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    let settleTries = 0
    let settleRAF = 0
    const settleResize = () => {
      const prevW = canvas.width, prevH = canvas.height
      resize()
      settleTries++
      const isSquare = canvas.width > 0 && Math.abs(canvas.width / canvas.height - 1) < 0.01
      if ((!isSquare || canvas.width !== prevW || canvas.height !== prevH) && settleTries < 12) {
        settleRAF = requestAnimationFrame(settleResize)
      }
    }
    settleResize()
    setTimeout(() => {
      const fw = Math.max(canvas.clientWidth, 1)
      const fh = Math.max(canvas.clientHeight, 1)
      if (fw < 10 || fh < 10) return
      const fr = fw / fh
      if (fr < 0.9 || fr > 1.1) return
      const ftw = fw * pr
      const fth = fh * pr
      if (canvas.width !== ftw || canvas.height !== fth) {
        canvas.width = ftw
        canvas.height = fth
        renderer.setSize(fw, fh, false)
        camera.aspect = fw / fh
        camera.updateProjectionMatrix()
      }
    }, 100)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    window.addEventListener('resize', resize, { passive: true })

    // ── Scroll ───────────────────────────────────────────────────────
    const sectionEl = containerRef.current?.closest('.text-entry')
      || (typeof document !== 'undefined' ? document.querySelector('.text-entry') : null)
    const secRectRef = { current: null }
    const onScroll = () => {
      if (!sectionEl) return
      const rect = sectionEl.getBoundingClientRect()
      const vh = window.innerHeight
      const raw = (vh - rect.top) / (vh + rect.height)
      scrollRef.current = Math.max(0, Math.min(1, raw))
      secRectRef.current = rect
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // ── Pointer tracking (docPtrRef fallback) ────────────────────────
    const rectRef = { current: null }
    const updateRect = () => { rectRef.current = canvas.getBoundingClientRect() }
    const onDocPointerMove = (e) => { docPtrRef.current = { x: e.clientX, y: e.clientY } }
    document.addEventListener('pointermove', onDocPointerMove, { passive: true })
    window.addEventListener('resize', updateRect, { passive: true })
    updateRect()

    // ── Animation loop (clock never paused) ──────────────────────────
    let lastT = performance.now()
    let disposed = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const baseY = -(window.innerHeight * 0.28)
    let sm = 0
    let morphSm = 0
    const qStay = new THREE.Quaternion()
    const qExit = new THREE.Quaternion()
    const qMorph = new THREE.Quaternion()
    const qLook = new THREE.Quaternion()
    const tmpV3 = new THREE.Vector3()
    const hitV3 = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()

    const tick = (now) => {
      if (disposed) return
      rafRef.current = requestAnimationFrame(tick)

      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      clockRef.current.elapsed += dt
      const ct = clockRef.current.elapsed

      // Parallax: rig.position.y (no CSS transform on container)
      const sp = scrollRef.current
      const targetY = baseY + sp * PARALLAX_Y
      sm += (targetY - sm) * Math.min(1, dt * PARALLAX_LERP)
      if (Math.abs(sm - targetY) < PARALLAX_DEADBAND) sm = targetY
      rig.position.y = sm

      // stayAlive: clock never paused (float + breathe + Z spin)
      rig.rotation.z += dt * ROT_SPEED
      starMesh.position.y = Math.sin(ct * 0.8) * FLOAT_AMP
      starMesh.position.x = Math.cos(ct * 0.6) * FLOAT_AMP2
      const breathe = 1 + Math.sin(ct * 1.4) * BREATH_AMP
      starMesh.scale.setScalar(breathe)

      // Hover state & pointer normalisation
      let isHov = hoveredRef.current
      let ptrNorm = ptrNormRef.current
      const rect = rectRef.current
      if (isMobile) {
        if (isAwake.current) {
          const p = parked.current
          if (rect && p.x > -9000) {
            isHov = p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom
            ptrNorm = { x: (p.x - rect.left) / rect.width, y: (p.y - rect.top) / rect.height }
          }
        }
      } else {
        const c = docPtrRef.current
        if (rect && c.x > -9000) {
          isHov = c.x >= rect.left && c.x <= rect.right && c.y >= rect.top && c.y <= rect.bottom
          ptrNorm = { x: (c.x - rect.left) / rect.width, y: (c.y - rect.top) / rect.height }
        }
      }
      hoveredRef.current = isHov

      // LookAt via raycast → object-space hoverPos + quaternion target
      const dx = (ptrNorm.x - 0.5) * 2
      const dy = -(ptrNorm.y - 0.5) * 2
      raycaster.setFromCamera(new THREE.Vector2(dx, dy), camera)
      const hits = raycaster.intersectObject(starMesh)
      let hoverOn = 0
      let dist = 0
      if (hits.length > 0) {
        hitV3.copy(hits[0].point)
        rig.worldToLocal(hitV3)
        dist = Math.sqrt(hitV3.x * hitV3.x + hitV3.z * hitV3.z + hitV3.y * hitV3.y)
        hitV3.clampLength(0, RAYCAST_MAX_DIST)
        qLook.setFromUnitVectors(tmpV3.set(0, 0, 1), hitV3.normalize())
        hoverOn = Math.min(1, dist * 0.3)
      } else {
        hoverOn = 0
      }

      // Morph spin (Y axis, gated by morph range)
      qMorph.setFromAxisAngle(new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.smoothstep(morphSm, 0, 1) * Math.PI * 2)

      // LookAt: single quaternion write per frame
      if (isHov) {
        rig.quaternion.slerpQuaternions(rig.quaternion, qLook, Math.min(1, dt * Q_LOOK_SPEED))
      } else {
        rig.quaternion.slerpQuaternions(rig.quaternion, qExit, Math.min(1, dt * W_LOOK))
      }
      if (isHov && hoverOn > 0.01) {
        qExit.copy(rig.quaternion.clone())
      }

      // Morph uniforms
      const newMorph = THREE.MathUtils.smoothstep(MORPH_SMOOTH_LO, MORPH_SMOOTH_HI, sp)
      morphSm += (newMorph - morphSm) * Math.min(1, dt * 4)
      starMat.uniforms.u_morph.value = morphSm
      starMat.uniforms.u_front.value = morphSm
      starMat.uniforms.u_time.value = ct

      // Wire alpha: hover-on * (0.25 + 0.75 * exp(-dist*3))
      const wireAlpha = hoverOn * (0.25 + 0.75 * Math.exp(-dist * 3))
      wireMat.opacity = wireAlpha
      wireMat.transparent = wireAlpha > 0.01
      starMat.uniforms.u_hoverOn.value = hoverOn

      renderer.render(scene, camera)
    }
    rafRef.current = requestAnimationFrame(tick)

    glRef.current = {
      renderer, scene, camera, starMesh, wire, starMat,
      dispose() {
        disposed = true
        cancelAnimationFrame(rafRef.current)
        ro.disconnect()
        window.removeEventListener('resize', resize)
        window.removeEventListener('resize', updateRect)
        window.removeEventListener('scroll', onScroll)
        document.removeEventListener('pointermove', onDocPointerMove)
        renderer.dispose()
        cancelAnimationFrame(settleRAF)
      },
    }
    return () => { glRef.current?.dispose(); glRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, prefersReduced, portalTarget, visible])

  // ── Portal target ───────────────────────────────────────────
  useEffect(() => {
    const find = () => {
      const el = document.querySelector('.text-entry')
      if (el) setPortalTarget(el)
    }
    find()
    const mo = new MutationObserver(find)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
  useEffect(() => {
    const sectionEl = containerRef.current?.closest('.text-entry')
      || (typeof document !== 'undefined' ? document.querySelector('.text-entry') : null)
    if (!sectionEl) return
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 },
    )
    io.observe(sectionEl)
    return () => io.disconnect()
  }, [])

  if (!visible) return null

  const starNode = (
    <div
      ref={containerRef}
      className="hero-star"
      aria-hidden="true"
      style={{
        position:    'absolute',
        left:        leftPos,
        bottom:      bottomPos,
        width:       starSize,
        height:      starSize,
        zIndex:      10,
        pointerEvents: 'auto',
        cursor:      'default',
      }}
    >
      {prefersReduced && (
        <svg viewBox="0 0 1000 1000" style={{ display: 'block', width: '100%', height: '100%' }}>
          <path d="M500,20 L560,440 L930,500 L560,560 L500,980 L440,560 L70,500 L440,440 Z" fill="#3bdcff" stroke="#0d6b7a" strokeWidth="8" />
        </svg>
      )}
      <canvas
        ref={canvasRef}
        className="hero-star__gl"
        style={{
          position:      'absolute',
          inset:         0,
          width:         '100%',
          height:        '100%',
          pointerEvents: 'none',
          display:       prefersReduced ? 'none' : undefined,
        }}
      />
    </div>
  )

  return portalTarget ? createPortal(starNode, portalTarget) : starNode
}
