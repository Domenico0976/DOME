// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { getAudioRuntime } from '../audio/runtime'
import { ToastProvider } from './Toast'
import { registerTool } from '../core/registry'
import type { ToolDef } from '../core/types'
import { AudioReactPanel } from './AudioReactPanel'
import '../tools'

afterEach(cleanup)

describe('AudioReactPanel', () => {
  test('renders', () => {
    useProjectStore.getState().reset()
    const { getByLabelText, container } = render(<AudioReactPanel />)
    expect(getByLabelText('Play/Pause')).toBeDefined()
    expect(getByLabelText('BPM')).toBeDefined()
    expect(container.querySelector('footer')).toBeTruthy()
  })

  test('toggles play/pause on the element', () => {
    useProjectStore.getState().reset()
    const fakeEl = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      volume: 1,
      currentTime: 0,
      duration: 120,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLAudioElement
    getAudioRuntime().setMedia(fakeEl)
    useProjectStore.setState((s) => ({ ...s, audio: { ...s.audio, source: 'file' as const } }))
    const { getByLabelText } = render(<AudioReactPanel />)
    const btn = getByLabelText('Play/Pause') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    return (async () => {
      await act(async () => {
        fireEvent.click(btn)
      })
      expect(fakeEl.play).toHaveBeenCalledTimes(1)
      expect(useProjectStore.getState().timeline.playing).toBe(true)
      fireEvent.click(btn)
      expect(fakeEl.pause).toHaveBeenCalledTimes(1)
      expect(useProjectStore.getState().timeline.playing).toBe(false)
      getAudioRuntime().setMedia(null)
    })()
  })

  test('play is disabled with no source', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioReactPanel />)
    expect(getByLabelText('Play/Pause') as HTMLButtonElement).toBeTruthy()
    expect((getByLabelText('Play/Pause') as HTMLButtonElement).disabled).toBe(true)
  })

  test('Add Preset opens the cascade with id preset-cascade', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('text')
    const { getByLabelText, queryByTestId } = render(<AudioReactPanel />)
    const btn = getByLabelText('Add Preset') as HTMLButtonElement
    expect(btn.getAttribute('aria-controls')).toBe('preset-cascade')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(queryByTestId('preset-cascade')).toBeNull()
    fireEvent.click(btn)
    expect(queryByTestId('preset-cascade')).toBeTruthy()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  test('Add Preset is disabled when the stack is empty', () => {
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().stack.length).toBe(0)
    const { getByLabelText } = render(<AudioReactPanel />)
    const btn = getByLabelText('Add Preset') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toBe('Add a tool first')
  })

  test('updates bpm', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioReactPanel />)
    const bpm = getByLabelText('BPM') as HTMLInputElement
    fireEvent.change(bpm, { target: { value: '140' } })
    expect(useProjectStore.getState().timeline.bpm).toBe(140)
  })

  test('master waveform renders empty state without a timeline slider', () => {
    useProjectStore.getState().reset()
    useProjectStore.setState((s) => ({
      ...s,
      timeline: { ...s.timeline, durationSec: 0 }
    }))
    const { container, getByText, queryByTestId } = render(<AudioReactPanel />)
    expect(queryByTestId('master-waveform')).toBeTruthy()
    expect(getByText('Load audio to see waveform')).toBeTruthy()
    expect(container.querySelector('[aria-label="Timeline"]')).toBeNull()
    expect(container.querySelector('[aria-label="Timeline disabled, no audio loaded"]')).toBeNull()
  })

  test('volume slider updates the store volume', () => {
    useProjectStore.getState().reset()
    const { getByRole } = render(<AudioReactPanel />)
    const slider = getByRole('slider', { name: 'Volume' })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(useProjectStore.getState().audio.volume).toBeCloseTo(0.99)
  })

  test('creator adds an Amount-first binding to the selected layer', () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().selectTool(uid)
    const { getByText } = render(<AudioReactPanel creatorOpen />)
    fireEvent.click(getByText('Add modulation'))
    const audio = useProjectStore.getState().stack[0].audio
    expect(audio).toHaveLength(1)
    expect(audio[0]).toMatchObject({ param: 'speed', source: 'bass', amount: 1 })
  })

  test('creator shows read-only chip instead of the form when a binding already exists', () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().selectTool(uid)
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'mid', curve: 'linear', amount: 1 })
    const { getByText, queryByText } = render(<AudioReactPanel creatorOpen />)
    expect(getByText(/React to: mid · Sens 100%/)).toBeTruthy()
    expect(queryByText('Add modulation')).toBeNull()
    expect(queryByText(/Replaces existing/)).toBeNull()
  })

  test('preset mini-waveform adjusts amount with arrow keys', () => {    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    const { getByRole } = render(<AudioReactPanel />)
    const strip = getByRole('slider', { name: /speed level from bass/ })
    expect(strip.getAttribute('aria-valuenow')).toBe('100')
    fireEvent.keyDown(strip, { key: 'ArrowRight' })
    expect(useProjectStore.getState().stack[0].audio[0].amount).toBeCloseTo(1.05)
  })

  test('preset row edits driver through React To Panel', () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    const { getByLabelText } = render(<AudioReactPanel />)
    fireEvent.click(getByLabelText('React to settings for bass'))
    const driver = getByLabelText('Audio driver') as HTMLSelectElement
    fireEvent.change(driver, { target: { value: 'mid' } })
    expect(useProjectStore.getState().stack[0].audio[0].source).toBe('mid')
  })

  test('creator asks for a layer when nothing is selected', () => {
    useProjectStore.getState().reset()
    const { getByText } = render(<AudioReactPanel creatorOpen />)
    expect(getByText('Select a layer to create an audio modulation.')).toBeTruthy()
  })

  test('audio status line renders binding count', () => {
    useProjectStore.getState().reset()
    const { getByTestId } = render(<AudioReactPanel />)
    expect(getByTestId('audio-status').textContent).toMatch(/bindings:\d/)
  })

  test('preset row shows #N identity matching its element index', () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    useProjectStore.getState().addTool('cx')
    useProjectStore.getState().selectTool(useProjectStore.getState().stack[0].uid)
    useProjectStore.getState().addAudioBinding(useProjectStore.getState().stack[0].uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    useProjectStore.getState().selectTool(useProjectStore.getState().stack[1].uid)
    useProjectStore.getState().addAudioBinding(useProjectStore.getState().stack[1].uid, { param: 'speed', source: 'mid', curve: 'linear', amount: 0.5 })
    const { container } = render(<AudioReactPanel />)
    const rows = container.querySelectorAll('.divide-y > div')
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain('#0')
    expect(rows[1].textContent).toContain('#1')
  })

  test('file load failure surfaces an error toast', async () => {
    useProjectStore.getState().reset()
    const { container, getByText } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'x.mp3', { type: 'audio/mpeg' })] } })
    })
    expect(getByText(/AudioContext/)).toBeTruthy()
  })

  test('Download dropdown opens and renders the three groups', async () => {
    useProjectStore.getState().reset()
    const { getByRole, getByText } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    const trigger = getByRole('button', { name: 'Download' })
    await act(async () => {
      fireEvent.pointerDown(trigger)
      fireEvent.click(trigger)
    })
    expect(getByText('Export')).toBeTruthy()
    expect(getByText('PNG')).toBeTruthy()
    expect(getByText('Instagram')).toBeTruthy()
    expect(getByText('Spotify Canvas')).toBeTruthy()
    expect(getByText('View')).toBeTruthy()
    expect(getByText('Fullscreen')).toBeTruthy()
    expect(getByText('Project')).toBeTruthy()
    expect(getByText('Reset')).toBeTruthy()
  })

  test('export actions fire (PNG, Instagram, Spotify, Fullscreen, Reset)', async () => {
    useProjectStore.getState().reset()
    const { getByRole, getByText } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    const openMenu = async () => {
      const trigger = getByRole('button', { name: 'Download' })
      await act(async () => {
        fireEvent.pointerDown(trigger)
        fireEvent.click(trigger)
      })
    }
    const clickItem = async (label: string) => {
      await act(async () => {
        fireEvent.click(getByText(label))
      })
    }
    await openMenu()
    await clickItem('PNG')
    await openMenu()
    await clickItem('Instagram')
    await openMenu()
    await clickItem('Spotify Canvas')
    await openMenu()
    await clickItem('Fullscreen')
    await openMenu()
    await clickItem('Reset')
    expect(useProjectStore.getState().stack.length).toBe(0)
  })

  test('shows Raster output badge when an enabled effect exists', async () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'grain')
    const { getByText } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    expect(getByText('Raster output')).toBeTruthy()
  })

  test('no badge without enabled effects', () => {
    useProjectStore.getState().reset()
    const { queryByText } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    expect(queryByText('Raster output')).toBeNull()
  })

  test('footer is two-tier (44px tips + 57px transport) with a collapsible panel slot', async () => {
    useProjectStore.getState().reset()
    const { container, getByLabelText } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    const footer = container.querySelector('footer') as HTMLElement
    expect(footer).toBeTruthy()
    expect(footer.className).toContain('flex-col')

    const tipsRow = footer.querySelector('.h-11') as HTMLElement
    expect(tipsRow).toBeTruthy()

    const mainBar = tipsRow?.nextElementSibling as HTMLElement
    expect(mainBar.className).toContain('h-[57px]')

    expect(footer.style.getPropertyValue('--soundbar-height')).toBe('101px')
    const toggle = getByLabelText('Expand panel') as HTMLElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    const collapseToggle = getByLabelText('Collapse panel') as HTMLElement
    expect(collapseToggle.getAttribute('aria-expanded')).toBe('true')
    expect(footer.style.getPropertyValue('--soundbar-height')).toBe('390px')
    fireEvent.click(collapseToggle)
    expect(footer.style.getPropertyValue('--soundbar-height')).toBe('101px')
  })

  test('expanded soundbar has ResizeHandle, 60/40 zones, and MasterWaveform', () => {
    useProjectStore.getState().reset()
    const { getByLabelText, queryByTestId } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    expect(queryByTestId('soundbar-resize')).toBeNull()
    expect(queryByTestId('master-waveform')).toBeTruthy()
    fireEvent.click(getByLabelText('Expand panel'))
    const handle = queryByTestId('soundbar-resize')
    expect(handle).toBeTruthy()
    expect(handle?.className).toContain('cursor-row-resize')
    expect(queryByTestId('master-waveform')).toBeTruthy()
    const left = handle?.parentElement?.querySelector('.flex-\\[6\\]') as HTMLElement
    const right = handle?.parentElement?.querySelector('.flex-\\[4\\]') as HTMLElement
    expect(left).toBeTruthy()
    expect(right).toBeTruthy()
    expect(left.className).toContain('min-w-0')
    expect(right.className).toContain('min-w-0')
    const meters = handle?.parentElement?.querySelector('[aria-label^="Live audio levels"]') as HTMLElement
    expect(meters).toBeTruthy()
    expect(meters.className).toContain('w-[40px]')
  })

  test('preset table renders five frame columns with fr ratios', () => {
    useProjectStore.getState().reset()
    const { getByText } = render(<AudioReactPanel />)
    expect(getByText('Presets')).toBeTruthy()
    expect(getByText('React to')).toBeTruthy()
    expect(getByText('Sensitivity')).toBeTruthy()
    expect(getByText('Value range')).toBeTruthy()
    expect(getByText('EQ')).toBeTruthy()
    const header = getByText('Presets').parentElement as HTMLElement
    expect(header.className).toContain('h-[40px]')
    expect(header.style.gridTemplateColumns).toContain('200fr')
    expect(header.style.gridTemplateColumns).toContain('150fr')
    expect(header.style.gridTemplateColumns).toContain('130fr')
    expect(header.style.gridTemplateColumns).toContain('120fr')
    expect(header.style.gridTemplateColumns).toContain('200fr')
  })

  test('preset row kebab opens with Duplicate/Hide/Delete and Delete removes the row', async () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    expect(useProjectStore.getState().stack[0].audio).toHaveLength(1)
    const { getAllByLabelText, getByText } = render(<AudioReactPanel />)
    const kebab = getAllByLabelText('Row actions')[0]
    await act(async () => {
      fireEvent.pointerDown(kebab)
      fireEvent.click(kebab)
    })
    expect(getByText('Duplicate')).toBeTruthy()
    expect(getByText('Hide')).toBeTruthy()
    expect(getByText('Delete')).toBeTruthy()
    await act(async () => {
      fireEvent.click(getByText('Delete'))
    })
    expect(useProjectStore.getState().stack[0].audio).toHaveLength(0)
  })

  test('preset row Duplicate creates a new stack layer', async () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    expect(useProjectStore.getState().stack.length).toBe(1)
    const { getAllByLabelText, getByText } = render(<AudioReactPanel />)
    const kebab = getAllByLabelText('Row actions')[0]
    await act(async () => {
      fireEvent.pointerDown(kebab)
      fireEvent.click(kebab)
    })
    await act(async () => {
      fireEvent.click(getByText('Duplicate'))
    })
    expect(useProjectStore.getState().stack.length).toBe(2)
  })

  test('React To Panel opens from the preset row', () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    const { getByLabelText, getByText } = render(<AudioReactPanel />)
    fireEvent.click(getByLabelText('React to settings for bass'))
    expect(getByText('React To Panel')).toBeTruthy()
  })

  test('value range cell writes binding.range on edit', () => {
    const tool: ToolDef = {
      id: 'cx', kind: 'generative', version: '1.0.0', label: 'Cx', icon: '', category: 'Generative',
      defaultParams: {}, controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
      render() {},
    }
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('cx')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    const { getByLabelText } = render(<AudioReactPanel />)
    fireEvent.change(getByLabelText('Range min for speed'), { target: { value: '2' } })
    fireEvent.change(getByLabelText('Range max for speed'), { target: { value: '5' } })
    expect(useProjectStore.getState().stack[0].audio[0].range).toEqual({ min: 2, max: 5 })
  })
})
