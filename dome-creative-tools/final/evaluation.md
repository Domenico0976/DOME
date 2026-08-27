# DOME Creative Tools — Evaluation Criteria

## Scoring Rubric

Each tool is evaluated on a 1-10 scale across 4 dimensions. Target: ≥7 average.

### 1. Reactivity (25%)
| Score | Criteria |
|-------|----------|
| 10 | Parameters update canvas within 1 frame. Zero latency. Smooth transitions. |
| 7 | Parameters update within 2-3 frames. Minor stutter on structural changes. |
| 4 | Parameters update but with visible delay or frame drops. |
| 1 | Canvas doesn't update when parameters change. Stuck/frozen. |

**Checklist:**
- [ ] Slider changes reflect on canvas immediately
- [ ] Color picker changes update rendering
- [ ] No "dirty canvas" artifacts between frames
- [ ] RAF loop runs at 60fps during interaction

### 2. Visual Fidelity (25%)
| Score | Criteria |
|-------|----------|
| 10 | Matches or exceeds sketchdesign.club reference. Polished, professional. |
| 7 | Good visual quality. Some minor issues (seams, color banding). |
| 4 | Functional but ugly. Visible artifacts, poor colors. |
| 1 | Broken rendering. Black screen, glitches, crashes. |

**Checklist:**
- [ ] No visible seams or boundaries (tunnel, kaleidoscope)
- [ ] Colors are pleasing and varied (not single-color fill)
- [ ] Animation is smooth and purposeful
- [ ] Audio reactivity produces visible variation
- [ ] Shape variants render correctly (tunnel shapes)

### 3. Customization (25%)
| Score | Criteria |
|-------|----------|
| 10 | Full color control, expandable panels, audio bindings, opacity, blend modes. |
| 7 | Color picker present. Some controls missing (opacity, blend). |
| 4 | Limited customization. Only hue shift, no color picker. |
| 1 | No customization. Hardcoded colors, no controls. |

**Checklist:**
- [ ] Every tool has at least 1 color picker
- [ ] Expandable Colors panel present (min 1, max 4 colors)
- [ ] Opacity slider works
- [ ] Blend mode selector works
- [ ] Audio binding buttons present for all controls
- [ ] No "Unknown Tool" text on startup

### 4. Performance (25%)
| Score | Criteria |
|-------|----------|
| 10 | 60fps on integrated GPU. Zero memory leaks. Fast load. |
| 7 | 50-60fps on integrated GPU. Minor GC pressure. |
| 4 | 30-50fps. Visible frame drops on complex scenes. |
| 1 | <30fps. Crashes or freezes. Memory leaks. |

**Checklist:**
- [ ] Build passes (`npm run build` exits 0)
- [ ] Tests pass (124/124)
- [ ] No TypeScript errors
- [ ] No console errors during normal use
- [ ] FBOs cleaned up on tool removal
- [ ] RAF loop cancelled on unmount

## Tool-by-Tool Targets

| Tool | Reactivity | Fidelity | Customization | Performance | Notes |
|------|-----------|----------|--------------|-------------|-------|
| Brutalist | ≥8 | ≥8 | ≥8 | ≥7 | Grid animation, shape variety |
| Doodle | ≥9 | ≥7 | ≥9 | ≥8 | Interactive drawing, low FPS impact |
| Ferrofluid | ≥7 | ≥9 | ≥8 | ≥6 | GPU 4-pass pipeline, RD simulation |
| Flowfield | ≥8 | ≥8 | ≥8 | ≥7 | Liquid simulator, curl noise |
| Kaleidoscope | ≥8 | ≥9 | ≥7 | ≥8 | Canvas2D, reflection-based |
| Liquid Metal | ≥7 | ≥9 | ≥8 | ≥6 | SDF raymarching, metallic material |
| Molecules | ≥8 | ≥8 | ≥8 | ≥7 | Knowledge map, proximity lines |
| Particles | ≥8 | ≥8 | ≥9 | ≥7 | Mode system, Chladni figures |
| Plasma | ≥8 | ≥8 | ≥8 | ≥8 | FBM plasma, roughness control |
| Rings | ≥8 | ≥7 | ≥7 | ≥9 | Simple shader, high FPS |
| Shaders | ≥8 | ≥9 | ≥8 | ≥7 | Motion presets, domain warping |
| Starfield | ≥8 | ≥7 | ≥8 | ≥9 | Simple shader, high FPS |
| Tunnel | ≥8 | ≥9 | ≥8 | ≥7 | Shape variants, seam fix |

## Pass/Fail Thresholds

### Critical Fail (Rebuild Required)
- Canvas doesn't update on parameter change
- "Unknown Tool" text appears
- Build fails or TypeScript errors
- Tests fail (below 120/124)
- Console errors during normal use

### Warning (Review Required)
- Any tool scores <5 on any dimension
- Opacity/blend mode broken
- Color picker missing on any tool
- FPS drops below 30

### Pass (Ready for Ship)
- All tools score ≥7 average
- No critical fails
- Build clean, tests green
- Browser testing passes on Chrome/Firefox

## Verification Steps

1. **Build**: `npm run build` → exit 0
2. **Tests**: `npx vitest run` → 124/124 pass
3. **TypeScript**: `npx tsc --noEmit` → 0 errors
4. **Browser**: Open http://localhost:5173/tools/
   - Add each tool from catalog
   - Change all parameters — verify canvas updates
   - Test color pickers — verify color changes
   - Test opacity slider — verify transparency
   - Test blend mode — verify compositing
   - Load audio — verify reactivity
   - Check console — zero errors
5. **Export**: Click "Export PNG" — verify image renders correctly
