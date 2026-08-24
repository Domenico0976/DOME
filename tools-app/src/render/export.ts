export class EmptyRenderError extends Error {
  constructor() {
    super('Nothing rendered yet — connect a source block first')
    this.name = 'EmptyRenderError'
  }
}

export function stamp(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function exportCanvasAsPng(canvas: HTMLCanvasElement): Promise<string> {
  if (canvas.width === 0 || canvas.height === 0) throw new EmptyRenderError()

  const context = canvas.getContext('2d')
  if (context !== null) {
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let uniform = true
    for (let i = 4; i < data.length; i += 4) {
      if (
        data[i] !== data[0] ||
        data[i + 1] !== data[1] ||
        data[i + 2] !== data[2] ||
        data[i + 3] !== data[3]
      ) {
        uniform = false
        break
      }
    }
    if (uniform) throw new EmptyRenderError()
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob === null || blob.size === 0) throw new EmptyRenderError()

  const filename = `dome-art-${stamp()}.png`
  downloadBlob(blob, filename)
  return filename
}
