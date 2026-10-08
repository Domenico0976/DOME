import { describe, it, expect } from 'vitest'
import {
  buildLogoGeometry,
  buildLogoMesh,
  heightFieldToNormalData,
  logoNaturalSize,
  makeHeightField,
  parseLogoShapes,
} from '../../src/hero-glass/logoMesh.js'
import {
  LOGO_DISPERSION,
  LOGO_GLASS,
  LOGO_LAYOUTS,
  logoPlacementFor,
  logoScaleFor,
} from '../../src/hero-glass/params.js'

const camera = { fov: 45, aspect: 1 }

describe('parseLogoShapes', () => {
  it('yields the single solid of the star mark', () => {
    const shapes = parseLogoShapes()
    expect(shapes.length).toBe(1)
    for (const shape of shapes) {
      expect(shape.getPoints().length).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps every solid inside the 93x93 viewBox', () => {
    for (const shape of parseLogoShapes()) {
      const pts = shape.getPoints(4)
      for (const pt of pts) {
        expect(pt.x).toBeGreaterThanOrEqual(0)
        expect(pt.x).toBeLessThanOrEqual(93)
      }
    }
  })
})

describe('buildLogoGeometry', () => {
  it('extrudes a centered, non-empty geometry', () => {
    const geometry = buildLogoGeometry()
    expect(geometry.attributes.position.count).toBeGreaterThan(0)
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    expect(min.x + max.x).toBeCloseTo(0, 3)
    expect(min.y + max.y).toBeCloseTo(0, 3)
    expect(min.z + max.z).toBeCloseTo(0, 3)
    const size = logoNaturalSize(geometry)
    expect(size.x).toBeGreaterThan(0)
    expect(size.y).toBeGreaterThan(0)
    expect(size.z).toBeGreaterThan(0)
    geometry.dispose()
  })
})

describe('logo micro-surface (pure math)', () => {
  it('produces a deterministic field in a sane range', () => {
    const a = makeHeightField(32, 7)
    const b = makeHeightField(32, 7)
    expect(a).toEqual(b)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1.01)
    }
    const c = makeHeightField(32, 8)
    expect(c).not.toEqual(a)
  })

  it('turns a flat field into an up-facing normal', () => {
    const flat = new Float32Array(16 * 16).fill(0.5)
    const data = heightFieldToNormalData(flat, 16, 2)
    expect(data.length).toBe(16 * 16 * 4)
    const o = (8 * 16 + 8) * 4
    expect(data[o]).toBe(128)
    expect(data[o + 1]).toBe(128)
    expect(data[o + 2]).toBe(255)
    expect(data[o + 3]).toBe(255)
  })

  it('keeps LOGO_GLASS tuning finite and positive', () => {
    for (const v of Object.values(LOGO_GLASS)) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
    expect(LOGO_GLASS.normalScale).toBeGreaterThan(0)
  })
})

describe('buildLogoMesh', () => {
  it('locks the logo-only refraction grade without touching the torus', () => {
    const { material, geometry, mesh } = buildLogoMesh()
    expect(material.thickness).toBe(2.5)
    expect(material.dispersion).toBe(LOGO_DISPERSION)
    expect(mesh).toBeDefined()
    // jsdom has no 2D canvas: the map degrades to null instead of throwing.
    expect(material.normalMap === null || material.normalMap.isTexture).toBe(true)
    material.dispose()
    geometry.dispose()
  })
})

describe('logoScaleFor', () => {
  it('sizes the mark to sizeFraction of the visible height', () => {
    const scale = logoScaleFor(camera, 200, LOGO_LAYOUTS.desktop)
    const halfFov = ((camera.fov * Math.PI) / 180) / 2
    const visibleHeight = 2 * (5 - 2.2) * Math.tan(halfFov)
    expect(scale * 200).toBeCloseTo(visibleHeight * LOGO_LAYOUTS.desktop.sizeFraction, 6)
  })
})

describe('logoPlacementFor', () => {
  it('puts desktop bottom-right, fully on-screen', () => {
    const half = { x: 0.1, y: 0.2 }
    const p = logoPlacementFor(camera, half, LOGO_LAYOUTS.desktop)
    expect(p.x).toBeGreaterThan(0)
    expect(p.y).toBeLessThan(0)
    const halfFov = ((camera.fov * Math.PI) / 180) / 2
    const visibleHeight = 2 * (5 - 2.2) * Math.tan(halfFov)
    const visibleWidth = visibleHeight * camera.aspect
    expect(p.x + half.x).toBeLessThanOrEqual(visibleWidth / 2 + 1e-9)
    expect(p.y - half.y).toBeGreaterThanOrEqual(-visibleHeight / 2 - 1e-9)
  })

  it('puts mobile middle-right (y centered)', () => {
    const p = logoPlacementFor(camera, { x: 0.1, y: 0.2 }, LOGO_LAYOUTS.mobile)
    expect(p.x).toBeGreaterThan(0)
    expect(p.y).toBeCloseTo(0, 9)
  })
})
