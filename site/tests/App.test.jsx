// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import App from '../src/App.jsx'

function component(name) {
  return function MockComponent() {
    return React.createElement('div', { 'data-testid': name })
  }
}

vi.mock('lenis', () => ({
  default: class Lenis {
    on = vi.fn()
    destroy = vi.fn()
    raf = vi.fn((time) => time)
  },
}))

vi.mock('gsap', () => ({
  default: { registerPlugin: vi.fn() },
}))

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    update: vi.fn(),
    refresh: vi.fn(),
  },
}))

vi.mock('../src/components/Header.jsx', () => ({ default: component('header') }))
vi.mock('../src/components/SplitScreenHero.jsx', () => ({ default: component('split-screen-hero') }))
vi.mock('../src/components/TextEntryGlass.jsx', () => ({ default: component('text-entry-glass') }))
vi.mock('../src/components/FeaturedGallery.jsx', () => ({ default: component('featured-gallery') }))
vi.mock('../src/components/SelectedProjects.jsx', () => ({ default: component('selected-projects') }))
vi.mock('../src/components/Archives.jsx', () => ({ default: component('archives') }))
vi.mock('../src/components/Footer.jsx', () => ({ default: component('footer') }))
vi.mock('../src/components/CursorGlow.jsx', () => ({ default: () => null }))
vi.mock('../src/components/MobileCanvas.jsx', () => ({ default: () => null }))
vi.mock('../src/hooks/useArchiveCursor', () => ({
  ArchiveCursorProvider: ({ children }) => children,
}))
vi.mock('../src/hooks/useIsMobile', () => ({ useIsMobile: () => false }))

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  window.__preloader = { appReady: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App section order', () => {
  it('renders SplitScreenHero, TextEntryGlass, and FeaturedGallery in approved order', async () => {
    render(<App />)
    // The hero is lazy, so even the mocked module resolves on a later tick. The
    // assertion that matters is the order, and Suspense renders no DOM of its own,
    // so once the hero has arrived the children of <main> are final.
    const hero = await screen.findByTestId('split-screen-hero')
    const main = hero.parentElement

    expect(main.tagName).toBe('MAIN')
    expect(Array.from(main.children).map((node) => node.dataset.testid)).toEqual([
      'split-screen-hero',
      'text-entry-glass',
      'featured-gallery',
      'selected-projects',
      'archives',
    ])
  })
})
