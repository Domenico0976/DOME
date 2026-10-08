// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { AudioPresetMenu } from './AudioPresetMenu'
import type { ToolDef } from '../core/types'

afterEach(cleanup)

const testTool: ToolDef = {
  id: 'test-tool',
  kind: 'generative',
  version: '1.0.0',
  label: 'Test Tool',
  icon: '◆',
  category: 'Generative',
  defaultParams: { speed: 1 },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 0.1 },
  ],
  render() {},
}

describe('AudioPresetMenu', () => {
  beforeEach(() => {
    registerTool(testTool)
  })

  test('renders when open', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    const { getByText } = render(
      <AudioPresetMenu open={true} anchorEl={anchor} onSelect={() => {}} onClose={() => {}} />,
    )
    expect(getByText('Tools')).toBeTruthy()
    expect(getByText('Test Tool')).toBeTruthy()
    document.body.removeChild(anchor)
  })

  test('does not render when closed', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    const { queryByText } = render(
      <AudioPresetMenu open={false} anchorEl={anchor} onSelect={() => {}} onClose={() => {}} />,
    )
    expect(queryByText('Tools')).toBeNull()
    document.body.removeChild(anchor)
  })

  test('selecting a tool shows its params', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    const { getByText, queryByText } = render(
      <AudioPresetMenu open={true} anchorEl={anchor} onSelect={() => {}} onClose={() => {}} />,
    )
    expect(queryByText('Speed')).toBeNull()
    fireEvent.click(getByText('Test Tool'))
    expect(getByText('Speed')).toBeTruthy()
    document.body.removeChild(anchor)
  })

  test('clicking param calls onSelect', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    const onSelect = vi.fn()
    const { getByText } = render(
      <AudioPresetMenu open={true} anchorEl={anchor} onSelect={onSelect} onClose={() => {}} />,
    )
    fireEvent.click(getByText('Test Tool'))
    fireEvent.click(getByText('Speed'))
    fireEvent.click(getByText('bass'))
    expect(onSelect).toHaveBeenCalledWith({
      toolId: 'test-tool',
      param: 'speed',
      reactTo: 'bass',
    })
    document.body.removeChild(anchor)
  })

  test('clicking outside calls onClose', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    const onClose = vi.fn()
    render(
      <AudioPresetMenu open={true} anchorEl={anchor} onSelect={() => {}} onClose={onClose} />,
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    document.body.removeChild(anchor)
  })
})
