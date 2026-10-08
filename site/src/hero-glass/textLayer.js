import * as THREE from 'three'
import { textVertexShader, textFragmentShader } from '../shaders/heroGlassText.js'
import { buildTextAtlas, disposeAtlas, measureRowWidth } from './textAtlas.js'
import { layoutRows } from './textLayout.js'
import { TEXT_BEHIND_Z, TEXT_FRONT_Z, TEXT_LAYOUT } from './params.js'

// The whole depth trick lives here. three draws opaque -> transmissive ->
// transparent, and the torus is transmissive, so it only ever refracts what was
// already rasterised. A `behind` row therefore must be an OPAQUE object with an
// alpha discard; if it blended instead it would sort into the transparent pass,
// land after the glass, and sit on top of it — which is the exact opposite of
// what `behind: true` asks for.

function visibleSizeAt(camera, z) {
  const distance = Math.max(camera.position.z - z, 0.001)
  const visibleHeight = 2 * distance * Math.tan((camera.fov * Math.PI / 180) / 2)
  return { visibleHeight, visibleWidth: visibleHeight * camera.aspect }
}

function screenToWorld(camera, px, py, screen, z) {
  const { visibleWidth, visibleHeight } = visibleSizeAt(camera, z)
  return {
    x: (px / screen.width - 0.5) * visibleWidth,
    y: (0.5 - py / screen.height) * visibleHeight,
    visibleWidth,
    visibleHeight,
  }
}

function applySliceUV(geometry, uv) {
  const attr = geometry.attributes.uv
  // PlaneGeometry(1,1) vertex order, verified against three: 0 top-left,
  // 1 top-right, 2 bottom-left, 3 bottom-right. Atlas v0 is the row TOP
  // (flipY is off, so texture v=0 is the canvas top), and the plane's top edge
  // carries uv.y = 1, so each vertex is paired with the matching V or the row
  // renders rotated 180°.
  attr.setXY(0, uv.u0, uv.v0)
  attr.setXY(1, uv.u1, uv.v0)
  attr.setXY(2, uv.u0, uv.v1)
  attr.setXY(3, uv.u1, uv.v1)
  attr.needsUpdate = true
}

export function createTextLayer({
  renderer,
  camera,
  fontFamily,
  fontWeight = 'normal',
  color,
  accentColor = null,
  lineHeight,
}) {
  const group = new THREE.Group()
  group.name = 'hero-glass-text'

  let atlas = null
  let planes = []

  function clearPlanes() {
    for (const plane of planes) {
      group.remove(plane.mesh)
      plane.geometry.dispose()
      plane.material.dispose()
    }
    planes = []
  }

  // `box` is the text content box in CSS px relative to the canvas; `screen` is
  // the canvas CSS size. They are different quantities and both are needed: the
  // fit targets box.width, while world placement normalises against screen.
  function build(rows, { box, screen }) {
    clearPlanes()
    disposeAtlas(atlas)
    atlas = null
    if (!rows.length || !box || !box.width || !screen || !screen.width) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const probe = document.createElement('canvas').getContext('2d')

    const fitted = layoutRows({
      rows,
      measure: (size, row) => measureRowWidth({ ...row, fontSize: size }, {
        fontFamily,
        fontWeight,
        color,
        accentColor,
        ctx: probe,
      }),
      targetWidth: box.width,
      targetHeight: box.height,
      lineHeight,
      pad: TEXT_LAYOUT.pad,
    })
    if (!fitted.length) return
    // `size` is artistic intent (seconda riga più piccola, titolo più grande),
    // non budget: va applicato DOPO il fit, se lo metti nella measure il fit
    // lo compensa e la scala si annulla.
    const measured = fitted.map((row) =>
      row.size && row.size !== 1 ? { ...row, fontSize: row.fontSize * row.size } : row,
    )

    atlas = buildTextAtlas({
      rows: measured,
      fontFamily,
      fontWeight,
      color,
      accentColor,
      lineHeight,
      pad: TEXT_LAYOUT.pad,
      dpr,
    })
    if (!atlas.slices.length) return

    // Rows stack top-down in the atlas; the DOM used to centre the whole stack
    // in the content box, so keep that instead of pinning to the top edge.
    const stackOffset = (box.height - atlas.height) / 2

    for (const slice of atlas.slices) {
      const z = slice.behind ? TEXT_BEHIND_Z : TEXT_FRONT_Z
      const rect = slice.rect
      const screenX = box.x + rect.x
      const screenY = box.y + stackOffset + rect.y
      const world = screenToWorld(
        camera,
        screenX + rect.width / 2,
        screenY + rect.height / 2,
        screen,
        z,
      )

      const geometry = new THREE.PlaneGeometry(1, 1)
      applySliceUV(geometry, slice.uv)

      const material = new THREE.ShaderMaterial({
        vertexShader: textVertexShader,
        fragmentShader: textFragmentShader,
        uniforms: {
          uMap: { value: atlas.texture },
          uAnimMap: { value: atlas.animTexture },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: TEXT_LAYOUT.opacity },
          uAlphaTest: {
            value: slice.behind ? TEXT_LAYOUT.behindAlphaTest : TEXT_LAYOUT.frontAlphaTest,
          },
          uWobble: {
            value: slice.behind ? TEXT_LAYOUT.behindWobble : TEXT_LAYOUT.frontWobble,
          },
          uTime: { value: 0 },
        },
        transparent: !slice.behind,
        depthTest: !slice.behind,
        depthWrite: Boolean(slice.behind),
        toneMapped: false,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(world.x, world.y, z)
      mesh.scale.set(
        (rect.width / screen.width) * world.visibleWidth,
        (rect.height / screen.height) * world.visibleHeight,
        1,
      )
      mesh.renderOrder = slice.behind
        ? TEXT_LAYOUT.behindRenderOrder
        : TEXT_LAYOUT.frontRenderOrder

      group.add(mesh)
      planes.push({ mesh, geometry, material, behind: slice.behind })
    }
  }

  function update(elapsed) {
    for (const plane of planes) {
      plane.material.uniforms.uTime.value = elapsed
    }
  }

  function dispose() {
    clearPlanes()
    disposeAtlas(atlas)
    atlas = null
  }

  return { group, build, update, dispose, get rowCount() { return planes.length } }
}
