// @vitest-environment node
// Regression lock for the mobile scroll flicker in hero + text-entry.
// Three independent fixes, each once regressed silently:
//   1. content-visibility on the hero section lets the browser skip painting
//      the WebGL layer mid-scroll (commit 8a97328) — the section blanks.
//   2. A wide subscribeInView margin (240px) toggles pause/resume rapidly
//      during normal scroll velocity, restarting the GL loop mid-frame.
//   3. Context loss under mobile GPU pressure (10+ live contexts, this section
//      mounts early so it is reclaimed first) left the section blank with no
//      fallback — onLost must surface readable text, onRestored must rebuild.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8')

const hero = () => read('src/webgl-water/shader-hero.jsx')
const viewport = () => read('src/gl/viewport.js')
const engine = () => read('src/hero-glass/engine.js')
const entry = () => read('src/components/TextEntryGlass.jsx')
const css = () => read('src/styles/global.css')

describe('scroll-flicker regression lock', () => {
  it('hero section never opts into paint-skipping', () => {
    expect(hero()).not.toMatch(/contentVisibility/)
    expect(hero()).not.toMatch(/containIntrinsicHeight/)
  })

  it('shared in-view margin stays narrow', () => {
    const src = viewport()
    expect(src).toMatch(/const MARGIN = '80px 0px'/)
    expect(src).toMatch(/r\.bottom > -80 && r\.top < vh \+ 80/)
    expect(src).not.toMatch(/const MARGIN = '240px 0px'/)
  })

  it('engine ignores sub-100ms pause toggles', () => {
    expect(engine()).toMatch(/lastPauseToggle/)
    expect(engine()).toMatch(/<\s*100/)
  })

  it('text-entry degrades to readable text on context loss, rebuilds on restore', () => {
    expect(entry()).toMatch(/onLost/)
    expect(entry()).toMatch(/text-entry--no-gl/)
    expect(entry()).toMatch(/onRestored/)
    expect(css()).toMatch(/\.text-entry--no-gl\s+\.text-entry__sr/)
    expect(css()).toMatch(/\.text-entry--no-gl\s+\.text-entry__canvas/)
  })
})
