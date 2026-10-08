// Console filters for warnings we cannot silence at their source.
//
// 1) typegpu `[external-omitted]` — false positive: WGSL `in.uv` field access
//    is left untouched by the resolver, but the category still fires. The
//    emitting logger is compiled INTO the pre-bundled `shaders` dist files, so
//    `warn.disable()` from the standalone typegpu package cannot reach it —
//    importing typegpu here would only load a second instance and trigger
//    "Found duplicate TypeGPU version". Filtering the message is the only
//    lever; kept active in prod because the category is enabled there too.
// 2) three.js internal PMREM GGX prefilter shader (node_modules/three/src/extras/
//    PMREMGenerator.js:96) constant-folding precision notices surfaced via the
//    ANGLE / D3D shader compiler as warning X4122. Not actionable from project
//    code; only appears while renderer.debug.checkShaderErrors is on (dev).
//    Real shader compile failures (which contain "ERROR:") are left through.
const origWarn = console.warn.bind(console)
console.warn = function (...args) {
  const text = String(args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a) }
    catch { return String(a) }
  }).join(' '))
  if (text.includes('[external-omitted]')) return
  if (text.includes('X4122') && !text.includes('ERROR:')) return
  origWarn.apply(this, args)
}
