// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { useToast, ToastProvider } from '../ui/Toast'

afterEach(cleanup)

function Harness({ onToast }: { onToast: (t: ReturnType<typeof useToast>) => void }) {
  const t = useToast()
  onToast(t)
  return null
}

describe('Toast system', () => {
  test('renders inside ToastProvider and fires toast', () => {
    const handler = vi.fn()
    const { container } = render(
      <ToastProvider>
        <Harness onToast={handler} />
      </ToastProvider>,
    )
    expect(handler).toHaveBeenCalledTimes(1)
    const toast = handler.mock.calls[0][0]
    act(() => toast.toast('hello', { kind: 'info' }))
    expect(container.textContent).toContain('hello')
  })

  test('info auto-dismisses after timeout', () => {
    vi.useFakeTimers()
    const handler = vi.fn()
    render(
      <ToastProvider>
        <Harness onToast={handler} />
      </ToastProvider>,
    )
    const toast = handler.mock.calls[0][0]
    act(() => toast.toast('auto', { kind: 'info' }))
    expect(document.querySelector('[data-testid="toast-info"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(4000))
    expect(document.querySelector('[data-testid="toast-info"]')).toBeNull()
    vi.useRealTimers()
  })

  test('errors persist with close button and action', () => {
    const handler = vi.fn()
    const action = vi.fn()
    render(
      <ToastProvider>
        <Harness onToast={handler} />
      </ToastProvider>,
    )
    const toast = handler.mock.calls[0][0]
    act(() => toast.toast('broken', { kind: 'error', actions: [{ label: 'Retry', onClick: action }] }))
    const err = document.querySelector('[data-testid="toast-error"]')
    expect(err).toBeTruthy()
    expect(err?.textContent).toContain('Retry')
    fireEvent.click((err as HTMLElement).querySelectorAll('button')[0])
    expect(action).toHaveBeenCalled()
  })

  test('max 3 stacked', () => {
    const handler = vi.fn()
    render(
      <ToastProvider>
        <Harness onToast={handler} />
      </ToastProvider>,
    )
    const toast = handler.mock.calls[0][0]
    act(() => toast.toast('1'))
    act(() => toast.toast('2'))
    act(() => toast.toast('3'))
    act(() => toast.toast('4'))
    // Only individual toast entries are counted; the viewport wrapper is excluded.
    expect(document.querySelectorAll('[data-testid="toast-info"], [data-testid="toast-success"], [data-testid="toast-warning"], [data-testid="toast-error"]').length).toBe(3)
  })
})