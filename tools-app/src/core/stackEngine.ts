import { resolveTool } from './registry'
import { resolveEffectValue } from '../engine/effects'
import type { AudioFrame, Frame, StackItem, StackRenderContext } from './types'

// Resolve every `item.audio` binding on the CPU path so tool params are
// modulated before the tool's render() runs. GPU path already resolves via
// buildUniforms in the compositor; this is the CPU-side equivalent.
// Per-frame copy: never mutate store params (prevents compounding + save corruption).
function resolveItemParams(
  item: StackItem,
  frame: Frame,
  audio: AudioFrame,
  muted?: ReadonlySet<string>,
): Record<string, number | string | string[]> {
  const resolved = { ...(item.params as Record<string, number | string | string[]>) }
  for (const binding of item.audio) {
    if (muted?.has(`${item.uid}-${binding.param}`)) continue
    const base = (item.params as Record<string, number | string | string[]>)[binding.param]
    if (typeof base !== 'number') continue
    resolved[binding.param] = resolveEffectValue(base, [binding], binding.param, frame, audio)
  }
  return resolved
}

export function evaluateStack(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  audio: AudioFrame,
  items: StackItem[],
  options?: { quality?: StackRenderContext['quality']; gl?: WebGL2RenderingContext; muted?: ReadonlySet<string> },
): void {
  const quality = options?.quality ?? 'high'
  const gl = options?.gl
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.hidden) continue
    const tool = resolveTool(item.toolId, item.toolVersion)
    if (!tool) continue
    const renderItem =
      item.audio.length > 0 ? { ...item, params: resolveItemParams(item, frame, audio, options?.muted) } : item
    ctx.save()
    const isWebGL = !!gl
    if (!isWebGL) {
      ctx.globalCompositeOperation = (item.blendMode ?? 'source-over') as GlobalCompositeOperation
      ctx.globalAlpha = item.opacity ?? 1
    }
    tool.render(ctx, frame, renderItem, audio, {
      width: ctx.canvas.width,
      height: ctx.canvas.height,
      quality,
    }, gl)
    if (gl) {
      ctx.globalCompositeOperation = (item.blendMode ?? 'source-over') as GlobalCompositeOperation
      ctx.globalAlpha = item.opacity ?? 1
      ctx.drawImage(gl.canvas, 0, 0)
    }
    ctx.restore()
  }
  ctx.restore()
}
