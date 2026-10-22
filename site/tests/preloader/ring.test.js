// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRingRig } from '../../src/preloader/ring.js'
import { RING_PX } from '../../src/webgl-water/ringStrip.js'

describe('preloader ring rig', () => {
  it('frames a square box scaled to the viewport aspect (no stretch)', () => {
    const rig = createRingRig()
    rig.resize(1600, 900)
    expect(rig.camera.top).toBe(RING_PX / 2)
    expect(rig.camera.bottom).toBe(-RING_PX / 2)
    expect(rig.camera.right).toBeCloseTo((RING_PX / 2) * (1600 / 900), 6)
    expect(rig.camera.left).toBeCloseTo(-(RING_PX / 2) * (1600 / 900), 6)
    rig.resize(900, 1600)
    expect(rig.camera.right).toBeCloseTo((RING_PX / 2) * (900 / 1600), 6)
    rig.dispose()
  })

  it('docks up-scaled when the counter appears (scale 0.5, lifted)', () => {
    const rig = createRingRig()
    rig.setDock(0)
    expect(rig.group.scale.x).toBe(1)
    expect(rig.group.position.y).toBe(0)
    rig.setDock(1)
    expect(rig.group.scale.x).toBe(0.5)
    expect(rig.group.position.y).toBeGreaterThan(0)
    rig.dispose()
  })

  it('tilts toward the cursor like a gizmo (both axes, distance-weighted)', () => {
    const rig = createRingRig()
    const t0 = performance.now()
    rig.update(t0)
    rig.update(t0 + 16)
    expect(rig.group.rotation.x).toBe(0)
    expect(rig.group.rotation.y).toBe(0)
    window.dispatchEvent(
      new window.MouseEvent('pointermove', { clientX: window.innerWidth, clientY: 0 }),
    )
    for (let i = 1; i <= 60; i++) rig.update(t0 + 16 * (i + 2))
    expect(rig.group.rotation.y).toBeGreaterThan(0.3)
    expect(rig.group.rotation.x).toBeGreaterThan(0.1)
    rig.dispose()
  })

  it('spins the strip faster while the cursor moves fast', () => {
    const rig = createRingRig()
    const t0 = performance.now()
    rig.update(t0)
    const slow = rig.texture.offset.x
    rig.update(t0 + 16)
    const idleStep = slow - rig.texture.offset.x
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(
        new window.MouseEvent('pointermove', {
          clientX: 100 + i * 120,
          clientY: 100,
        }),
      )
    }
    const before = rig.texture.offset.x
    rig.update(t0 + 32)
    const fastStep = before - rig.texture.offset.x
    expect(fastStep).toBeGreaterThan(idleStep)
    rig.dispose()
  })

  it('resolves boot even when the 2d paint fails (headless canvas)', async () => {
    const rig = createRingRig()
    await expect(rig.ready).resolves.toBeUndefined()
    expect(rig.texture).toBeDefined()
    rig.dispose()
  })
})
