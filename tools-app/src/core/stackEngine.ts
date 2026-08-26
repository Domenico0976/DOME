import { resolveTool } from './registry'
import type { AudioFrame, Frame, StackItem, StackRenderContext } from './types'

export function evaluateStack(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  audio: AudioFrame,
  items: StackItem[],
  options?: { quality?: StackRenderContext['quality']; gl?: WebGL2RenderingContext },
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
    ctx.save()
    ctx.globalCompositeOperation = (item.blendMode ?? 'source-over') as GlobalCompositeOperation
    ctx.globalAlpha = item.opacity ?? 1
    tool.render(ctx, frame, item, audio, {
      width: ctx.canvas.width,
      height: ctx.canvas.height,
      quality,
    }, gl)
    ctx.restore()
  }
  ctx.restore()
}
