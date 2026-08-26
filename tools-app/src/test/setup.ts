if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

if (!('ImageData' in globalThis)) {
  class ImageDataPoly {
    readonly width: number
    readonly height: number
    readonly data: Uint8ClampedArray
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(Math.max(0, width | 0) * Math.max(0, height | 0) * 4)
    }
  }
  (globalThis as { ImageData?: unknown }).ImageData = ImageDataPoly
}
