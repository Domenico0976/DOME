# DOME Generative Tools — Complete Refactor (18 Bugs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 18 bugs in DOME generative tools, adding proper color management, shape tools, canvas reactivity, and ensuring every tool renders correctly, is customizable, and audio-reactive — matching https://tools.sketchdesign.club/#tools quality.

**Architecture:** Phase-based refactor — critical infrastructure first (canvas reactivity, opacity/blend, color system), then individual tool reworks, then testing and documentation.

**Tech Stack:** WebGL2, GLSL 300es, TypeScript, React, Zustand, Paper Shaders (https://shaders.paper.design/)

## Global Constraints

- GLSL version: `#version 300 es` with `precision highp float;`
- Canvas compositing: `ctx.drawImage(gl.canvas, 0, 0)` in stackEngine.ts
- Audio reactivity via `u_audioLevel` uniform; `audio.level` from tool render functions
- PowerShell on Windows: use `;` not `&&`
- Branch: `Tools-Dome` (72+ commits ahead)
- Reference: https://tools.sketchdesign.club/#tools
- Shader references: https://shaders.paper.design/, https://shaders.com/presets
- Shape references: https://www.bookofshapes.com/, https://www.shapes.gallery/
- Browser testing: camofox
- Build must pass, tests must pass (currently 123/124)

---

## File Structure Map

### Modified Files (Critical Infrastructure)
| File | Changes |
|------|---------|
| `tools-app/src/ui/Canvas.tsx` | Fix RAF loop dependencies, add `stack` to deps |
| `tools-app/src/core/stackEngine.ts` | Apply opacity/blend AFTER drawImage for WebGL tools |
| `tools-app/src/engine/toolRenderer.ts` | Add `renderToCanvasWithOpacity` method |
| `tools-app/src/ui/NodeOptions.tsx` | Add expandable color panel section |

### Modified Files (Tool Fixes)
| File | Changes |
|------|---------|
| `tools-app/src/tools/generative/brutalist.ts` | Complete redesign: grid, shapes, SVG loading |
| `tools-app/src/tools/generative/doodle.ts` | Interactive drawing tool (draw, shapes, eraser, move) |
| `tools-app/src/tools/generative/ferrofluid.ts` | Fix attractor seeding consistency |
| `tools-app/src/tools/generative/flowfield.ts` | Redesign as liquid simulator |
| `tools-app/src/tools/generative/kaleidoscope.ts` | Proper kaleidoscopic effect |
| `tools-app/src/tools/generative/liquidmetal.ts` | SVG → metallic chrome transform |
| `tools-app/src/tools/generative/molecules.ts` | Knowledge map with connections |
| `tools-app/src/tools/generative/particles.ts` | Fix controls, add modes, opacity, colors |
| `tools-app/src/tools/generative/plasma.ts` | Add roughness + color picker |
| `tools-app/src/tools/generative/rings.ts` | Fix thickness=0 behavior |
| `tools-app/src/tools/generative/shaders.ts` | Fix settings, add motion presets |
| `tools-app/src/tools/generative/starfield.ts` | Remove blue bg, add color controls |
| `tools-app/src/tools/generative/tunnel.ts` | Shape variants, remove seam |

### Deleted Files
| File | Reason |
|------|--------|
| `tools-app/src/tools/generative/particles2.ts` | Bug #10: Remove entirely |

### Shader Files (Upgrades)
| File | Changes |
|------|---------|
| `tools-app/src/engine/shaders/brutalist.ts` | Grid shader with per-cell animation |
| `tools-app/src/engine/shaders/tunnel.ts` | Shape variants (circle, triangle, square, hexagon, ellipse, rectangle) |
| `tools-app/src/engine/shaders/molecules.ts` | Knowledge map connections |
| `tools-app/src/engine/shaders/plasma.ts` | Roughness + color picker uniforms |
| `tools-app/src/engine/shaders/rings.ts` | Fix thickness=0 |
| `tools-app/src/engine/shaders/shaders.ts` | Motion presets (turbulence, wind, etc.) |
| `tools-app/src/engine/shaders/starfield.ts` | Remove blue bg, add color controls |
| `tools-app/src/engine/shaders/particles.ts` | Original controls (Modes, Handles, Opacity, Colors) |

---

## TODOs

### Phase 1: Critical Infrastructure

- [ ] **Task 1: Fix Canvas RAF loop reactivity (Bug #0)**
  - Root cause: useEffect deps `[aspect, quality, stackLen, effectCount]` don't include `stack` itself
  - Fix: Add `stack` to deps OR use a ref-based approach that doesn't require effect restart
  - Verify: parameter changes update canvas within 1 frame
  - Files: `tools-app/src/ui/Canvas.tsx`

- [ ] **Task 2: Fix opacity/blend mode for WebGL tools (Bug #17)**
  - Root cause: `ctx.globalAlpha` and `ctx.globalCompositeOperation` are set BEFORE `tool.render()`, but WebGL tools bypass the 2D context entirely
  - Fix option A: Apply opacity/blend AFTER `ctx.drawImage(gl.canvas, 0, 0)` in stackEngine.ts
  - Fix option B: Pass opacity/uniform to WebGL shaders and composite in-GL
  - Recommended: Option A (simpler, works for all tools)
  - Files: `tools-app/src/core/stackEngine.ts`

- [ ] **Task 3: Fix "Unknown Tool" for particles (Bug #1)**
  - Root cause: `resolveTool` returns undefined when version doesn't match
  - Check: particles tool registration in registry.ts
  - Check: default template initialization in projectStore.ts
  - Files: `tools-app/src/core/registry.ts`, `tools-app/src/state/projectStore.ts`

### Phase 2: Color System

- [ ] **Task 4: Implement expandable color panel (Bug #16)**
  - Add color panel section to NodeOptions.tsx
  - Each tool has expandable "Colors" section
  - Base colors (min 1, max 4) with add/remove buttons
  - Store in `item.params.colors` as string array
  - Files: `tools-app/src/ui/NodeOptions.tsx`, `tools-app/src/core/types.ts`

- [ ] **Task 5: Add color pickers to all tools**
  - Add `color` control (kind: 'color') to all 11 tools lacking them
  - Wire to shader uniforms as `vec3` or `vec4`
  - Files: All tool files + shader files

### Phase 3: Tool Redesigns (High Priority)

- [ ] **Task 6: Redesign Brutalist (Bug #2)**
  - Grid layout (N×N cells) with independent animated content per cell
  - Support SVG/image upload per cell
  - Per-cell controls: rotation, translation, scale, animation phase
  - Global controls: grid size, noise, speed
  - Audio reactivity: per-cell or global
  - Files: `tools-app/src/tools/generative/brutalist.ts`, `tools-app/src/engine/shaders/brutalist.ts`

- [ ] **Task 7: Redesign Doodle as Interactive Drawing Tool (Bug #3)**
  - Mouse drawing mode: click-drag to draw quadratic bezier strokes
  - Shape tools: circle, rectangle, line, star (click to place)
  - Eraser tool: click-drag to erase strokes
  - Move tool: click-drag to move selected stroke
  - Color picker for stroke color
  - Stroke width, jitter controls
  - Files: `tools-app/src/tools/generative/doodle.ts`

- [ ] **Task 8: Fix Ferrofluid Attractors (Bug #4)**
  - Attractors should seed at RANDOM positions (not fixed grid)
  - Speed should affect RD iteration count smoothly
  - Ensure consistent visual variation across parameter ranges
  - Fix R1: decouple structural params from cache signature
  - Files: `tools-app/src/tools/generative/ferrofluid.ts`

- [ ] **Task 9: Redesign Flowfield as Liquid Simulator (Bug #5)**
  - Reduce particle count (64-128 max)
  - Increase flow coherence (higher curl noise scale)
  - Subtle color palette (not rainbow)
  - Viscosity control
  - Audio reactivity: affect flow speed, not color
  - Files: `tools-app/src/tools/generative/flowfield.ts`, `tools-app/src/engine/shaders/flowfield.ts`

- [ ] **Task 10: Redesign Kaleidoscope (Bug #6)**
  - Proper kaleidoscopic symmetry using source canvas reflection
  - Controls: wedges (2-12), hue rotation, mirror mode, symmetry type
  - Support source image upload
  - Audio reactivity: modulate speed and hue
  - Reference: attached images showing stained-glass patterns
  - Files: `tools-app/src/tools/generative/kaleidoscope.ts`

- [ ] **Task 11: Redesign Liquid Metal (Bug #7)**
  - Accept SVG/image upload as source
  - Apply SDF raymarching with metallic chrome material
  - Controls: stroke width, zoom, rotation, morph, roughness, speed
  - Audio reactivity: morph speed, blob movement
  - Files: `tools-app/src/tools/generative/liquidmetal.ts`, `tools-app/src/engine/shaders/liquidmetal.ts`

- [ ] **Task 12: Redesign Molecules as Knowledge Map (Bug #8)**
  - Nodes as glowing dots with proximity-based connection lines
  - Lines fade based on distance threshold
  - Nodes drift with noise flow
  - Audio reactivity: node speed, connection glow
  - Color picker for nodes and lines
  - Files: `tools-app/src/tools/generative/molecules.ts`, `tools-app/src/engine/shaders/molecules.ts`

- [ ] **Task 13: Fix Particles (Bug #9)**
  - Restore original controls: Modes dropdown (Chladni/Sphere/Cube/Flow Waves)
  - Per-mode controls: Handle X/Y, Opacity(%), Particle Color, Background Color
  - Fix cache: only reseed on mode change, not tuning param changes
  - Add color picker
  - Files: `tools-app/src/tools/generative/particles.ts`, `tools-app/src/engine/shaders/particles.ts`

- [ ] **Task 14: Remove Particles 2 (Bug #10)**
  - Delete `particles2.ts`
  - Remove from registry
  - Files: delete `tools-app/src/tools/generative/particles2.ts`

### Phase 4: Tool Fixes (Medium Priority)

- [ ] **Task 15: Fix Plasma (Bug #11)**
  - Add roughness control (affects FBM octaves / edge softness)
  - Replace hueShift with proper color picker (base color + accent)
  - Files: `tools-app/src/tools/generative/plasma.ts`, `tools-app/src/engine/shaders/plasma.ts`

- [ ] **Task 16: Fix Rings thickness=0 (Bug #12)**
  - When thick=0, output fully transparent (discard fragment)
  - Fix shader smoothstep to handle zero thickness edge case
  - Files: `tools-app/src/tools/generative/rings.ts`, `tools-app/src/engine/shaders/rings.ts`

- [ ] **Task 17: Fix Shaders settings (Bug #13)**
  - Debug why settings don't work (likely uniform name mismatch)
  - Add motion presets: turbulence, wind, pulse, spiral, breathe
  - Add color picker
  - Files: `tools-app/src/tools/generative/shaders.ts`, `tools-app/src/engine/shaders/shaders.ts`

- [ ] **Task 18: Fix Starfield (Bug #14)**
  - Remove forced blue background (`vec3(0.02, 0.03, 0.08)` → `vec3(0.0)` or transparent)
  - Add color picker for star color
  - Add nebula glow color option
  - Files: `tools-app/src/tools/generative/starfield.ts`, `tools-app/src/engine/shaders/starfield.ts`

- [ ] **Task 19: Redesign Tunnel (Bug #15)**
  - Remove visible seam (fix polar coordinate discontinuity)
  - Add shape variants: circle, triangle, square, hexagon, ellipse, rectangle
  - Horizon movement control (vertical offset)
  - Add color picker
  - Files: `tools-app/src/tools/generative/tunnel.ts`, `tools-app/src/engine/shaders/tunnel.ts`

### Phase 5: Testing & Documentation

- [ ] **Task 20: Browser testing with camofox**
  - Launch camofox, open http://localhost:5173
  - Test all 13 tools against https://tools.sketchdesign.club/#tools
  - Verify: parameter changes update canvas, color pickers work, opacity/blend works, audio reactivity works
  - Capture comparison screenshots
  - Files: none (testing only)

- [ ] **Task 21: Update dome-creative-tools/final/*.md**
  - Create `rules.md`: project rules, conventions, do's/don'ts
  - Create `evaluation.md`: evaluation criteria, success metrics
  - Update any existing .md files with current state
  - Files: `dome-creative-tools/final/rules.md`, `dome-creative-tools/final/evaluation.md`

---

## Inherited Wisdom (from prior analysis)

### Canvas Reactivity Architecture
- The RAF loop in `Canvas.tsx` runs continuously and reads `useProjectStore.getState()` each frame
- Effect dependencies `[aspect, quality, stackLen, effectCount]` control when the RAF loop RESTARTS
- Parameter changes DON'T change `stackLen` or `effectCount`, so the loop keeps running
- **Hypothesis**: The bug might be that the RAF loop isn't starting at all for new tools, OR the FBO dimensions are stale
- **Fix**: Add `stack` to deps (but this causes constant restarts) OR use a separate param-change signal

### Opacity/Blend Root Cause (CRITICAL)
- `stackEngine.ts` sets `ctx.globalAlpha` and `ctx.globalCompositeOperation` BEFORE calling `tool.render()`
- WebGL tools render to FBOs and then `ctx.drawImage(gl.canvas, 0, 0)` copies result
- The `drawImage` call happens AFTER `ctx.restore()`, so opacity/blend settings are reset
- **Fix**: Apply opacity/blend as post-process AFTER `drawImage`, or pass as WebGL uniforms

### Color System Gap
- Only 2 of 14 tools have color pickers (doodle, ferrofluid)
- 12 tools only have hueShift sliders
- **Fix**: Add `color` control type to all tools, wire to shader `vec3` uniforms

### Cache Reseed Bug (R1)
- Many tools use uid-based caches where structural param changes trigger full recreation
- **Fix**: Separate "structural" params from "tuning" params in cache signatures

---

## Execution Order

```
Phase 1 (Sequential):  Task 1 → Task 2 → Task 3
Phase 2 (Sequential):  Task 4 → Task 5
Phase 3 (Parallel):    Tasks 6, 7, 8, 9, 10, 11, 12, 13, 14
Phase 4 (Parallel):    Tasks 15, 16, 17, 18, 19
Phase 5 (Sequential):  Task 20 → Task 21
```

**Total estimated tasks: 21**
**Parallel batches: 2 (Phase 3: 9 tools, Phase 4: 5 tools)**
