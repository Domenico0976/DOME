// src/hero-glass/geometry.js
// Environment map and torus knot. No SVG, React, GSAP or preloader.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MATERIAL, TORUS_KNOT, TORUS_Z } from './params.js'

export function buildEnvironment(renderer) {
  const environment = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(environment, 0.04).texture
  environment.dispose()
  pmrem.dispose()
  return envMap
}

export function buildTorusKnot() {
  const geometry = new THREE.TorusKnotGeometry(
    TORUS_KNOT.radius,
    TORUS_KNOT.tube,
    TORUS_KNOT.tubularSegments,
    TORUS_KNOT.radialSegments,
    TORUS_KNOT.p,
    TORUS_KNOT.q,
  )
  const material = new THREE.MeshPhysicalMaterial({ ...MATERIAL })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.z = TORUS_Z
  return { mesh, geometry, material }
}
