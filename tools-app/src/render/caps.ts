export interface SurfaceCaps {
  readonly maxWidth: number
  readonly dprCap: number
  readonly maxFps: number
}

export function resolveCaps(isCoarsePointer: boolean): SurfaceCaps {
  return isCoarsePointer
    ? { maxWidth: 1280, dprCap: 1, maxFps: 30 }
    : { maxWidth: 1920, dprCap: 2, maxFps: 60 }
}
