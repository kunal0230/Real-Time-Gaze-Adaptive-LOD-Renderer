/**
 * Foveated Renderer using WebGL
 * Applies variable blur based on distance from gaze point
 */

export class FoveatedRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // Gaze parameters
    this.gazeX = 0.5;
    this.gazeY = 0.5;

    // Foveation parameters
    this.fovealRadius = 0.15;     // Full quality zone (normalized)
    this.parafovealRadius = 0.35; // Medium quality zone
    this.maxBlur = 16.0;          // Maximum blur amount

    // WebGL resources
    this.program = null;
    this.texture = null;
    this.imageLoaded = false;

    this._init();
  }

  _init() {
    const gl = this.gl;

    // Vertex shader (simple fullscreen quad)
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader with foveated blur
    const fsSource = `
      precision highp float;
      
      uniform sampler2D u_image;
      uniform vec2 u_gazePoint;
      uniform vec2 u_resolution;
      uniform float u_fovealRadius;
      uniform float u_parafovealRadius;
      uniform float u_maxBlur;
      
      varying vec2 v_texCoord;
      
      vec4 blur(sampler2D tex, vec2 uv, vec2 resolution, float amount) {
        vec2 texelSize = 1.0 / resolution;
        vec4 result = vec4(0.0);
        float total = 0.0;
        
        float samples = clamp(amount, 1.0, 8.0);
        
        for (float x = -8.0; x <= 8.0; x += 1.0) {
          for (float y = -8.0; y <= 8.0; y += 1.0) {
            if (abs(x) <= samples && abs(y) <= samples) {
              vec2 offset = vec2(x, y) * texelSize * (amount * 0.5);
              result += texture2D(tex, uv + offset);
              total += 1.0;
            }
          }
        }
        
        return result / total;
      }
      
      void main() {
        // Calculate distance from gaze point (aspect-ratio corrected)
        vec2 aspectCorrectedCoord = v_texCoord;
        vec2 aspectCorrectedGaze = u_gazePoint;
        
        float aspect = u_resolution.x / u_resolution.y;
        aspectCorrectedCoord.x *= aspect;
        aspectCorrectedGaze.x *= aspect;
        
        float dist = distance(aspectCorrectedCoord, aspectCorrectedGaze);
        
        // Determine blur amount based on distance
        float blurAmount = 0.0;
        
        if (dist < u_fovealRadius) {
          // Foveal zone - full resolution
          blurAmount = 0.0;
        } else if (dist < u_parafovealRadius) {
          // Parafoveal zone - gradual blur
          float t = (dist - u_fovealRadius) / (u_parafovealRadius - u_fovealRadius);
          blurAmount = t * t * u_maxBlur * 0.5;
        } else {
          // Peripheral zone - maximum blur
          float t = min((dist - u_parafovealRadius) / 0.3, 1.0);
          blurAmount = mix(u_maxBlur * 0.5, u_maxBlur, t);
        }
        
        if (blurAmount < 0.5) {
          gl_FragColor = texture2D(u_image, v_texCoord);
        } else {
          gl_FragColor = blur(u_image, v_texCoord, u_resolution, blurAmount);
        }
      }
    `;

    // Compile shaders
    const vs = this._compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSource);

    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.program));
    }

    // Get attribute/uniform locations
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
      image: gl.getUniformLocation(this.program, 'u_image'),
      gazePoint: gl.getUniformLocation(this.program, 'u_gazePoint'),
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      fovealRadius: gl.getUniformLocation(this.program, 'u_fovealRadius'),
      parafovealRadius: gl.getUniformLocation(this.program, 'u_parafovealRadius'),
      maxBlur: gl.getUniformLocation(this.program, 'u_maxBlur'),
    };

    // Create geometry (fullscreen quad)
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]);

    const texCoords = new Float32Array([
      0, 1, 1, 1, 0, 0,
      0, 0, 1, 1, 1, 0,
    ]);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // Create texture
    this.texture = gl.createTexture();
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  /**
   * Load an image for rendering
   * @param {string} src - Image URL or data URL
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.imageLoaded = true;
        resolve(img);
      };

      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Update gaze point (normalized 0-1 coordinates)
   */
  setGazePoint(x, y) {
    this.gazeX = x;
    this.gazeY = y;
  }

  /**
   * Set foveation parameters
   */
  setFoveationParams(fovealRadius, parafovealRadius, maxBlur) {
    this.fovealRadius = fovealRadius;
    this.parafovealRadius = parafovealRadius;
    this.maxBlur = maxBlur;
  }

  /**
   * Resize canvas to fit container
   */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render frame
   */
  render() {
    if (!this.imageLoaded) return;

    const gl = this.gl;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform1i(this.locations.image, 0);
    gl.uniform2f(this.locations.gazePoint, this.gazeX, this.gazeY);
    gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locations.fovealRadius, this.fovealRadius);
    gl.uniform1f(this.locations.parafovealRadius, this.parafovealRadius);
    gl.uniform1f(this.locations.maxBlur, this.maxBlur);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

    // Bind texcoord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.locations.texCoord);
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
