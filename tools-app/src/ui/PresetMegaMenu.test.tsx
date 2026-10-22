// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { registerTool } from '../core/registry'
import type { ToolDef } from '../core/types'
import { PresetMegaMenu } from './PresetMegaMenu'
import '../tools'

afterEach(cleanup)

const demo: ToolDef = {
  id: 'vertical-demo',
  kind: 'generative',
  version: '1.0.0',
  label: 'Vertical Demo',
  icon: '',
  category: 'Generative',
  defaultParams: {},
  controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
  render: () => {},
}

function setupStack(count = 1) {
  registerTool(demo)
  useProjectStore.getState().reset()
  for (let i = 0; i < count; i++) useProjectStore.getState().addTool('vertical-demo')
  return useProjectStore.getState().stack
}

describe('PresetMegaMenu', () => {
  test('empty stack shows message', () => {
    useProjectStore.getState().reset()
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    expect(document.body.textContent).toContain('Empty scene — add a tool first.')
  })

  test('open pre-hovers first layer, first effect defaults to tool params', () => {
    setupStack(1)
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    expect(document.body.textContent).toContain('Vertical Demo')
    expect(document.body.textContent).toContain('Tool params (no effect)')
    expect(document.body.textContent).toContain('Speed')
  })

  test('hover category row updates col3 without click', () => {
    const stack = setupStack(1)
    const uid = stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    fireEvent.mouseEnter(getByText('light'))
    expect(document.body.textContent).toMatch(/Intensity|Radius|Threshold/)
  })

  test('category grouping: two effects of different categories show 3 col2 entries', () => {
    const stack = setupStack(1)
    const uid = stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    useProjectStore.getState().addEffect(uid, 'grain')
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    expect(getByText('Tool params (no effect)')).toBeTruthy()
    expect(getByText('light')).toBeTruthy()
    expect(getByText('texture')).toBeTruthy()
  })

  test('col3 sub-headers and params after selecting a category', () => {
    const stack = setupStack(1)
    const uid = stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    fireEvent.mouseEnter(getByText('light'))
    expect(document.body.textContent).toMatch(/Glow|Intensity|Radius|Threshold/)
  })

  test('commit calls onPick with composite key and closes', () => {
    const stack = setupStack(1)
    const onPick = vi.fn()
    const onClose = vi.fn()
    render(<PresetMegaMenu onPick={onPick} onClose={onClose} />)
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    fireEvent.mouseEnter(getByText('Tool params (no effect)'))
    fireEvent.click(getByText('Speed'))
    expect(onPick).toHaveBeenCalledWith(stack[0].uid, 'speed')
    expect(onClose).toHaveBeenCalled()
  })

  test('close/reopen restores hover', () => {
    setupStack(1)
    const onHoverChange = vi.fn()
    const { unmount } = render(
      <PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} onHoverChange={onHoverChange} />,
    )
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    unmount()
    expect(onHoverChange).toHaveBeenCalledWith({
      hoveredLayerUid: expect.any(String),
      hoveredEffectUid: expect.any(String),
    })
  })

  test('Escape closes', () => {
    setupStack(1)
    const onClose = vi.fn()
    render(<PresetMegaMenu onPick={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  test('arrow navigation crosses category boundary from params into next category', () => {
    const stack = setupStack(1)
    useProjectStore.getState().addEffect(stack[0].uid, 'glow')
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    const root = document.getElementById('preset-cascade') as HTMLElement
    const down = () => fireEvent.keyDown(root, { key: 'ArrowDown' })
    down()
    expect(root.getAttribute('aria-activedescendant')).toMatch(/^pmrow-layer_/)
    down()
    expect(root.getAttribute('aria-activedescendant')).toBe('pmrow-category___tool__')
    down()
    expect(root.getAttribute('aria-activedescendant')).toBe('pmrow-param_speed')
    down()
    expect(root.getAttribute('aria-activedescendant')).toBe('pmrow-category_light')
    expect(document.getElementById('pmrow-category_light')).toBeTruthy()
    down()
    const after = root.getAttribute('aria-activedescendant')
    expect(after).toMatch(/^pmrow-param_/)
    expect(after).not.toBe('pmrow-param_speed')
  })

  test('menu root is capped at max-h-[60vh]', () => {
    setupStack(1)
    render(<PresetMegaMenu onPick={vi.fn()} onClose={vi.fn()} />)
    const root = document.getElementById('preset-cascade') as HTMLElement
    expect(root.className).toContain('max-h-[60vh]')
    expect(root.className).toContain('overflow-hidden')
  })
})

function getByText(text: string): HTMLElement {
  const el = Array.from(document.querySelectorAll('button, span')).find(
    (n) => n.textContent === text,
  )
  if (!el) throw new Error(`missing text: ${text}`)
  return el as HTMLElement
}