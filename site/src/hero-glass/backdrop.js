// src/hero-glass/backdrop.js
// Refraction target behind the torus. Swap in a texture to reflect content.

import * as THREE from 'three'
import { BACKDROP_Z } from './params.js'

export function createBackdrop({ color = 0xffffff, texture = null } = {}) {
  const geometry = new THREE.PlaneGeometry(1, 1)
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    map: texture,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.z = BACKDROP_Z
  mesh.renderOrder = -1
  mesh.frustumCulled = false

  return {
    mesh,
    geometry,
    material,

    setColor(next) {
      material.color.set(next)
      return this
    },

    setTexture(next) {
      material.map = next
      material.needsUpdate = true
      return this
    },

    fitToViewport(camera, margin = 1.05) {
      const distance = Math.max(camera.position.z - BACKDROP_Z, 0.001)
      const visibleHeight = 2 * distance * Math.tan((camera.fov * Math.PI / 180) / 2)
      const visibleWidth = visibleHeight * camera.aspect
      mesh.scale.set(visibleWidth * margin, visibleHeight * margin, 1)
      return this
    },

    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
