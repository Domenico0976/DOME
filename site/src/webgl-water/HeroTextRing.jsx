import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useIsMobile } from '../hooks/useIsMobile'
import { useCursorGate } from '../hooks/useCursorGate'

const RING_PX = 440
const TEXT = 'SOMEBODYWANT3D'
const CYL_R = 190
const CYL_H = 150
const SCROLL = 0.06

async function drawStripTexture() {
  try {
    await document.fonts.load('700 120px "Bricolage Grotesque"')
  } catch {
    // fall through: system sans fallback still draws the band
  }
  const W = 2048
  const H = 256
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  const fontPx = 120
  ctx.font = `700 ${fontPx}px "Bricolage Grotesque", sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const track = -0.06 * fontPx
  const unit = `${TEXT} \u2022 `
  const unitW = ctx.measureText(unit).width + track * unit.length
  const reps = Math.max(1, Math.round(W / unitW))
  const str = unit.repeat(reps)
  const raw = [...str].map((ch) => ctx.measureText(ch).width + track)
  const total = raw.reduce((a, b) => a + b, 0)
  // stretch advances uniformly so the strip is exactly W wide: with
  // RepeatWrapping the horizontal scroll then loops seamlessly.
  const k = W / total
  let cursor = 0
  ;[...str].forEach((ch, i) => {
    const adv = raw[i] * k
    ctx.fillText(ch, cursor + adv / 2, H / 2)
    cursor += adv
  })
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
      scene.add(mesh)
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
