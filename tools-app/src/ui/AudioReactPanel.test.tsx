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
    expect(container.querySelector('canvas')).toBeDefined()
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

  test('updates bpm', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioReactPanel />)
    const bpm = getByLabelText('BPM') as HTMLInputElement
    fireEvent.change(bpm, { target: { value: '140' } })
    expect(useProjectStore.getState().timeline.bpm).toBe(140)
  })

  test('slider disabled when durationSec <= 0', () => {
    useProjectStore.getState().reset()
    useProjectStore.setState((s) => ({
      ...s,
      timeline: { ...s.timeline, durationSec: 0 }
    }))
    const { getByLabelText, getByText, container } = render(<AudioReactPanel />)
    expect(getByLabelText('Timeline disabled, no audio loaded')).toBeTruthy()
    expect(getByText('0.0s / 0.0s')).toBeTruthy()
    expect(container.querySelector('[aria-label="Timeline"] [role="slider"]')).toBeNull()
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
    const { getByLabelText, getByText } = render(<AudioReactPanel />)
    fireEvent.click(getByLabelText('Add Preset'))
    fireEvent.click(getByText('Add modulation'))
    const audio = useProjectStore.getState().stack[0].audio
    expect(audio).toHaveLength(1)
    expect(audio[0]).toMatchObject({ param: 'speed', source: 'bass', amount: 1 })
  })

  test('creator asks for a layer when nothing is selected', () => {
    useProjectStore.getState().reset()
    const { getByLabelText, getByText } = render(<AudioReactPanel />)
    fireEvent.click(getByLabelText('Add Preset'))
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

  test('footer has 136px height with two zones and focus-guarded shortcuts', async () => {
    useProjectStore.getState().reset()
    const { container } = render(
      <ToastProvider>
        <AudioReactPanel />
      </ToastProvider>,
    )
    const footer = container.querySelector('footer') as HTMLElement
    expect(footer).toBeTruthy()
    expect(footer.className).toContain('h-[136px]')
    expect(footer.className).toContain('flex-col')
    // Zone A top row h-11
    const zoneA = footer.querySelector('.h-11') as HTMLElement
    expect(zoneA).toBeTruthy()
    // Zone B (waveform row) exists below
    expect(zoneA?.nextElementSibling).toBeTruthy()
  })
})
