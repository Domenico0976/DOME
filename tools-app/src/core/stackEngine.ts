import { resolveTool } from './registry'
import type { AudioFrame, Frame, StackItem } from './types'

export function evaluateStack(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  audio: AudioFrame,
  items: StackItem[],
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (const item of items) {
    if (item.hidden) continue
    const tool = resolveTool(item.toolId, item.toolVersion)
    if (!tool) continue
    ctx.save()
    tool.render(ctx, frame, item, audio, {
      width: ctx.canvas.width,
      height: ctx.canvas.height,
      quality: 'high',
    })
    ctx.restore()
  }
  ctx.restore()
}
