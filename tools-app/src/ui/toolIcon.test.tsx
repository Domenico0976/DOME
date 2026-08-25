// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ToolIcon } from './toolIcon'

describe('ToolIcon', () => {
  test('renders svg for known keys and falls back for unknown keys', () => {
    const { container: a } = render(<ToolIcon name="atom" />)
    expect(a.querySelector('svg')).toBeTruthy()
    const { container: b } = render(<ToolIcon name="no-such-key" />)
    expect(b.querySelector('svg')).toBeTruthy()
  })
})
