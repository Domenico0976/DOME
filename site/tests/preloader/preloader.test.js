// @vitest-environment jsdom
// Unit tests for the first-landing preloader. Lives in tests/preloader/ so the
// whole plan can be wiped in one go without touching other plans' tests.
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  phaseFront,
  easeFlow,
  shouldMountGL,
  followFactor,
  followStep,
  idleFront,
} from '../../src/preloader/config.js'
import {
  revealRadius,
  revealMask,
  revealMaskImage,
  REVEAL_FEATHER,
} from '../../src/preloader/reveal.js'
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
    // register would feel identical to the frozen counter it replaced.
    expect(creepProgress(1000)).toBeGreaterThan(0.2)
    expect(creepProgress(2000)).toBeGreaterThan(0.4)
  })

  it('survives a degenerate time constant instead of returning NaN', () => {
    expect(creepProgress(1000, { tau: 0 })).toBe(0)
    expect(Number.isFinite(creepProgress(1000, { tau: -5 }))).toBe(true)
  })
})

describe('counter damping (the jump to 100)', () => {
  it('never overshoots the target, so it cannot claim more than the load did', () => {
    // This is what makes the easing honest rather than cosmetic: a smoothed bar
    // that can exceed 100 is lying, this one cannot.
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
    // the load settled it went from wherever it was to a whole 100.
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

  it('reaches exactly 100, never an asymptote', () => {
    // seal ends on this number, so 99.9 forever is not an option.
    let v = 0
    for (let i = 0; i < 1000; i++) v = displayProgress(v, 1, 16)
    expect(v).toBe(1)
  })

  it('gets there inside the seal phase, so the reveal never starts under 100', () => {
    let v = 0.9
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
  it('declares the wavefront + glass uniforms', () => {
    for (const name of [
      'uFront',
      'uFrontMode',
      'uShowTiles',
      'uAberration',
      'uGrain',
      'uBand',
      'uTrail',
    ]) {
      expect(fragmentShader).toContain(`uniform float ${name}`)
    }
  })
  it('gates the glass contribution on uShowTiles (no tiles at 000)', () => {
    expect(fragmentShader).toMatch(/showTiles\s*\*\s*frontGlass|frontGlass\s*\([^)]*\)\s*\*\s*showTiles/)
  })
  it('keeps a per-tile flute and a chromatic split', () => {
    expect(fragmentShader).toContain('flute')
    expect(fragmentShader).toContain('uAberration')
  })
  it('swells the pane as the front crosses it', () => {
    expect(fragmentShader).toContain('swell')
  })
  it('paints the grey opening that the first wave consumes', () => {
    expect(fragmentShader).toContain('uniform vec3  uGrey')
    expect(fragmentShader).toContain('uGrey')
  })
  it('has no hard step left on the cut edge', () => {
    expect(fragmentShader).not.toMatch(/step\(\s*0\.0\s*,\s*cut\s*\)/)
    expect(fragmentShader).not.toMatch(/step\(\s*cut\s*,\s*0\.0\s*\)/)
  })
  it('feathers the cut edge over uEdge', () => {
    expect(fragmentShader).toContain('uniform float uEdge')
    expect(fragmentShader).toContain('uEdge')
  })
  it('lifts the pane off the ground and biases the growth upward', () => {
    expect(fragmentShader).toContain('lift')
    expect(fragmentShader).toContain('upBias')
  })
})

describe('timeline', () => {
  it('gives the opening and the reveal the same duration (one synchronised gesture twice)', () => {
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

describe('idleFront', () => {
  it('keeps moving while the app is still loading (no dead time)', () => {
    const samples = new Set()
    for (let t = 0; t <= 3000; t += 100) samples.add(idleFront(t).toFixed(5))
    expect(samples.size).toBeGreaterThan(10)
  })
  it('stays in a sane band near the far corner', () => {
    for (let t = 0; t <= 4000; t += 50) {
      const v = idleFront(t)
      expect(v).toBeGreaterThan(0.7)
      expect(v).toBeLessThan(1.1)
    }
  })
  it('is continuous, frame to frame', () => {
    let prev = idleFront(0)
    for (let t = 50; t <= 3000; t += 50) {
      const v = idleFront(t)
      expect(Math.abs(v - prev)).toBeLessThan(0.05)
      prev = v
    }
  })
})

describe('phaseFront', () => {
  it('never lets the front past the half mark while counting', () => {
    for (let i = 0; i <= 100; i++) {
      expect(phaseFront('open', i / 100)).toBeLessThanOrEqual(0.5)
    }
  })
  it('completes the canvas from the half mark during seal', () => {
    expect(phaseFront('seal', 0)).toBeCloseTo(0.5, 6)
    expect(phaseFront('seal', 1)).toBe(1)
  })
  it('restarts from the top-left corner for the homepage reveal', () => {
    expect(phaseFront('reveal', 0)).toBe(0)
    expect(phaseFront('reveal', 1)).toBe(1)
  })
  it('hands over with no gap and no overlap', () => {
    expect(phaseFront('open', 1)).toBeCloseTo(phaseFront('seal', 0), 6)
    expect(phaseFront('seal', 1)).toBe(phaseFront('reveal', 1))
  })
  it('is dead during boot, so 000 shows no tile at all', () => {
    expect(phaseFront('boot', 1)).toBe(0)
  })
})

describe('shouldMountGL', () => {
  it('never mounts WebGL under reduced motion (the gate requires no canvas)', () => {
    expect(shouldMountGL(true)).toBe(false)
    expect(shouldMountGL(false)).toBe(true)
  })
})

describe('homepage reveal', () => {
  it('starts at zero radius and reaches past the far corner', () => {
    expect(revealRadius(sweepFront(0), 1440, 900)).toBe(0)
    expect(revealRadius(sweepFront(1), 1440, 900)).toBeGreaterThan(Math.hypot(1440, 900))
  })
  it('reveals nothing at radius zero and everything well past it', () => {
    expect(revealMask(0, 0)).toBe(0)
    expect(revealMask(0, 500)).toBe(1)
  })
  it('feathers the edge instead of cutting it', () => {
    const r = 100
    expect(REVEAL_FEATHER).toBeGreaterThan(0)
    expect(revealMask(r - REVEAL_FEATHER, r)).toBe(1)
    expect(revealMask(r, r)).toBe(0)
    const mid = revealMask(r - REVEAL_FEATHER / 2, r)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })
  it('builds a soft radial mask rather than a hard clip', () => {
    const css = revealMaskImage(200)
    expect(css).toContain('radial-gradient')
    expect(css).toContain('circle')
  })
})

describe('reveal progress', () => {
  it('measures from revealStart, not from the start of the timeline', async () => {
    const { revealProgress } = await import('../../src/preloader/config.js')
    const sealEnd = TIMELINE.BOOT + TIMELINE.OPEN + TIMELINE.SEAL
    const revealStart = sealEnd + 1500
    const now = 6000
    expect(revealProgress(now, revealStart)).toBeCloseTo(0.375, 9)
  })

  it('reaches exactly 1 at revealStart + TIMELINE.REVEAL', async () => {
    const { revealProgress } = await import('../../src/preloader/config.js')
    const sealEnd = TIMELINE.BOOT + TIMELINE.OPEN + TIMELINE.SEAL
    const revealStart = sealEnd + 1500
    expect(revealProgress(revealStart + TIMELINE.REVEAL, revealStart)).toBe(1)
  })

  it('is 0 before a valid revealStart', async () => {
    const { revealProgress } = await import('../../src/preloader/config.js')
    expect(revealProgress(1000, 0)).toBe(0)
  })

  it('clamps overshoot to 1', async () => {
    const { revealProgress } = await import('../../src/preloader/config.js')
    const sealEnd = TIMELINE.BOOT + TIMELINE.OPEN + TIMELINE.SEAL
    const revealStart = sealEnd + 1500
    expect(revealProgress(revealStart + TIMELINE.REVEAL + 500, revealStart)).toBe(1)
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

  it('does not access glass through the preloader global', () => {
    expect(source).not.toMatch(/__preloader\s*\.\s*glass/)
  })
})
