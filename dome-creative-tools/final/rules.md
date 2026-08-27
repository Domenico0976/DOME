# DOME Creative Tools — Project Rules

## Architecture Rules

### Shader Development
- GLSL version: `#version 300 es` with `precision highp float;`
- All shaders must include `uniform vec2 u_res;` for aspect ratio correction
- Audio reactivity via `u_audioLevel` uniform (float 0-1)
- Use Paper Shaders patterns: FBM noise, curl noise, domain warping, SDF primitives
- Export shader as named constant: `export const TOOLNAME_FRAG = \`...\``

### Tool Development
- Each tool exports a `ToolDef` object with: id, kind, version, label, icon, category, defaultParams, controls, render
- WebGL2 tools use `ToolRenderer` class with FBO ping-pong
- Canvas2D tools use standard `CanvasRenderingContext2D`
- Module-level renderer singleton pattern: `let renderer: ToolRenderer | null = null`
- FBOs keyed by tool name: `r.getFBO('toolname')` / `r.createFBO('toolname', w, h)`
- Color controls use `kind: 'color'` with hex string values
- Opacity/blend mode handled by `stackEngine.ts` — WebGL tools get post-process application

### Canvas Rendering Pipeline
1. RAF loop reads fresh Zustand state each frame via `useProjectStore.getState()`
2. `evaluateStack()` iterates stack items in reverse order
3. For WebGL tools: render to FBO → `ctx.drawImage(gl.canvas, 0, 0)` → apply opacity/blend
4. For Canvas2D tools: apply opacity/blend → render directly
5. Compositor handles GPU effects (glow, aberration, etc.)

### State Management
- All tool state lives in Zustand `ProjectStore`
- Parameters stored in `StackItem.params: Record<string, number | string | string[]>`
- Color arrays stored as `item.params.colors: string[]`
- Opacity/blend: `item.opacity` (0-1), `item.blendMode` (string)

## Code Conventions

### TypeScript
- Strict mode enabled, no `as any` or `@ts-ignore`
- Prefer explicit types over inference for public APIs
- Use `number | string | string[]` for param values

### Git Commits
- Format: `feat(dome):` for features, `fix(dome):` for bugs
- Concise subject line, detailed body if needed
- Commit per logical unit (not per file)

### Testing
- Vitest + React Testing Library
- Test file naming: `{tool}.test.ts` or `{component}.test.tsx`
- Cover: default render, parameter changes, edge cases
- Target: 124/124 tests passing

## Do's and Don'ts

### DO
- Read existing tool patterns before creating new ones
- Test on both WebGL and Canvas2D paths
- Handle missing WebGL context gracefully (`if (!gl) return`)
- Use `u_res` for aspect ratio correction in shaders
- Keep FBO cleanup in renderer.destroy()
- Add color controls to all generative tools
- Apply opacity/blend after drawImage for WebGL tools

### DON'T
- Don't use `requestAnimationFrame` outside of useEffect cleanup
- Don't allocate ImageData per frame in CPU paths
- Don't reseed simulations on tuning parameter changes (only structural changes)
- Don't hardcode canvas dimensions — use `ctx.canvas.width/height`
- Don't add console.log in production code
- Don't modify stackEngine opacity logic without testing Canvas2D tools

## Visual Quality Standards

### Shader Quality (Paper Shaders Level)
- Use FBM (Fractal Brownian Motion) for organic noise
- Domain warping for fluid/morphing effects
- Smooth animations with sin/cos time functions
- Audio reactivity should be subtle (multiply by 0.2-0.5, not 1.0+)
- Color palettes: use HSV conversion, avoid hardcoded RGB where possible

### UI Quality
- Dark theme consistent with existing design
- Controls: sliders with min/max/step, color pickers for colors
- Expandable panels for secondary controls (Colors, Audio, etc.)
- Value display: show current value next to slider
- Responsive panel layout with ScrollArea

## Evaluation Criteria

### Functionality (40%)
- All parameters affect visual output correctly
- No "Unknown Tool" or crash on any tool
- Audio reactivity works (level, bass, treble, mid)
- Opacity and blend mode work correctly

### Visual Quality (30%)
- Matches or exceeds sketchdesign.club reference quality
- Smooth animation (60fps target)
- Color choices are aesthetically pleasing
- No visible seams, artifacts, or clipping

### Customization (20%)
- Every tool has color picker(s)
- Expandable color panel (min 1, max 4 colors)
- Meaningful control range (not trivial min/max)
- Audio binding available for all params

### Performance (10%)
- Build passes without errors
- No memory leaks (FBO cleanup, RAF cleanup)
- ≤500KB bundle increase per tool
- 60fps on mid-range GPU
