import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useIsMobile } from '../hooks/useIsMobile'
import { useCursorGate } from '../hooks/useCursorGate'
import { RING_PX, CYL_R, CYL_H, SCROLL, paintRingStrip } from './ringStrip.js'

async function drawStripTexture() {
  const cv = document.createElement('canvas')
  await paintRingStrip(cv)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

function preloaderGone() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve()
    if (!document.getElementById('preloader')) return resolve()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      mo.disconnect()
      clearTimeout(safety)
      resolve()
    }
    const mo = new MutationObserver(finish)
    mo.observe(document.body, { childList: true })
    const safety = setTimeout(finish, 20000)
  })
}

export default function HeroTextRing() {
  const wrapRef = useRef(null)
  const isMobile = useIsMobile()
  const { isAwake, isOver } = useCursorGate()

  useEffect(() => {
    let dead = false
    let renderer = null
    let mesh = null
    let mat = null
    let tex = null
    let raf = 0
    let io = null
    let visible = true
    let cachedRect = null
    let refreshRect = null
    let group = null
    let gpx = 0
    let gpy = 0
    let gHas = false
    let gvx = 0
    let gvy = 0
    let gLastX = 0
    let gLastY = 0
    let gLastT = 0
    let grx = 0
    let gry = 0
    let gHero = false
    const onGizmoMove = (e) => {
      const el = wrapRef.current
      if (!el) return
      gHero = !!(e.target && e.target.closest && e.target.closest('.hero-region'))
      const rect = cachedRect || el.getBoundingClientRect()
      const now = performance.now()
      if (gHas && gLastT) {
        const dt = Math.max(1, now - gLastT) / 1000
        gvx += ((e.clientX - gLastX) / dt - gvx) * 0.2
        gvy += ((e.clientY - gLastY) / dt - gvy) * 0.2
      }
      gLastX = e.clientX
      gLastY = e.clientY
      gLastT = now
      gpx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)
      gpy = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)
      gHas = true
    }
    window.addEventListener('pointermove', onGizmoMove, { passive: true })

    const boot = async () => {
      const el = wrapRef.current
      if (!el || dead) return
      await preloaderGone()
      if (dead || !el.isConnected) return
      try {
        tex = await drawStripTexture()
        if (dead) {
          tex.dispose()
          return
        }
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      } catch {
        el.style.display = 'none'
        return
      }
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)
      renderer.setPixelRatio(dpr)
      renderer.setSize(RING_PX, RING_PX)
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      el.appendChild(renderer.domElement)
      const scene = new THREE.Scene()
      const cam = new THREE.OrthographicCamera(
        -RING_PX / 2, RING_PX / 2, RING_PX / 2, -RING_PX / 2, -1000, 1000,
      )
      cam.position.set(0, 0, 500)
      mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0,
        side: THREE.FrontSide,
      })
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(CYL_R, CYL_R, CYL_H, 96, 1, true), mat,
      )
      group = new THREE.Group()
      group.add(mesh)
      scene.add(group)
      const base = mesh.geometry.attributes.position.array.slice()
      const pos = mesh.geometry.attributes.position
      const reduceMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const t0 = performance.now()
      let last = t0
      let amp = 0
      const tick = (now) => {
        if (dead) return
        raf = requestAnimationFrame(tick)
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        tex.offset.x -= SCROLL * dt
        mat.opacity = reduceMotion ? 1 : Math.min(1, (now - t0) / 700)
        if (!cachedRect) cachedRect = el.getBoundingClientRect()
        const target = !reduceMotion && isAwake.current && isOver(cachedRect) ? 1 : 0
        amp += (target - amp) * Math.min(1, dt * 4)
        if (amp > 0.002) {
          const t = now / 1000
          for (let i = 0; i < pos.count; i++) {
            const bx = base[i * 3]
            const by = base[i * 3 + 1]
            pos.setX(i, bx + Math.cos(by * 0.08 + t * 2.2) * amp * 3)
            pos.setY(i, by + Math.sin(bx * 0.05 + t * 3.1) * amp * 6)
          }
          pos.needsUpdate = true
        } else if (amp !== 0) {
          for (let i = 0; i < pos.count; i++) {
            pos.setX(i, base[i * 3])
            pos.setY(i, base[i * 3 + 1])
          }
          pos.needsUpdate = true
          amp = 0
        }
        const rectNow = cachedRect || el.getBoundingClientRect()
        const restPx = ((window.innerWidth / 2) - (rectNow.left + rectNow.width / 2)) / (window.innerWidth / 2)
        const restPy = (window.innerHeight - (rectNow.top + rectNow.height / 2)) / (window.innerHeight / 2)
        const engaged = gHero && visible
        const idleMs = gHas && engaged ? now - gLastT : Infinity
        const idle = Math.max(0, Math.min(1, (idleMs - 3000) / 900))
        const epx = gpx + (restPx - gpx) * idle
        const epy = gpy + (restPy - gpy) * idle
        const mag = Math.min(1, Math.hypot(epx, epy))
        const tk = Math.min(1, dt * 4)
        const tgx = reduceMotion ? 0 : epx * 0.7 * (0.25 + 0.75 * mag)
        const tgy = reduceMotion ? 0 : -epy * 0.5 * (0.25 + 0.75 * mag)
        gry += (tgx - gry) * tk
        grx += (tgy - grx) * tk
        group.rotation.y = gry
        group.rotation.x = grx
        if (!reduceMotion && gHero && visible) {
          const boost = Math.min(2400, Math.hypot(gvx, gvy)) / 600
          tex.offset.x -= SCROLL * boost * dt
        }
        const decay = Math.exp(-dt * 3)
        gvx *= decay
        gvy *= decay
        if (visible) renderer.render(scene, cam)
      }
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
      })
      io.observe(el)
      cachedRect = el.getBoundingClientRect()
      let rectScheduled = false
      refreshRect = () => {
        if (rectScheduled) return
        rectScheduled = true
        requestAnimationFrame(() => {
          rectScheduled = false
          if (!dead && el.isConnected) cachedRect = el.getBoundingClientRect()
          const section = el.closest('.hero-region')
          if (section && gHas) {
            const sr = section.getBoundingClientRect()
            gHero =
              gLastX >= sr.left &&
              gLastX <= sr.right &&
              gLastY >= sr.top &&
              gLastY <= sr.bottom
          } else {
            gHero = false
          }
        })
      }
      window.addEventListener('scroll', refreshRect, { passive: true })
      window.addEventListener('resize', refreshRect)
      raf = requestAnimationFrame(tick)
    }

    boot()
    return () => {
      dead = true
      cancelAnimationFrame(raf)
      if (io) io.disconnect()
      window.removeEventListener('pointermove', onGizmoMove)
      if (refreshRect) {
        window.removeEventListener('scroll', refreshRect)
        window.removeEventListener('resize', refreshRect)
      }
      const el = wrapRef.current
      if (mesh) mesh.geometry.dispose()
      if (mat) mat.dispose()
      if (tex) tex.dispose()
      if (renderer) {
        renderer.dispose()
        const dom = renderer.domElement
        if (dom && dom.parentNode) dom.parentNode.removeChild(dom)
      }
      if (el) {
        while (el.firstChild) el.removeChild(el.firstChild)
      }
    }
  }, [isMobile])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top: 'calc(232px - min(440px, 94vw) / 2)',
        width: 'min(440px, 94vw)',
        aspectRatio: '1 / 1',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
