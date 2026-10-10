// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { ColorPicker } from './color-picker'

describe('ColorPicker', () => {
  afterEach(() => {
    // Clean up any Radix portal content left in body
    document.body.innerHTML = ''
  })

  test('renders swatch with current color', () => {
    const { container } = render(<ColorPicker value="#FF3B30" onChange={() => {}} />)
    const trigger = container.querySelector('button') as HTMLButtonElement
    expect(trigger.style.backgroundColor).toBe('rgb(255, 59, 48)')
  })

  test('renders hex value text', () => {
    const { container } = render(<ColorPicker value="#FF3B30" onChange={() => {}} />)
    const valueSpan = container.querySelector('span[aria-live="off"]') as HTMLElement
    expect(valueSpan?.textContent).toBe('#FF3B30')
  })

  test('selecting palette color calls onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(<ColorPicker value="#FF3B30" onChange={onChange} />)
    const trigger = container.querySelector('button[aria-label="Pick color"]') as HTMLButtonElement
    fireEvent.click(trigger)
    const target = await waitFor(() =>
      document.body.querySelector('button[aria-label="Select #0A84FF"]'),
    ) as HTMLButtonElement
    expect(target).toBeTruthy()
    fireEvent.click(target)
    expect(onChange).toHaveBeenCalledWith('#0a84ff')
  })

  test('invalid hex keeps value but does not call onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(<ColorPicker value="#FF3B30" onChange={onChange} />)
    const trigger = container.querySelector('button[aria-label="Pick color"]') as HTMLButtonElement
    fireEvent.click(trigger)
    const input = await waitFor(() =>
      document.body.querySelector('input[aria-label="Hex color value"]'),
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-color' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})