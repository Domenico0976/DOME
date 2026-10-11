// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { NumberInput } from './number-input'

describe('NumberInput', () => {
  test('renders 32px height (spec) and mono font', () => {
    const { container } = render(<NumberInput value={5} onChange={() => {}} />)
    const wrap = container.firstChild as HTMLElement
    expect(wrap.className).toContain('h-8')
    expect(wrap.className).toContain('w-[72px]')
    const input = container.querySelector('input')
    expect(input?.className).toContain('font-mono')
    expect(input?.className).toContain('tabular-nums')
  })

  test('stepper buttons have aria-labels', () => {
    const { container } = render(<NumberInput value={5} onChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].getAttribute('aria-label')).toBe('Increase value')
    expect(buttons[1].getAttribute('aria-label')).toBe('Decrease value')
  })

  test('increase stepper calls onChange with clamped value', () => {
    const onChange = vi.fn()
    const { container } = render(<NumberInput value={5} max={10} step={2} onChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[0])
    expect(onChange).toHaveBeenCalledWith(7)
  })

  test('decrease stepper calls onChange with clamped value', () => {
    const onChange = vi.fn()
    const { container } = render(<NumberInput value={5} min={0} step={1} onChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1])
    expect(onChange).toHaveBeenCalledWith(4)
  })

  test('clamps to max', () => {
    const onChange = vi.fn()
    const { container } = render(<NumberInput value={9} max={10} step={5} onChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[0])
    expect(onChange).toHaveBeenCalledWith(10)
  })

  test('clamps to min', () => {
    const onChange = vi.fn()
    const { container } = render(<NumberInput value={1} min={0} step={5} onChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1])
    expect(onChange).toHaveBeenCalledWith(0)
  })

  test('disabled state prevents interaction', () => {
    const onChange = vi.fn()
    const { container } = render(<NumberInput value={5} disabled onChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[0].hasAttribute('disabled')).toBe(true)
    expect(buttons[1].hasAttribute('disabled')).toBe(true)
    fireEvent.click(buttons[0])
    expect(onChange).not.toHaveBeenCalled()
  })

  test('input has aria-label when label provided', () => {
    const { container } = render(<NumberInput value={5} label="BPM" onChange={() => {}} />)
    const input = container.querySelector('input')
    expect(input?.getAttribute('aria-label')).toBe('BPM')
  })

  test('ArrowUp / ArrowDown keys step the value', () => {
    const onChange = vi.fn()
    const { container } = render(<NumberInput value={5} step={1} onChange={onChange} />)
    const input = container.querySelector('input')!
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith(6)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(4)
  })
})