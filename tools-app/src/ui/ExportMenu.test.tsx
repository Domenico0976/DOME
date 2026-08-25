// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import '../tools'
import { ExportMenu } from './ExportMenu'

afterEach(cleanup)

describe('ExportMenu', () => {
  test('renders export actions', () => {
    useProjectStore.getState().reset()
    const { getByText } = render(<ExportMenu />)
    expect(getByText('Export PNG')).toBeTruthy()
    expect(getByText('Instagram')).toBeTruthy()
    expect(getByText('Spotify Canvas')).toBeTruthy()
    expect(getByText('Fullscreen')).toBeTruthy()
  })

  test('reset clears the stack without throwing', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('solidColor')
    expect(useProjectStore.getState().stack.length).toBe(1)
    const { getByText } = render(<ExportMenu />)
    fireEvent.click(getByText('Reset'))
    expect(useProjectStore.getState().stack.length).toBe(0)
  })
})
