// src/hero-glass/logoMesh.js
// Second hero object: the brand mark extruded from its SVG logo.
// Same MATERIAL properties as the torus (fresh instance, same values),
// own placement (see logoPlacementFor in params.js). No React, no preloader.

import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { LOGO_DISPERSION, LOGO_EXTRUDE, LOGO_GLASS, LOGO_Z, MATERIAL } from './params.js'

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="93" height="93" viewBox="0 0 93 93" fill="none">
<path d="M46.5 0L57.3506 35.6494L93 46.5L57.3506 57.3506L46.5 93L35.6494 57.3506L0 46.5L35.6494 35.6494L46.5 0Z" fill="black"/>
</svg>`

// SVGLoader keeps raw SVG coords (y-down), so the extrude comes out upside
// down in three's y-up world. The engine mirrors it back with a negative Y
// scale (three flips frontFace automatically for negative determinants, so
// winding and lighting stay correct). toShapes() honors each path's
// fill-rule; this mark parses to disjoint solids with no nested counters.
export function parseLogoShapes(svg = LOGO_SVG) {
  const loader = new SVGLoader()
  const data = loader.parse(svg)
  const shapes = []
  for (const path of data.paths) {
    for (const shape of path.toShapes()) {
      if (shape.getPoints().length >= 3) shapes.push(shape)
    }
  }
  return shapes
}

export function buildLogoGeometry(shapes = parseLogoShapes()) {
  if (!shapes.length) throw new Error('[logoMesh] no shapes parsed from LOGO_SVG')
  const geometry = new THREE.ExtrudeGeometry(shapes, LOGO_EXTRUDE)
  geometry.center()
  geometry.computeBoundingBox()
  return geometry
}

export function logoNaturalSize(geometry) {
  geometry.computeBoundingBox()
  const size = new THREE.Vector3()
  geometry.boundingBox.getSize(size)
  return size
}

// Stock glass only: no onBeforeCompile, no normal tricks. The mark shares
// every MATERIAL value with the torus except thickness (2.5 vs 0.7): on
// parallel faces a thicker slab shifts the background sampling more, which is
// the only stock-material lever that bends anything head-on. Same program,
// same shader, just a stronger refraction volume.
// Plus an organic micro-surface (tileable value noise baked to a normal map,
// assigned as stock material.normalMap): the mesh and the program stay
// exactly as three ships them — only the transmission/reflection sampling
// bends, like looking through old wavy glass. Pure functions below are
// unit-tested; the canvas upload degrades to null wherever 2D canvas is
// missing.
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeHeightField(size = 128, seed = 7) {
  const field = new Float32Array(size * size)
  const octaves = [
    { cells: 4, amp: 0.55 },
    { cells: 8, amp: 0.3 },
    { cells: 16, amp: 0.15 },
  ]
  for (const { cells, amp } of octaves) {
    const rand = mulberry32(seed * 1000 + cells)
    const lattice = new Float32Array(cells * cells)
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand()
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells
      const y0 = Math.floor(gy) % cells
      const y1 = (y0 + 1) % cells
      const fy = gy - Math.floor(gy)
      const sy = fy * fy * (3 - 2 * fy)
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells
        const x0 = Math.floor(gx) % cells
        const x1 = (x0 + 1) % cells
        const fx = gx - Math.floor(gx)
        const sx = fx * fx * (3 - 2 * fx)
        const a = lattice[y0 * cells + x0]
        const b = lattice[y0 * cells + x1]
        const c = lattice[y1 * cells + x0]
        const d = lattice[y1 * cells + x1]
        field[y * size + x] += ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy) * amp
      }
    }
  }
  return field
}

export function heightFieldToNormalData(field, size, strength = 2) {
  const data = new Uint8ClampedArray(size * size * 4)
  const at = (x, y) => field[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const inv = 1 / Math.hypot(dx, dy, 1)
      const o = (y * size + x) * 4
      data[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      data[o + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
      data[o + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      data[o + 3] = 255
    }
  }
  return data
}

export function buildLogoNormalMap() {
  try {
    if (typeof document === 'undefined') return null
    const size = 128
    const data = heightFieldToNormalData(makeHeightField(size, 7), size, 2)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(data, size, size), 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(LOGO_GLASS.uvScale, LOGO_GLASS.uvScale)
    return tex
  } catch {
    return null
  }
}

export function buildLogoMesh() {
  const geometry = buildLogoGeometry()
  // Same values as the torus, own instance so dispose stays symmetric
  // (engine disposes torus + logo materials independently).
  const material = new THREE.MeshPhysicalMaterial({
    ...MATERIAL,
    thickness: 2.5,
    dispersion: LOGO_DISPERSION,
  })
  const normalMap = buildLogoNormalMap()
  if (normalMap) {
    material.normalMap = normalMap
    material.normalScale.set(LOGO_GLASS.normalScale, LOGO_GLASS.normalScale)
  }
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.z = LOGO_Z
  return { mesh, geometry, material }
}
