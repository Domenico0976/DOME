// tools-app/src/engine/toolRenderer.ts

export interface FBOPair {
  texA: WebGLTexture
  texB: WebGLTexture
  fboA: WebGLFramebuffer
  fboB: WebGLFramebuffer
}

export class ToolRenderer {
  private gl: WebGL2RenderingContext
  private programs: Map<string, WebGLProgram> = new Map()
  private fbos: Map<string, FBOPair> = new Map()
  private quadVAO: WebGLVertexArrayObject | null = null

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.initQuad()
  }

  private initQuad(): void {
    const gl = this.gl
    this.quadVAO = gl.createVertexArray()
    gl.bindVertexArray(this.quadVAO)

    const vertices = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ])

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)
  }

  private hasFloatRenderSupport(): boolean {
    return !!this.gl.getExtension('EXT_color_buffer_float')
  }

  compileProgram(name: string, fragSource: string): WebGLProgram | null {
    const gl = this.gl

    if (this.programs.has(name)) {
      return this.programs.get(name)!
    }

    const vertSource = `#version 300 es
      layout(location = 0) in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `

    const vert = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vert, vertSource)
    gl.compileShader(vert)
    if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vert))
      gl.deleteShader(vert)
      return null
    }

    const frag = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(frag, fragSource)
    gl.compileShader(frag)
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(frag))
      gl.deleteShader(vert)
      gl.deleteShader(frag)
      return null
    }

    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      gl.deleteShader(vert)
      gl.deleteShader(frag)
      gl.deleteProgram(program)
      return null
    }

    // Release shaders after successful link to free GPU memory
    gl.detachShader(program, vert)
    gl.detachShader(program, frag)
    gl.deleteShader(vert)
    gl.deleteShader(frag)

    this.programs.set(name, program)
    return program
  }

  createFBO(name: string, width: number, height: number, float: boolean = false): FBOPair {
    const gl = this.gl
    let format: number
    let type: number

    if (float) {
      if (this.hasFloatRenderSupport()) {
        format = gl.RGBA16F
        type = gl.FLOAT
      } else {
        format = gl.RGBA8
        type = gl.UNSIGNED_BYTE
      }
    } else {
      format = gl.RGBA8
      type = gl.UNSIGNED_BYTE
    }

    const createTex = (): WebGLTexture => {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, type, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return tex
    }

    const createFBO = (tex: WebGLTexture): WebGLFramebuffer => {
      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error(`FBO incomplete for ${name}: status=${status}`)
      }
      return fbo
    }

    const texA = createTex()
    const texB = createTex()
    const fboA = createFBO(texA)
    const fboB = createFBO(texB)

    const pair: FBOPair = { texA, texB, fboA, fboB }
    this.fbos.set(name, pair)
    return pair
  }

  getFBO(name: string): FBOPair | undefined {
    return this.fbos.get(name)
  }

  renderToTexture(
    program: WebGLProgram,
    inputTex: WebGLTexture,
    outputFBO: WebGLFramebuffer,
    width: number,
    height: number,
    uniforms: Record<string, number | number[] | WebGLTexture> = {}
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO)
    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)

    // Bind input texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inputTex)
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0)

    // Set uniforms
    let texUnit = 1
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc === null) continue
      if (typeof value === 'number') {
        gl.uniform1f(loc, value)
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value)
        else if (value.length === 3) gl.uniform3fv(loc, value)
        else if (value.length === 4) gl.uniform4fv(loc, value)
      } else if (value instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + texUnit)
        gl.bindTexture(gl.TEXTURE_2D, value)
        gl.uniform1i(loc, texUnit)
        texUnit++
      }
    }

    // Draw quad
    gl.bindVertexArray(this.quadVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  renderToCanvas(
    program: WebGLProgram,
    inputTex: WebGLTexture,
    width: number,
    height: number,
    uniforms: Record<string, number | number[]> = {}
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inputTex)
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0)

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc === null) continue
      if (typeof value === 'number') {
        gl.uniform1f(loc, value)
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value)
        else if (value.length === 3) gl.uniform3fv(loc, value)
        else if (value.length === 4) gl.uniform4fv(loc, value)
      }
    }

    gl.bindVertexArray(this.quadVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  destroy(): void {
    const gl = this.gl
    this.programs.forEach((prog) => gl.deleteProgram(prog))
    this.fbos.forEach((pair) => {
      gl.deleteTexture(pair.texA)
      gl.deleteTexture(pair.texB)
      gl.deleteFramebuffer(pair.fboA)
      gl.deleteFramebuffer(pair.fboB)
    })
    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO)
  }
}
