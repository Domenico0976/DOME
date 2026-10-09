// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { AudioReactPanel } from './AudioReactPanel'

afterEach(cleanup)

describe('AudioReactPanel', () => {
  test('renders', () => {
    useProjectStore.getState().reset()
    const { getByLabelText, container } = render(<AudioReactPanel />)
    expect(getByLabelText('Play/Pause')).toBeDefined()
    expect(getByLabelText('BPM')).toBeDefined()
    expect(container.querySelector('canvas')).toBeDefined()
  })

  test('toggles play/pause', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioReactPanel />)
    const btn = getByLabelText('Play/Pause') as HTMLButtonElement
    expect(useProjectStore.getState().timeline.playing).toBe(false)
    fireEvent.click(btn)
    expect(useProjectStore.getState().timeline.playing).toBe(true)
    fireEvent.click(btn)
    expect(useProjectStore.getState().timeline.playing).toBe(false)
  })

  test('updates bpm', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioReactPanel />)
    const bpm = getByLabelText('BPM') as HTMLInputElement
    fireEvent.change(bpm, { target: { value: '140' } })
    expect(useProjectStore.getState().timeline.bpm).toBe(140)
  })
})
