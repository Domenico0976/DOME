export function strHash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

// Traces the outline of a circle, square or equilateral triangle centered at (cx, cy).
// Callers begin their own path styling and stroke/fill afterwards.
export function drawShapePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  shape: 'circle' | 'square' | 'triangle',
): void {
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  } else if (shape === 'square') {
    ctx.rect(cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r * 0.866, cy + r * 0.5)
    ctx.lineTo(cx - r * 0.866, cy + r * 0.5)
    ctx.closePath()
  }
}
