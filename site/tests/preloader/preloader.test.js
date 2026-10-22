// @vitest-environment jsdom
// Unit tests for the first-landing preloader. Lives in tests/preloader/ so the
// whole plan can be wiped in one go without touching other plans' tests.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatCounter, computeDigitTiles, shouldRedraw } from '../../src/preloader/counter-texture.js'
import { shouldRunPreloader, markVisited } from '../../src/preloader/session-gate.js'
import {
  frontActivation,
  FRONT_PROFILE,
  swellCurve,
  sweepFront,
  upwardBias,
  liftOffset,
} from '../../src/preloader/wavefront.js'
import {
  TILE_SIZE,
  TIMELINE,
  FINAL_COUNT,
  SEAL_TRIGGER,
  SEAL_FRONT_END,
  COVER_START,
  coverRadius,
  phaseFront,
  easeFlow,
  shouldMountGL,
  followFactor,
  followStep,
} from '../../src/preloader/config.js'
import { fragmentShader } from '../../src/preloader/shader.js'
import { creepProgress, displayProgress, CREEP } from '../../src/preloader/config.js'

describe('counter creep (indeterminate progress)', () => {
  it('always moves, so the counter never sits still', () => {
    // The complaint this answers: byte progress is a staircase, so the raw number
    // freezes for a second at a time and reads as broken.
    let prev = creepProgress(0)
    for (let t = 50; t <= 3000; t += 50) {
      const v = creepProgress(t)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('never reaches 100, however long it is left alone', () => {
    // This is the property that keeps it honest: it is a floor under the real
    // progress, not a substitute for it, so it must stay below the real thing.
    expect(creepProgress(10_000)).toBeLessThan(1)
    expect(creepProgress(1e9)).toBeLessThan(1)
    expect(creepProgress(1e9)).toBeLessThanOrEqual(CREEP.ceiling)
  })

  it('starts at zero and never goes backwards', () => {
    expect(creepProgress(0)).toBe(0)
    expect(creepProgress(-500)).toBe(0)
    expect(creepProgress(100)).toBeGreaterThan(creepProgress(50))
  })

  it('makes visible progress over the window the preloader waits in', () => {
    // A second in, it must already read as moving; a creep that takes 3s to
    // register would feel identical to the frozen counter it replaced. The
    // window is longer than before (click-gated, slow by request), but the
    // gesture still has to show up early.
    expect(creepProgress(1000)).toBeGreaterThan(0.14)
    expect(creepProgress(2000)).toBeGreaterThan(0.28)
    expect(creepProgress(3000)).toBeGreaterThan(0.38)
  })

  it('survives a degenerate time constant instead of returning NaN', () => {
    expect(creepProgress(1000, { tau: 0 })).toBe(0)
    expect(Number.isFinite(creepProgress(1000, { tau: -5 }))).toBe(true)
  })
})

describe('counter damping (the jump to FINAL_COUNT)', () => {
  it('never overshoots the target, so it cannot claim more than the load did', () => {
    // This is what makes the easing honest rather than cosmetic: a smoothed bar
    // that can exceed the goal is lying, this one cannot.
    let v = 0
    for (let i = 0; i < 200; i++) {
      v = displayProgress(v, 1, 16)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('never moves backwards when the target jumps ahead then holds', () => {
    let v = 0
    for (const target of [0.1, 0.1, 0.9, 0.9, 0.9, 0.2, 1]) {
      const next = displayProgress(v, target, 16)
      expect(next).toBeGreaterThanOrEqual(v)
      v = next
    }
  })

  it('spreads the last stretch over several frames instead of snapping', () => {
    // The bug being pinned: the counter used to be assigned, so the frame after
    // the load settled it went from wherever it was to the whole count.
    let v = 0.9
    const first = displayProgress(v, 1, 16)
    expect(first).toBeLessThan(1)
    expect(first - v).toBeLessThan(0.05)

    let steps = 1
    v = first
    while (v < 1 && steps < 1000) {
      v = displayProgress(v, 1, 16)
      steps++
    }
    expect(steps).toBeGreaterThan(3)
  })

  it('reaches exactly 100%, never an asymptote', () => {
    // seal ends on this number, so 079.9 forever is not an option.
    let v = 0
    for (let i = 0; i < 1000; i++) v = displayProgress(v, 1, 16)
    expect(v).toBe(1)
  })

  it('gets there inside the seal phase, so the cover never starts under the full count', () => {
    let v = SEAL_TRIGGER / FINAL_COUNT
    for (let t = 0; t <= TIMELINE.SEAL; t += 16) v = displayProgress(v, 1, 16)
    expect(v).toBe(1)
  })

  it('is a no-op on the first frame instead of dividing by zero', () => {
    expect(displayProgress(0, 0.5, 0)).toBe(0)
    expect(Number.isFinite(displayProgress(0, 0.5, 0))).toBe(true)
  })
})

describe('formatCounter', () => {
  it('zero-pads to 3 digits (format 007)', () => {
    expect(formatCounter(0)).toBe('000')
    expect(formatCounter(7)).toBe('007')
    expect(formatCounter(42)).toBe('042')
  })
  it('clamps to 0..100', () => {
    expect(formatCounter(-5)).toBe('000')
    expect(formatCounter(100)).toBe('100')
    expect(formatCounter(150)).toBe('100')
  })
})

describe('computeDigitTiles', () => {
  it('returns a grid-sized Uint8Array', () => {
    const cells = computeDigitTiles(0, 40, 25)
    expect(cells).toBeInstanceOf(Uint8Array)
    expect(cells.length).toBe(40 * 25)
  })
  it('inks pixels for a value (counter visible)', () => {
    const cells = computeDigitTiles(0, 40, 25)
    const inked = cells.reduce((a, b) => a + b, 0)
    expect(inked).toBeGreaterThan(0)
  })
  it('places digits in the bottom-right (top-left tile empty)', () => {
    const cells = computeDigitTiles(0, 40, 25)
    expect(cells[0]).toBe(0)
  })
  it('produces different patterns for different values', () => {
    const a = computeDigitTiles(7, 40, 25)
    const b = computeDigitTiles(100, 40, 25)
    expect(Buffer.from(a)).not.toEqual(Buffer.from(b))
  })
  it('never writes outside the grid (empty grid is safe)', () => {
    const cells = computeDigitTiles(100, 1, 1)
    expect(cells.every((c) => c === 0)).toBe(true)
  })
})

describe('counter texture uploads', () => {
  it('redraws only when the displayed integer actually changes', () => {
    expect(shouldRedraw(0, 0)).toBe(false)
    expect(shouldRedraw(0, 0.4)).toBe(false)
    expect(shouldRedraw(0, 0.6)).toBe(true)
    expect(shouldRedraw(7, 7.2)).toBe(false)
    expect(shouldRedraw(7, 7.9)).toBe(true)
  })
})

describe('session-gate', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.documentElement.classList.remove('no-preload')
  })
  it('runs on a fresh session', () => {
    expect(shouldRunPreloader()).toBe(true)
  })
  it('skips when sessionStorage flag is set', () => {
    markVisited()
    expect(shouldRunPreloader()).toBe(false)
  })
  it('skips when <html> has no-preload (sync head gate)', () => {
    document.documentElement.classList.add('no-preload')
    expect(shouldRunPreloader()).toBe(false)
  })
})

describe('wavefront frontActivation', () => {
  it('is zero far behind the front (tile already disintegrated)', () => {
    expect(frontActivation(0.2, 0.8)).toBe(0)
  })
  it('is zero far ahead of the front (tile not reached yet)', () => {
    expect(frontActivation(0.9, 0.1)).toBe(0)
  })
  it('peaks at 1 exactly on the front (the appear moment)', () => {
    expect(frontActivation(0.5, 0.5)).toBe(1)
  })
  it('decays monotonically after the plateau', () => {
    const front = 0.5
    const span = FRONT_PROFILE.band - FRONT_PROFILE.core
    const steps = [0, 0.25, 0.5, 0.75, 1].map((f) =>
      frontActivation(front + FRONT_PROFILE.core + f * span, front),
    )
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThan(steps[i - 1])
    }
  })
  it('keeps a wide plateau of fully-lit tiles at the border', () => {
    const front = 0.5
    expect(frontActivation(front + FRONT_PROFILE.core * 0.5, front)).toBe(1)
    expect(frontActivation(front + FRONT_PROFILE.core, front)).toBe(1)
    expect(frontActivation(front + FRONT_PROFILE.band, front)).toBeCloseTo(0, 10)
  })
  it('is wide enough to keep many tiles alive at once', () => {
    expect(FRONT_PROFILE.band).toBeGreaterThan(0.15)
  })
  it('has a short trailing tail behind the front (snap, not a hard cut)', () => {
    const near = frontActivation(0.5 - 0.001, 0.5)
    const far = frontActivation(0.5 - 0.05, 0.5)
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(1)
    expect(far).toBe(0)
  })
  it('never leaves the 0..1 range across the whole sweep', () => {
    for (let i = 0; i <= 100; i++) {
      const v = frontActivation(i / 100, 0.37)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('exposes a positive band and a strictly shorter trail', () => {
    expect(FRONT_PROFILE.band).toBeGreaterThan(0)
    expect(FRONT_PROFILE.trail).toBeGreaterThan(0)
    expect(FRONT_PROFILE.trail).toBeLessThan(FRONT_PROFILE.band)
  })
})

describe('swellCurve', () => {
  it('is 0 at both ends of the pass and 1 in the middle', () => {
    expect(swellCurve(0)).toBe(0)
    expect(swellCurve(0.5)).toBe(1)
    expect(swellCurve(1)).toBe(0)
  })
  it('never leaves 0..1', () => {
    for (let i = 0; i <= 20; i++) {
      const v = swellCurve(i / 20)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('sweepFront', () => {
  it('keeps every tile dead at the start of the wave (nothing visible at 000)', () => {
    expect(sweepFront(0)).toBeLessThanOrEqual(-FRONT_PROFILE.band)
  })
  it('leaves every tile dead at the end of the wave', () => {
    expect(sweepFront(1)).toBeGreaterThanOrEqual(1)
  })
  it('increases strictly', () => {
    let prev = -Infinity
    for (let i = 0; i <= 50; i++) {
      const v = sweepFront(i / 50)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })
})

describe('upward swelling', () => {
  it('biases the growth upward as the pane swells', () => {
    expect(upwardBias(0)).toBe(1)
    expect(upwardBias(0.5)).toBeGreaterThan(1)
    expect(upwardBias(1)).toBeGreaterThan(upwardBias(0.5))
  })
  it('lifts the pane upward, never downward', () => {
    expect(liftOffset(0)).toBe(0)
    expect(liftOffset(1)).toBe(0)
    expect(liftOffset(0.5)).toBeLessThan(0)
    expect(liftOffset(0.5)).toBeLessThan(liftOffset(0.2))
  })
})

describe('preloader shader tile contract', () => {
  it('declares the wavefront and phase uniforms', () => {
    for (const name of ['uFront', 'uPhase', 'uCoverR', 'uGrain', 'uTrail', 'uDigitGate']) {
      expect(fragmentShader).toContain(`uniform float ${name}`)
    }
  })
  it('samples the pass-A ring render target (one canvas, ring + digits)', () => {
    expect(fragmentShader).toContain('uniform sampler2D uContent')
    expect(fragmentShader).toContain('texture2D(uContent, vUv)')
  })
  it('the ring lives with its tiles: content is gated by alive', () => {
    expect(fragmentShader).toContain('content.a * alive')
  })
  it('dies per tile in binary steps (no smoothstep anywhere, no grey gradient)', () => {
    expect(fragmentShader).toContain('float alive = 1.0 - step(0.0, burn)')
    expect(fragmentShader).toContain('step(burn, uTrail)')
    expect(fragmentShader).not.toMatch(/smoothstep\s*\(/)
  })
  it('has no fluted glass and no chromatic split left (removed by request)', () => {
    expect(fragmentShader).not.toContain('fluteSlope')
    expect(fragmentShader).not.toContain('uAberration')
    expect(fragmentShader).not.toContain('bend')
    expect(fragmentShader).not.toContain('pane')
  })
  it('paints the paper opening and the ink counter digits', () => {
    expect(fragmentShader).toContain('uniform vec3  uBG')
    expect(fragmentShader).toContain('uniform vec3  uInk')
    expect(fragmentShader).toContain('uInk')
  })
  it('dissolves from the screen CENTRE, not a corner', () => {
    expect(fragmentShader).toContain('uResolution * 0.5')
    expect(fragmentShader).toContain('length(tileCenter - uResolution * 0.5)')
  })
  it('keeps the counter hidden until the click gate opens (uDigitGate)', () => {
    expect(fragmentShader).toContain('uDigitGate * alive')
    expect(fragmentShader).toContain('1.0 - uDigitGate')
  })
  it('phase 1 is the cover: flat paper tiles with a flashing rim, no field grain', () => {
    expect(fragmentShader).toContain('uPhase < 0.5')
    expect(fragmentShader).toContain('mix(uBG, flashCol, flash), alive')
  })
})

describe('timeline', () => {
  it('gives the opening and the cover the same duration (one synchronised gesture twice)', () => {
    expect(TIMELINE.OPEN).toBe(TIMELINE.REVEAL)
  })
  it('uses slightly larger tiles than the original 36px grid', () => {
    expect(TILE_SIZE).toBeGreaterThan(36)
  })
})

describe('easing', () => {
  it('clamps the front curve to 0..1 and pins both ends', () => {
    expect(easeFlow(-1)).toBe(0)
    expect(easeFlow(0)).toBe(0)
    expect(easeFlow(1)).toBe(1)
    expect(easeFlow(2)).toBe(1)
    expect(easeFlow(0.5)).toBeCloseTo(0.5, 6)
  })
  it('has a non-zero slope at BOTH ends, unlike smootherstep', () => {
    const eps = 1e-4
    expect(easeFlow(eps) - easeFlow(0)).toBeGreaterThan(0)
    expect(easeFlow(1) - easeFlow(1 - eps)).toBeGreaterThan(0)
  })
  it('is strictly increasing everywhere', () => {
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const v = easeFlow(i / 100)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })
})

describe('follow (damped playhead)', () => {
  it('does not move at all on a zero timestep', () => {
    expect(followFactor(0)).toBe(0)
  })
  it('is frame-rate independent: two halves compose into one whole', () => {
    const whole = followFactor(100, 90)
    const half = followStep(followStep(0, 1, 50, 90), 1, 50, 90)
    expect(half).toBeCloseTo(whole, 4)
  })
  it('never exactly reaches the target, so a moving target never looks parked', () => {
    let v = 0
    for (let i = 0; i < 300; i++) v = followStep(v, 1, 16, 90)
    expect(v).toBeLessThan(1)
    expect(v).toBeGreaterThan(0.99)
  })
  it('moves toward the target from either side', () => {
    expect(followStep(0, 1, 16, 90)).toBeGreaterThan(0)
    expect(followStep(1, 0, 16, 90)).toBeLessThan(1)
  })
  it('is a no-op smoothing when the half-life is zero', () => {
    expect(followStep(0.3, 1, 16, 0)).toBe(1)
  })
  it('snaps to target immediately when snap=true', () => {
    expect(followStep(0.9, 0, 16, 90, true)).toBe(0)
    expect(followStep(0, 1, 16, 90, true)).toBe(1)
    expect(followStep(0.5, 0.2, 0, 90, true)).toBe(0.2)
    expect(followStep(0.5, 0.2, 16, 90, true)).toBe(0.2)
  })
  it('defaults to damped behavior when snap=false (default)', () => {
    expect(followStep(0.9, 0, 16, 90)).toBeLessThan(0.9)
    expect(followStep(0.9, 0, 16, 90)).toBeGreaterThan(0)
    expect(followStep(0.9, 0, 16, 90, false)).toBeLessThan(0.9)
    expect(followStep(0.9, 0, 16, 90, false)).toBeGreaterThan(0)
  })
})

describe('phaseFront', () => {
  it('sweeps the FULL canvas during seal (one continuous circle from the centre)', () => {
    for (let i = 0; i <= 100; i++) {
      const e = phaseFront('seal', i / 100)
      expect(e).toBeGreaterThanOrEqual(0)
      expect(e).toBeLessThanOrEqual(1)
    }
    expect(phaseFront('seal', 0)).toBe(0)
    expect(phaseFront('seal', 1)).toBe(1)
  })
  it('is dead for every other phase (count parks the front, cover has its own radius)', () => {
    expect(phaseFront('open', 1)).toBe(0)
    expect(phaseFront('reveal', 1)).toBe(0)
    expect(phaseFront('boot', 1)).toBe(0)
    expect(phaseFront('anything', 0.5)).toBe(0)
  })
  it('uses the easeFlow curve for the seal sweep, so both waves look identical', () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(phaseFront('seal', p)).toBe(easeFlow(p))
    }
  })
})

describe('FINAL_COUNT and the pruned v2 API', () => {
  it('counts all the way to 100 (the seal rolls 080 -> 100 while it crumbles)', () => {
    expect(FINAL_COUNT).toBe(100)
  })
  it('starts the crumble at 080, mid-count (seal trigger below the final count)', () => {
    expect(SEAL_TRIGGER).toBe(80)
    expect(SEAL_TRIGGER).toBeLessThan(FINAL_COUNT)
  })
  it('ends the count-driven front past the far corner, so all tiles die at 100', () => {
    expect(SEAL_FRONT_END).toBe(0.56)
    expect(SEAL_FRONT_END).toBeGreaterThan(0.5 + FRONT_PROFILE.trail)
  })
  it('no longer exports the removed v2 helpers', async () => {
    const cfg = await import('../../src/preloader/config.js')
    expect('idleFront' in cfg).toBe(false)
    expect('revealProgress' in cfg).toBe(false)
  })
})

describe('coverRadius (wave 2)', () => {
  it('starts past the far-corner radius and ends at zero', () => {
    expect(coverRadius(0)).toBe(COVER_START)
    expect(coverRadius(1)).toBe(0)
    expect(COVER_START).toBeGreaterThan(0.5)
  })
  it('shrinks monotonically, edge -> centre', () => {
    let prev = coverRadius(0)
    for (let i = 1; i <= 100; i++) {
      const v = coverRadius(i / 100)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
  })
  it('accepts an explicit start override', () => {
    expect(coverRadius(0, { start: 0.9 })).toBe(0.9)
    expect(coverRadius(1, { start: 0.9 })).toBe(0)
  })
})

describe('structural scene boundary', () => {
  const sceneSource = readFileSync(
    resolve(process.cwd(), 'src/preloader/scene.js'),
    'utf8',
  )

  it('renders the shared hero ring in pass A, not a star rig', () => {
    expect(sceneSource).toContain('./ring.js')
    expect(sceneSource).not.toContain('./star.js')
    expect(sceneSource).not.toContain('createStarRig')
  })

  it('paints the home paper, not a black field', () => {
    expect(sceneSource).toContain('0.9608')
    expect(sceneSource).not.toMatch(/new THREE\.Vector3\(0\.0, 0\.0, 0\.0\)/)
  })
})

describe('shouldMountGL', () => {
  it('never mounts WebGL under reduced motion (the gate requires no canvas)', () => {
    expect(shouldMountGL(true)).toBe(false)
    expect(shouldMountGL(false)).toBe(true)
  })
})

describe('structural preloader boundary', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/preloader/index.js'),
    'utf8',
  )
  const importSpecifiers = [
    ...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g),
  ].map((match) => match[1])

  it('imports no obsolete glass modules', () => {
    expect(importSpecifiers.filter((specifier) => specifier.startsWith('./glass/'))).toEqual([])
  })

  it('does not import the deleted DOM-mask reveal module', () => {
    expect(importSpecifiers.filter((specifier) => specifier.includes('reveal'))).toEqual([])
  })

  it('does not use the removed v2 scene APIs or the star handle', () => {
    expect(source).not.toContain('maskImage')
    expect(source).not.toContain('setFrontMode')
    expect(source).not.toContain('setShowTiles')
    expect(source).not.toContain('revealRadius')
    expect(source).not.toContain('createStarScene')
  })

  it('does not access the preloader through the glass global', () => {
    expect(source).not.toMatch(/__preloader\s*\.\s*glass/)
  })
})
