// Guarantees from VALIDATION.md §"Garanzie non-distruttive".
// Pure logic only: no DOM, no AudioContext, no registry.

import { describe, expect, it } from 'vitest'
import {
  ELEMENT_CATALOGUE,
  ELEMENT_GAPS,
  TOOL_SLOTS,
} from './sketchElements'
import {
  UI_COVERAGE,
  UI_GAPS,
  UI_INVENTORY,
} from './sketchUi'
import {
  SKETCH_COLUMNS,
} from './sketchTypes'
import {
  bindingToSketchRow,
  clampSensitivity,
  sketchMuteKey,
  sketchRowToBinding,
} from './sketchColumns'
import {
  buildExportPlan,
  frameTimeSec,
  pickMimeType,
} from './sketchExport'
import {
  freqToBin,
  SketchAudioEngine,
} from './sketchAudio'

describe('element catalogue', () => {
  it('covers 17 sketch kinds', () => {
    expect(ELEMENT_CATALOGUE.length).toBe(17)
  })

  it('has no gaps left (T1 closed waveform + spectrum)', () => {
    expect(ELEMENT_GAPS).toEqual([])
  })

  it('tool slots match the bundle vocabulary', () => {
    expect([...TOOL_SLOTS]).toEqual([
      'activeTool',
      'slotTool',
      'htmlTool',
      'audioTool',
      'savedTool',
    ])
  })
})

describe('ui inventory', () => {
  it('accounts every captured item with a status', () => {
    expect(UI_INVENTORY.length).toBe(UI_COVERAGE.total)
    expect(UI_COVERAGE.covered + UI_COVERAGE.adapt + UI_COVERAGE.gap).toBe(
      UI_COVERAGE.total,
    )
  })

  it('gaps are views only, never store/registry changes', () => {
    expect(UI_GAPS.length).toBe(4)
    for (const gap of UI_GAPS) {
      expect(gap.domeUi).toBeNull()
      expect(gap.rule).toMatch(/view|vista|static|statico|dropdown|copy/i)
    }
  })
})

describe('columns <-> bindings', () => {
  it('round-trips without loss', () => {
    const binding = {
      param: 'intensity',
      source: 'bass' as const,
      curve: 'linear' as const,
      amount: 1.5,
      range: { min: 0, max: 2 },
    }
    const row = bindingToSketchRow('u1', binding, 'r1')
    expect(sketchRowToBinding(row)).toEqual(binding)
  })

  it('translates window <-> level and nothing else', () => {
    const row = bindingToSketchRow(
      'u1',
      { param: 'opacity', source: 'level', curve: 'linear', amount: 1 },
      'r2',
    )
    expect(row.reactTo).toBe('window')
    expect(sketchRowToBinding(row).source).toBe('level')
  })

  it('uses the DOME mute-key convention', () => {
    expect(sketchMuteKey('u1', 'scaleX')).toBe('u1-scaleX')
  })

  it('clamps sensitivity to 0–2', () => {
    expect(clampSensitivity(-1)).toBe(0)
    expect(clampSensitivity(3)).toBe(2)
    expect(clampSensitivity(1.5)).toBe(1.5)
  })

  it('keeps the captured 7-column layout', () => {
    expect(SKETCH_COLUMNS.map((c) => c.kind)).toEqual([
      'duration',
      'presets',
      'reactTo',
      'sensitivity',
      'valueRange',
      'frequency',
      'timeline',
    ])
    const fixed = SKETCH_COLUMNS.reduce((s, c) => s + (c.widthPx ?? 0), 0)
    expect(fixed).toBe(258 + 158 + 132 + 144 + 132 + 44)
  })
})

describe('export plan', () => {
  it('computes total frames and wraps frame time', () => {
    const plan = buildExportPlan({
      mode: 'frame-by-frame',
      format: 'png-sequence',
      mimeType: 'image/png',
      fps: 60,
      durationSec: 60,
      width: 1280,
      height: 720,
    })
    expect(plan.totalFrames).toBe(3600)
    expect(frameTimeSec(plan, 30)).toBeCloseTo(0.5)
    expect(frameTimeSec(plan, 3600)).toBeCloseTo(0)
  })

  it('picks a supported mime with fallback', () => {
    expect(pickMimeType('webm', (m) => m.includes('vp8'))).toContain('vp8')
    expect(pickMimeType('mp4', () => false)).toBe('video/mp4')
  })
})

describe('audio engine (static parts)', () => {
  it('maps frequency to FFT bin', () => {
    expect(freqToBin(160, 48000, 2048)).toBe(6)
    expect(freqToBin(20000, 48000, 2048)).toBe(853)
    expect(freqToBin(24000, 48000, 2048)).toBe(1023)
  })

  it('resolves every ReactToSource incl. spectrum clamping', () => {
    const bands = {
      bass: 0.1,
      mid: 0.2,
      treble: 0.3,
      level: 0.4,
      spectrum: Float32Array.from([0.5, 0.6]),
      beat: { detected: false, strength: 0 },
      bpm: 120,
    }
    expect(SketchAudioEngine.resolveSource(bands, 'bass')).toBe(0.1)
    expect(SketchAudioEngine.resolveSource(bands, 'window')).toBe(0.4)
    expect(SketchAudioEngine.resolveSource(bands, 'bpm')).toBeCloseTo(120 / 180)
    expect(SketchAudioEngine.resolveSource(bands, 'spectrum', 1)).toBeCloseTo(0.6)
    expect(SketchAudioEngine.resolveSource(bands, 'spectrum', 99)).toBeCloseTo(0.6)
  })
})
