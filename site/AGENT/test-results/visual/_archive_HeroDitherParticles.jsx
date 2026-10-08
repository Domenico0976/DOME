import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useIsMobile } from '../hooks/useIsMobile'

function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t >>> 7, 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 98765
const RAIN_N = 150
const RAIN_N_MOBILE = 60
const DRIFT_N = 100
const DRIFT_N_MOBILE = 40
const SIZE_MIN = 10
const SIZE_MAX = 16

function spawn(p, rng, initial) {
  p.age = initial ? rng() * p.life : 0
  if (p.zone === 0) {
    p.nx = rng()
    p.ny = 0.75 + rng() * 0.25 * (initial ? 1 : 0.2)
    p.speed = 0.15 + rng() * 0.25
  } else if (p.zone === 1) {
    p.nx = rng() * 0.12
    p.ny = rng()
    p.speed = 0.03 + rng() * 0.03
  } else if (p.zone === 2) {
    p.nx = 0.88 + rng() * 0.12
    p.ny = rng()
    p.speed = 0.03 + rng() * 0.03
  } else if (p.zone === 3) {
    p.nx = 0.4 + rng() * 0.1
    p.ny = rng() * 0.5
    p.speed = 0.08 + rng() * 0.1
  } else {
    p.nx = 0.5 + rng() * 0.1
    p.ny = rng() * 0.5
    p.speed = 0.08 + rng() * 0.1
  }
  p.size = SIZE_MIN + rng() * (SIZE_MAX - SIZE_MIN)
  p.life = p.zone === 0 ? 2 + rng() * 2.5 : 3 + rng() * 3
  if (initial) p.age = rng() * p.life
}

function step(p, dt) {
  p.age += dt
  if (p.zone === 0) {
    p.ny += p.speed * dt * (1 + 2 * (1 - p.ny))
  } else if (p.zone === 1) {
    p.ny += p.speed * dt
    p.nx += p.speed * 0.4 * dt
  } else if (p.zone === 2) {
    p.ny += p.speed * dt
    p.nx -= p.speed * 0.4 * dt
  } else if (p.zone === 3) {
    p.nx -= p.speed * dt
    p.ny += 0.005 * dt
  } else {
    p.nx += p.speed * dt
    p.ny += 0.005 * dt
  }
  const dead =
    p.age > p.life ||
    p.ny > 1.02 ||
    (p.zone === 3 && p.nx < 0.04) ||
    (p.zone === 4 && p.nx > 0.96)
  return !dead
}

export default function HeroDitherParticles() {
  const wrapRef = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let dead = false
    let renderer = null
    let raf = 0
    let io = null
    let ro = null
    let visible = true
    let mesh = null
    let scene = null
    let cam = null
    const dummy = new THREE.Object3D()

    const rainCount = isMobile ? RAIN_N_MOBILE : RAIN_N
    const driftCount = isMobile ? DRIFT_N_MOBILE : DRIFT_N
    const total = rainCount + driftCount
    const rng = mulberry32(SEED)
    const parts = []
    for (let i = 0; i < total; i++) {
      const p = { zone: i < rainCount ? 0 : 1 + ((i - rainCount) % 4), nx: 0, ny: 0, speed: 0, size: 12, life: 3, age: 0 }
      spawn(p, rng, true)
      parts.push(p)
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const layout = () => {
      const w = Math.max(1, el.clientWidth)
      const h = Math.max(1, el.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2))
      renderer.setSize(w, h)
      cam.left = -w / 2
      cam.right = w / 2
      cam.top = h / 2
      cam.bottom = -h / 2
      cam.updateProjectionMatrix()
    }

    const draw = () => {
      const w = Math.max(1, el.clientWidth)
      const h = Math.max(1, el.clientHeight)
      for (let i = 0; i < total; i++) {
        const p = parts[i]
        const k = Math.max(0.001, 1 - 0.92 * Math.min(1, p.age / p.life))
        const s = p.size * k
        dummy.position.set((p.nx - 0.5) * w, (0.5 - p.ny) * h, 0)
        dummy.scale.set(s, s, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      renderer.render(scene, cam)
    }

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    } catch {
      el.style.display = 'none'
      return
    }
    scene = new THREE.Scene()
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
    mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
      total,
    )
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    scene.add(mesh)
    el.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    layout()

    if (reduceMotion) {
      draw()
      return () => {
        dead = true
        if (renderer) {
          renderer.dispose()
          const dom = renderer.domElement
          if (dom && dom.parentNode) dom.parentNode.removeChild(dom)
        }
      }
    }

    let last = performance.now()
    const tick = (now) => {
      if (dead) return
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible) return
      for (let i = 0; i < total; i++) {
        if (!step(parts[i], dt)) spawn(parts[i], rng, false)
      }
      draw()
    }

    io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(el)
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (!dead) layout()
      })
      ro.observe(el)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      if (io) io.disconnect()
      if (ro) ro.disconnect()
      if (mesh) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      if (renderer) {
        renderer.dispose()
        const dom = renderer.domElement
        if (dom && dom.parentNode) dom.parentNode.removeChild(dom)
      }
      while (el.firstChild) el.removeChild(el.firstChild)
    }
  }, [isMobile])

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  )
}
