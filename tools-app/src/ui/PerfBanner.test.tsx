// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { PerfBanner } from '../ui/PerfBanner'
import '../tools'

beforeEach(() => {
  useProjectStore.getState().reset()
  useProjectStore.setState({ perf: { level: 'ok', reason: null } })
})
afterEach(cleanup)

describe('PerfBanner', () => {
  test('renders degraded banner with reason and actions', () => {
    useProjectStore.setState({ perf: { level: 'degraded', reason: 'Frame time 30ms over budget' } })
    const setQuality = vi.spyOn(useProjectStore.getState(), 'setQuality')
    const setPerf = vi.spyOn(useProjectStore.getState(), 'setPerf')
    const { getByText, getByTestId } = render(<PerfBanner />)
    expect(getByTestId('perf-banner')).toBeTruthy()
    expect(getByText('Lower resolution')).toBeTruthy()
    expect(getByText('Dismiss for session')).toBeTruthy()
    fireEvent.click(getByText('Lower resolution'))
    expect(setQuality).toHaveBeenCalled()
    fireEvent.click(getByText('Dismiss for session'))
    expect(setPerf).toHaveBeenCalledWith({ level: 'ok', reason: null })
  })

  test('does not render when ok', () => {
    useProjectStore.setState({ perf: { level: 'ok', reason: null } })
    const { queryByTestId } = render(<PerfBanner />)
    expect(queryByTestId('perf-banner')).toBeNull()
  })
})