// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { AudioBar } from './AudioBar'

afterEach(cleanup)

describe('AudioBar', () => {
  test('toggles play/pause', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioBar />)
    const btn = getByLabelText('Play/Pause') as HTMLButtonElement
    expect(useProjectStore.getState().timeline.playing).toBe(false)
    fireEvent.click(btn)
    expect(useProjectStore.getState().timeline.playing).toBe(true)
    fireEvent.click(btn)
    expect(useProjectStore.getState().timeline.playing).toBe(false)
  })

  test('updates bpm', () => {
    useProjectStore.getState().reset()
    const { getByLabelText } = render(<AudioBar />)
    const bpm = getByLabelText('BPM') as HTMLInputElement
    fireEvent.change(bpm, { target: { value: '140' } })
    expect(useProjectStore.getState().timeline.bpm).toBe(140)
  })
})
