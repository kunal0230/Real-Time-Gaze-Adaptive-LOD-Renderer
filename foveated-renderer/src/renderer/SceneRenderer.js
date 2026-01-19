/**
 * SceneRenderer - Dynamic scene-aware WebGL2 renderer
 * Loads shader from scene class, supports WebGPU fallback
 */

export class SceneRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) {
            console.error('WebGL2 not supported');
            return;
        }

        this.program = null;
        this.scene = null;
        this.gazeX = 0.5;
        this.gazeY = 0.5;
        this.time = 0;
        this.showHeatmap = false;
        this.extraDetails = false;
        this.foveaRadius = 0.18; // Balanced for visible LOD difference

        // Uniforms
        this.uResolution = null;
        this.uGaze = null;
        this.uTime = null;
        this.uFoveaRadius = null;
        this.uShowHeatmap = null;
        this.uExtraDetails = null;
    }

    /**
     * Load a scene and compile its shader
     * @param {BaseScene} scene 
     */
    loadScene(scene) {
        this.scene = scene;
        this._compileShader(scene.getFragmentShader());
    }

    resize() {
        const scale = this.scene ? this.scene.getResolutionScale() : 1.0;
        this.canvas.width = Math.floor(window.innerWidth * scale);
        this.canvas.height = Math.floor(window.innerHeight * scale);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setHeatmap(show) {
        this.showHeatmap = show;
    }

    setExtraDetails(show) {
        this.extraDetails = show;
    }

    setGazePoint(x, y) {
        this.gazeX = x;
        this.gazeY = 1.0 - y;
    }

    render() {
        if (!this.program) return;

        this.time += 0.016;

        this.gl.useProgram(this.program);

        this.gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.uGaze, this.gazeX, this.gazeY);
        this.gl.uniform1f(this.uTime, this.time);
        this.gl.uniform1f(this.uFoveaRadius, this.foveaRadius);
        this.gl.uniform1i(this.uShowHeatmap, this.showHeatmap ? 1 : 0);
        this.gl.uniform1i(this.uExtraDetails, this.extraDetails ? 1 : 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    _compileShader(fragmentSource) {
        const vsSource = `#version 300 es
            in vec4 position;
            void main() {
                gl_Position = position;
            }
        `;

        const vertexShader = this._createShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) return;

        // Clean up old program
        if (this.program) {
            this.gl.deleteProgram(this.program);
        }

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Shader link error:', this.gl.getProgramInfoLog(this.program));
            return;
        }

        this.uResolution = this.gl.getUniformLocation(this.program, 'u_resolution');
        this.uGaze = this.gl.getUniformLocation(this.program, 'u_gaze');
        this.uTime = this.gl.getUniformLocation(this.program, 'u_time');
        this.uFoveaRadius = this.gl.getUniformLocation(this.program, 'u_foveaRadius');
        this.uShowHeatmap = this.gl.getUniformLocation(this.program, 'u_showHeatmap');
        this.uExtraDetails = this.gl.getUniformLocation(this.program, 'u_extraDetails');

        // Set up vertex buffer
        this._initBuffers();

        // Clean up shaders
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _initBuffers() {
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

        const positions = [
            -1.0, 1.0,
            1.0, 1.0,
            -1.0, -1.0,
            1.0, -1.0,
        ];

        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        const positionAttributeLocation = this.gl.getAttribLocation(this.program, 'position');
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    destroy() {
        if (this.program) {
            this.gl.deleteProgram(this.program);
            this.program = null;
        }
    }
}
