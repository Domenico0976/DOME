/**
 * fluidHover.js — WebGL liquid hover-distortion for expanded .canvas-opgl-view images
 * Ported from the standalone "Webgl-image" project (Ksenia K, based on Pavel Dobryakov's
 * fluid sim). Panel-adapted per team plan (.omo/plans/opgl-fluid/PLAN.md):
 *   - effect ONLY while hovering the expanded image and NOT in zoom mode
 *   - no GUI / no file input / no auto-preview animation
 *   - pointer listeners on viewEl (canvas is pointer-events:none)
 *   - opacity-toggle layering (never display:none), gated by .has-fluid class
 *   - silent fallback to plain <img> whenever WebGL is unavailable
 */
(function () {
  'use strict';

  // ── Shipped params (plan consensus) ────────────────────────────────────
  var PARAMS = {
    cursorSize: 5,        // user-tuned: stronger than plan's 3.5
    cursorPower: 22,      // user-tuned: stronger than plan's 14
    distortionPower: 0.4  // user-tuned: reference-strength swirl
  };

  var DISSIPATION_VELOCITY = 0.97;
  var DISSIPATION_OUTPUT = 0.98;
  var PRESSURE_ITERATIONS = 16;
  var FIXED_DT = 1 / 60;
  var SPLAT_FORCE = 6;

  // ── Shader sources ─────────────────────────────────────────────────────
  var VERT = [
    'precision highp float;',
    '',
    'varying vec2 vUv;',
    'attribute vec2 a_position;',
    '',
    'varying vec2 vL;',
    'varying vec2 vR;',
    'varying vec2 vT;',
    'varying vec2 vB;',
    'uniform vec2 u_texel;',
    '',
    'void main () {',
    '    vUv = .5 * (a_position + 1.);',
    '    vL = vUv - vec2(u_texel.x, 0.);',
    '    vR = vUv + vec2(u_texel.x, 0.);',
    '    vT = vUv + vec2(0., u_texel.y);',
    '    vB = vUv - vec2(0., u_texel.y);',
    '    gl_Position = vec4(a_position, 0., 1.);',
    '}'
  ].join('\n');

  var FRAG_ADVECTION = [
    'precision highp float;',
    'precision highp sampler2D;',
    '',
    'varying vec2 vUv;',
    'uniform sampler2D u_velocity_texture;',
    'uniform sampler2D u_input_texture;',
    'uniform vec2 u_texel;',
    'uniform vec2 u_output_textel;', // (sic) kept from reference — must match JS
    'uniform float u_dt;',
    'uniform float u_dissipation;',
    '',
    'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
    '    vec2 st = uv / tsize - 0.5;',
    '    vec2 iuv = floor(st);',
    '    vec2 fuv = fract(st);',
    '    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
    '    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
    '    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
    '    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
    '    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
    '}',
    '',
    'void main () {',
    '    vec2 coord = vUv - u_dt * bilerp(u_velocity_texture, vUv, u_texel).xy * u_texel;',
    '    vec4 velocity = bilerp(u_input_texture, coord, u_output_textel);',
    '    gl_FragColor = u_dissipation * velocity;',
    '}'
  ].join('\n');

  var FRAG_DIVERGENCE = [
    'precision highp float;',
    'precision highp sampler2D;',
    '',
    'varying highp vec2 vUv;',
    'varying highp vec2 vL;',
    'varying highp vec2 vR;',
    'varying highp vec2 vT;',
    'varying highp vec2 vB;',
    'uniform sampler2D u_velocity_texture;',
    '',
    'void main () {',
    '    float L = texture2D(u_velocity_texture, vL).x;',
    '    float R = texture2D(u_velocity_texture, vR).x;',
    '    float T = texture2D(u_velocity_texture, vT).y;',
    '    float B = texture2D(u_velocity_texture, vB).y;',
    '    float div = .25 * (R - L + T - B);',
    '    gl_FragColor = vec4(div, 0., 0., 1.);',
    '}'
  ].join('\n');

  var FRAG_PRESSURE = [
    'precision highp float;',
    'precision highp sampler2D;',
    '',
    'varying highp vec2 vUv;',
    'varying highp vec2 vL;',
    'varying highp vec2 vR;',
    'varying highp vec2 vT;',
    'varying highp vec2 vB;',
    'uniform sampler2D u_pressure_texture;',
    'uniform sampler2D u_divergence_texture;',
    '',
    'void main () {',
    '    float L = texture2D(u_pressure_texture, vL).x;',
    '    float R = texture2D(u_pressure_texture, vR).x;',
    '    float T = texture2D(u_pressure_texture, vT).x;',
    '    float B = texture2D(u_pressure_texture, vB).x;',
    '    float C = texture2D(u_pressure_texture, vUv).x;',
    '    float divergence = texture2D(u_divergence_texture, vUv).x;',
    '    float pressure = (L + R + B + T - divergence) * .25;',
    '    gl_FragColor = vec4(pressure, 0., 0., 1.);',
    '}'
  ].join('\n');

  var FRAG_GRADIENT_SUBTRACT = [
    'precision highp float;',
    'precision highp sampler2D;',
    '',
    'varying highp vec2 vUv;',
    'varying highp vec2 vL;',
    'varying highp vec2 vR;',
    'varying highp vec2 vT;',
    'varying highp vec2 vB;',
    'uniform sampler2D u_pressure_texture;',
    'uniform sampler2D u_velocity_texture;',
    '',
    'void main () {',
    '    float L = texture2D(u_pressure_texture, vL).x;',
    '    float R = texture2D(u_pressure_texture, vR).x;',
    '    float T = texture2D(u_pressure_texture, vT).x;',
    '    float B = texture2D(u_pressure_texture, vB).x;',
    '    vec2 velocity = texture2D(u_velocity_texture, vUv).xy;',
    '    velocity.xy -= vec2(R - L, T - B);',
    '    gl_FragColor = vec4(velocity, 0., 1.);',
    '}'
  ].join('\n');

  var FRAG_POINT = [
    'precision highp float;',
    'precision highp sampler2D;',
    '',
    'varying vec2 vUv;',
    'uniform sampler2D u_input_texture;',
    'uniform float u_ratio;',
    'uniform vec3 u_point_value;',
    'uniform vec2 u_point;',
    'uniform float u_point_size;',
    '',
    'void main () {',
    '    vec2 p = vUv - u_point.xy;',
    '    p.x *= u_ratio;',
    '    vec3 splat = .6 * pow(2., -dot(p, p) / u_point_size) * u_point_value;',
    '    vec3 base = texture2D(u_input_texture, vUv).xyz;',
    '    gl_FragColor = vec4(base + splat, 1.);',
    '}'
  ].join('\n');

  var FRAG_OUTPUT = [
    'precision highp float;',
    'precision highp sampler2D;',
    '',
    'varying vec2 vUv;',
    'uniform float u_ratio;',
    'uniform float u_img_ratio;',
    'uniform float u_disturb_power;',
    'uniform sampler2D u_output_texture;',
    'uniform sampler2D u_velocity_texture;',
    'uniform sampler2D u_text_texture;',
    '',
    'vec2 get_img_uv() {',
    '    vec2 img_uv = vUv;',
    '    img_uv -= .5;',
    '    if (u_ratio > u_img_ratio) {',
    '        img_uv.x = img_uv.x * u_ratio / u_img_ratio;',
    '    } else {',
    '        img_uv.y = img_uv.y * u_img_ratio / u_ratio;',
    '    }',
    '    float scale_factor = 1.15;', // plan: was 1.4 — artwork preservation at panel scale
    '    img_uv *= scale_factor;',
    '    img_uv += .5;',
    '    return img_uv;',
    '}',
    '',
    'float get_img_frame_alpha(vec2 uv, float img_frame_width) {',
    '    float img_frame_alpha = smoothstep(0., img_frame_width, uv.x) * smoothstep(1., 1. - img_frame_width, uv.x);',
    '    img_frame_alpha *= smoothstep(0., img_frame_width, uv.y) * smoothstep(1., 1. - img_frame_width, uv.y);',
    '    return img_frame_alpha;',
    '}',
    '',
    'void main () {',
    '    float offset = texture2D(u_output_texture, vUv).r;',
    '    vec2 velocity = texture2D(u_velocity_texture, vUv).xy;',
    '    velocity += .001;',
    '    vec2 img_uv = get_img_uv();',
    '    img_uv -= u_disturb_power * normalize(velocity) * offset;',
    '    img_uv -= u_disturb_power * normalize(velocity) * offset;',
    '',
    '    vec3 img = texture2D(u_text_texture, vec2(img_uv.x, 1. - img_uv.y)).rgb;',
    '    float opacity = get_img_frame_alpha(img_uv, .006);', // plan: was .004
    '    gl_FragColor = vec4(img, opacity);',
    '}'
  ].join('\n');

  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      try { console.warn('[FluidHover] shader error:', gl.getShaderInfoLog(shader)); } catch (e) {}
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createShaderProgram(gl, vertSrc, fragSrc, progList) {
    var vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
    var frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;
    var program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, 'a_position'); // stable attrib slot across programs
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      try { console.warn('[FluidHover] link error:', gl.getProgramInfoLog(program)); } catch (e) {}
      return null;
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (progList) progList.push(program);

    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program: program, uniforms: uniforms };
  }

  function FluidPanel(viewEl, imgEl) {
    var destroyed = false;
    var rafId = null;
    var canvas = null;
    var gl = null;
    var resizeObserver = null;
    var programs = null;
    var outputColor = null;
    var velocity = null;
    var divergence = null;
    var pressure = null;
    var imageTexture = null;
    var imgRatio = 1;
    var textureReady = false;
    var wasZoomed = false;
    var quad = null;
    var allTextures = [];  // every GL texture created (for destroy)
    var allFramebuffers = []; // every GL framebuffer created (for destroy)

    var pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false };

    // ── FBO helpers ──────────────────────────────────────────────────────
    function createFBO(w, h) {
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture();
      allTextures.push(texture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // RGBA (not RGB) for maximum float-renderability across GPUs
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, null);

      var fbo = gl.createFramebuffer();
      allFramebuffers.push(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      return {
        fbo: fbo,
        width: w,
        height: h,
        attach: function (id) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        }
      };
    }

    function createDoubleFBO(w, h) {
      var fbo1 = createFBO(w, h);
      var fbo2 = createFBO(w, h);
      return {
        width: w,
        height: h,
        texelSizeX: 1 / w,
        texelSizeY: 1 / h,
        read: function () { return fbo1; },
        write: function () { return fbo2; },
        swap: function () { var t = fbo1; fbo1 = fbo2; fbo2 = t; }
      };
    }

    function clearSimState() {
      // Zero every simulation buffer so exiting zoom never shows stale swirls.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      for (var i = 0; i < allFramebuffers.length; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, allFramebuffers[i]);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function releaseSimFBOs() {
      for (var t = 0; t < allTextures.length; t++) gl.deleteTexture(allTextures[t]);
      allTextures.length = 0;
      for (var f = 0; f < allFramebuffers.length; f++) gl.deleteFramebuffer(allFramebuffers[f]);
      allFramebuffers.length = 0;
    }

    function buildFBOs(w, h) {
      releaseSimFBOs(); // no GPU accumulation across resizes
      outputColor = createDoubleFBO(w, h);
      velocity = createDoubleFBO(w, h);
      divergence = createFBO(w, h);
      pressure = createDoubleFBO(w, h);
    }

    // ── Quad setup ───────────────────────────────────────────────────────
    function setupQuad() {
      var vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      var indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      quad = { vertexBuffer: vertexBuffer, indexBuffer: indexBuffer };
    }

    function blit(target) {
      gl.bindBuffer(gl.ARRAY_BUFFER, quad.vertexBuffer);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad.indexBuffer);

      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    // ── Texture upload (Safari-safe via decode()) ────────────────────────
    function uploadTexture(img) {
      if (destroyed || !gl || !img || !img.naturalWidth) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        imgRatio = img.naturalWidth / img.naturalHeight;
        textureReady = true;
      } catch (e) {
        // tainted or broken image → plain-img fallback
        teardown(true);
      }
    }

    function onImgLoad() {
      if (typeof imgEl.decode === 'function') {
        imgEl.decode().then(function () { uploadTexture(imgEl); })
                     .catch(function () { uploadTexture(imgEl); });
      } else {
        uploadTexture(imgEl);
      }
    }

    // ── Pointer tracking (listeners live on viewEl — canvas ignores events) ──
    function onPointerMove(e) {
      if (destroyed || !canvas) return;
      var rect = canvas.getBoundingClientRect();
      var cx, cy;
      if (e.touches && e.touches.length) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
        e.preventDefault(); // keep page from scrolling while swirling ({passive:false})
      } else {
        cx = e.clientX;
        cy = e.clientY;
      }
      var nx = cx - rect.left;
      var ny = cy - rect.top;
      pointer.moved = true;
      pointer.dx = SPLAT_FORCE * (nx - pointer.x);
      pointer.dy = SPLAT_FORCE * (ny - pointer.y);
      pointer.x = nx;
      pointer.y = ny;
    }

    function onVisibilityChange() {
      if (destroyed) return;
      if (document.hidden) {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (rafId === null) {
        rafId = requestAnimationFrame(renderLoop);
      }
    }

    function onContextLost(e) {
      e.preventDefault();
      // GPU dropped our context → silently fall back to the plain image.
      teardown(true);
    }

    // ── Render loop ──────────────────────────────────────────────────────
    function renderLoop() {
      rafId = requestAnimationFrame(renderLoop);

      // Zoom gate (per-frame DOM class check — no external API needed)
      var zoomed = viewEl.classList.contains('zoom-active');
      if (zoomed) {
        if (!wasZoomed) { clearSimState(); wasZoomed = true; }
        return; // effect fully OFF during zoom mode
      }
      wasZoomed = false;

      if (!textureReady) return;

      var dt = FIXED_DT;
      var ratio = canvas.width / canvas.height;

      if (pointer.moved) {
        gl.useProgram(programs.splat.program);
        gl.uniform1i(programs.splat.uniforms.u_input_texture, velocity.read().attach(1));
        gl.uniform1f(programs.splat.uniforms.u_ratio, ratio);
        gl.uniform2f(programs.splat.uniforms.u_point,
          pointer.x / canvas.width, 1 - pointer.y / canvas.height);
        gl.uniform3f(programs.splat.uniforms.u_point_value, pointer.dx, -pointer.dy, 0);
        gl.uniform1f(programs.splat.uniforms.u_point_size, PARAMS.cursorSize * 0.001);
        blit(velocity.write());
        velocity.swap();

        gl.uniform1i(programs.splat.uniforms.u_input_texture, outputColor.read().attach(1));
        gl.uniform3f(programs.splat.uniforms.u_point_value, PARAMS.cursorPower * 0.001, 0, 0);
        blit(outputColor.write());
        outputColor.swap();

        pointer.moved = false;
      }

      gl.useProgram(programs.divergence.program);
      gl.uniform2f(programs.divergence.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(programs.divergence.uniforms.u_velocity_texture, velocity.read().attach(1));
      blit(divergence);

      gl.useProgram(programs.pressure.program);
      gl.uniform2f(programs.pressure.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(programs.pressure.uniforms.u_divergence_texture, divergence.attach(1));
      for (var i = 0; i < PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(programs.pressure.uniforms.u_pressure_texture, pressure.read().attach(2));
        blit(pressure.write());
        pressure.swap();
      }

      gl.useProgram(programs.gradientSubtract.program);
      gl.uniform2f(programs.gradientSubtract.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(programs.gradientSubtract.uniforms.u_pressure_texture, pressure.read().attach(1));
      gl.uniform1i(programs.gradientSubtract.uniforms.u_velocity_texture, velocity.read().attach(2));
      blit(velocity.write());
      velocity.swap();

      gl.useProgram(programs.advection.program);
      gl.uniform2f(programs.advection.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform2f(programs.advection.uniforms.u_output_textel, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(programs.advection.uniforms.u_velocity_texture, velocity.read().attach(1));
      gl.uniform1i(programs.advection.uniforms.u_input_texture, velocity.read().attach(1));
      gl.uniform1f(programs.advection.uniforms.u_dt, dt);
      gl.uniform1f(programs.advection.uniforms.u_dissipation, DISSIPATION_VELOCITY);
      blit(velocity.write());
      velocity.swap();

      gl.useProgram(programs.advection.program);
      gl.uniform2f(programs.advection.uniforms.u_output_textel, outputColor.texelSizeX, outputColor.texelSizeY);
      gl.uniform1i(programs.advection.uniforms.u_input_texture, outputColor.read().attach(2));
      gl.uniform1f(programs.advection.uniforms.u_dt, 8 * dt);
      gl.uniform1f(programs.advection.uniforms.u_dissipation, DISSIPATION_OUTPUT);
      blit(outputColor.write());
      outputColor.swap();

      gl.useProgram(programs.display.program);
      gl.uniform1i(programs.display.uniforms.u_text_texture, 0);
      // rebind the photo to unit 0 EVERY frame — FBO rebuilds otherwise leave
      // a sim texture bound here and the display pass samples black
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.uniform2f(programs.display.uniforms.u_point,
        pointer.x / canvas.width, 1 - pointer.y / canvas.height);
      gl.uniform1i(programs.display.uniforms.u_velocity_texture, velocity.read().attach(2));
      gl.uniform1f(programs.display.uniforms.u_ratio, ratio);
      gl.uniform1f(programs.display.uniforms.u_img_ratio, imgRatio);
      gl.uniform1f(programs.display.uniforms.u_disturb_power, PARAMS.distortionPower);
      gl.uniform1i(programs.display.uniforms.u_output_texture, outputColor.read().attach(1));
      blit(null);
    }

    // ── Init ─────────────────────────────────────────────────────────────
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return null; // accessibility gate: no canvas, no GL context at all
    }

    canvas = document.createElement('canvas');
    canvas.className = 'canvas-opgl-fluid-canvas';
    canvas.style.willChange = 'auto'; // don't fight the img's will-change:transform layer
    viewEl.appendChild(canvas);       // LAST child → renders on top of the img

    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) { canvas.parentNode.removeChild(canvas); canvas = null; return null; }
    if (!gl.getExtension('OES_texture_float')) {
      canvas.parentNode.removeChild(canvas); canvas = null; gl = null;
      return null;
    }

    // THE photo texture (kept OUT of the sim-texture list: resize rebuilds
    // must never delete it — that was the black-square bug)
    imageTexture = gl.createTexture();

    canvas.addEventListener('webglcontextlost', onContextLost, false);

    // Backing store matches CSS pixels of the view (no DPR multiplier — plan decision)
    canvas.width = Math.max(1, viewEl.clientWidth);
    canvas.height = Math.max(1, viewEl.clientHeight);

    setupQuad();

    programs = {
      splat: createShaderProgram(gl, VERT, FRAG_POINT, null),
      divergence: createShaderProgram(gl, VERT, FRAG_DIVERGENCE, null),
      pressure: createShaderProgram(gl, VERT, FRAG_PRESSURE, null),
      gradientSubtract: createShaderProgram(gl, VERT, FRAG_GRADIENT_SUBTRACT, null),
      advection: createShaderProgram(gl, VERT, FRAG_ADVECTION, null),
      display: createShaderProgram(gl, VERT, FRAG_OUTPUT, null)
    };
    for (var key in programs) {
      if (!programs[key]) { teardown(true); return null; }
    }

    var ratio = canvas.width / canvas.height;
    var simW = Math.max(Math.floor(256 * ratio), canvas.width);
    var simH = Math.max(256, canvas.height);
    buildFBOs(simW, simH);

    // strict float-renderability check — incomplete FBOs would sample black
    function fbComplete(f) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
      var s = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return s === gl.FRAMEBUFFER_COMPLETE;
    }
    if (!fbComplete(pressure.read()) || !fbComplete(velocity.read())) {
      teardown(true);
      return null;
    }

    // Pointer starts at panel center (avoids a huge first-move spike)
    pointer.x = canvas.width / 2;
    pointer.y = canvas.height / 2;

    // Image texture: fast-path when already decoded, else onload (+decode for Safari)
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      uploadTexture(imgEl);
    }
    imgEl.addEventListener('load', onImgLoad);

    resizeObserver = new ResizeObserver(function () {
      if (destroyed) return;
      var w = Math.max(1, viewEl.clientWidth);
      var h = Math.max(1, viewEl.clientHeight);
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      ratio = w / h;
      buildFBOs(Math.max(Math.floor(256 * ratio), w), Math.max(256, h));
    });
    resizeObserver.observe(viewEl);

    viewEl.addEventListener('mousemove', onPointerMove);
    viewEl.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('visibilitychange', onVisibilityChange);

    rafId = requestAnimationFrame(renderLoop);

    // ── Teardown (strict order per plan) ─────────────────────────────────
    function teardown(skipDomCanvasRemovalFlagUnused) {
      if (destroyed) return;
      destroyed = true;

      // 1. stop scheduling
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

      // 2-4. free GL objects (safe even after context loss)
      if (gl) {
        if (programs) {
          for (var key in programs) {
            if (programs[key]) gl.deleteProgram(programs[key].program);
          }
          programs = null;
        }
        releaseSimFBOs();
        gl.deleteTexture(imageTexture); imageTexture = null;
        if (quad) { gl.deleteBuffer(quad.vertexBuffer); gl.deleteBuffer(quad.indexBuffer); quad = null; }
        var loseExt = gl.getExtension('WEBGL_lose_context');
        if (loseExt) loseExt.loseContext();
      }

      // 5. remove listeners
      viewEl.removeEventListener('mousemove', onPointerMove);
      viewEl.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (canvas) canvas.removeEventListener('webglcontextlost', onContextLost);
      imgEl.removeEventListener('load', onImgLoad);

      // 6. disconnect observer
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }

      // 7. leave DOM clean (plain <img> shows through again)
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);

      canvas = null;
      gl = null;
    }

    return {
      destroy: function () { teardown(); }
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────
  window.FluidHover = {
    mount: function (viewEl, imgEl) {
      try {
        return FluidPanel(viewEl, imgEl);
      } catch (err) {
        try { console.warn('[FluidHover] mount failed, using plain image.', err); } catch (e) {}
        return null;
      }
    }
  };
})();
