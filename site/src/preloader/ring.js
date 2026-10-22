import * as THREE from 'three'
import { RING_PX, CYL_R, CYL_H, SCROLL, STRIP_W, STRIP_H, paintRingStrip } from '../webgl-water/ringStrip.js'

const DOCK_LIFT = RING_PX * 0.25
const TILT_Y = 0.7
const TILT_X = 0.5

export function createRingRig({ ink = 0x111111 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = STRIP_W
  canvas.height = STRIP_H
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 8
  const ready = paintRingStrip(canvas)
    .then(() => {
      texture.needsUpdate = true
    })
    .catch(() => {})

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    side: THREE.FrontSide,
    color: ink,
  })
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(CYL_R, CYL_R, CYL_H, 96, 1, true),
    material,
  )
  const group = new THREE.Group()
  group.add(mesh)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
  camera.position.set(0, 0, 500)

  function resize(w, h) {
    const halfH = RING_PX / 2
    const halfW = halfH * (w / Math.max(h, 1))
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()
  }

  let px = 0
  let py = 0
  let hasPointer = false
  let vx = 0
  let vy = 0
  let lastPX = 0
  let lastPY = 0
  let lastPT = 0
  let rx = 0
  let ry = 0

  function onPointerMove(e) {
    const now = performance.now()
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    if (hasPointer && lastPT) {
      const dt = Math.max(1, now - lastPT) / 1000
      vx += ((e.clientX - lastPX) / dt - vx) * 0.2
      vy += ((e.clientY - lastPY) / dt - vy) * 0.2
    }
    lastPX = e.clientX
    lastPY = e.clientY
    lastPT = now
    px = (e.clientX - w / 2) / (w / 2)
    py = (e.clientY - h / 2) / (h / 2)
    hasPointer = true
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  function setDock(p) {
    const c = Math.max(0, Math.min(1, p))
    group.scale.setScalar(1 - 0.5 * c)
    group.position.y = DOCK_LIFT * c
  }

  const t0 = performance.now()
  let last = t0

  function update(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    const mag = hasPointer ? Math.min(1, Math.hypot(px, py)) : 0
    const k = Math.min(1, dt * 4)
    ry += (px * TILT_Y * (0.25 + 0.75 * mag) - ry) * k
    rx += (-py * TILT_X * (0.25 + 0.75 * mag) - rx) * k
    group.rotation.y = ry
    group.rotation.x = rx
    const speed = Math.min(2400, Math.hypot(vx, vy))
    texture.offset.x -= SCROLL * (1 + speed / 600) * dt
    const decay = Math.exp(-dt * 3)
    vx *= decay
    vy *= decay
    material.opacity = Math.min(1, (now - t0) / 700)
  }

  function dispose() {
    window.removeEventListener('pointermove', onPointerMove)
    mesh.geometry.dispose()
    material.dispose()
    texture.dispose()
  }

  return { group, camera, texture, resize, setDock, update, dispose, ready }
}
