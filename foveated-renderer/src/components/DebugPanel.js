/**
 * DebugPanel - Comprehensive debug overlay for development and demonstration
 * Shows video feed with tracking points, FPS, gaze data, and system stats
 */

export class DebugPanel {
    constructor() {
        this.visible = false;
        this.container = null;
        this.videoCanvas = null;
        this.videoCtx = null;
        this.statsContainer = null;

        this.stats = {
            fps: 0,
            gazeX: 0,
            gazeY: 0,
            lodLevel: 0,
            avgSteps: 0,
            eyeOpenness: 1.0,
            calibrationScore: 0,
            faceDetected: false
        };

        this.frameCount = 0;
        this.lastFpsTime = Date.now();

        this._createPanel();
    }

    _createPanel() {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'debug-panel';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 320px;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 12px;
            overflow: hidden;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 12px;
            color: #00ff88;
            z-index: 1000;
            display: none;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(0, 255, 136, 0.3);
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 15px;
            background: rgba(0, 255, 136, 0.1);
            border-bottom: 1px solid rgba(0, 255, 136, 0.3);
            font-weight: bold;
            font-size: 14px;
        `;
        header.textContent = 'DEBUG MODE';
        this.container.appendChild(header);

        // Video canvas for face landmarks
        this.videoCanvas = document.createElement('canvas');
        this.videoCanvas.width = 320;
        this.videoCanvas.height = 240;
        this.videoCanvas.style.cssText = `
            width: 100%;
            display: block;
            background: #111;
        `;
        this.container.appendChild(this.videoCanvas);
        this.videoCtx = this.videoCanvas.getContext('2d');

        // Stats container
        this.statsContainer = document.createElement('div');
        this.statsContainer.style.cssText = `
            padding: 15px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        `;
        this.container.appendChild(this.statsContainer);

        document.body.appendChild(this.container);
    }

    /**
     * Update stats display
     */
    updateStats(stats) {
        Object.assign(this.stats, stats);

        // Calculate FPS
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsTime >= 1000) {
            this.stats.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        // Update stats display
        this.statsContainer.innerHTML = `
            <div><span style="color:#888">FPS:</span> ${this.stats.fps}</div>
            <div><span style="color:#888">Face:</span> ${this.stats.faceDetected ? '✓ Detected' : '✗ None'}</div>
            <div><span style="color:#888">Gaze X:</span> ${(this.stats.gazeX * 100).toFixed(1)}%</div>
            <div><span style="color:#888">Gaze Y:</span> ${(this.stats.gazeY * 100).toFixed(1)}%</div>
            <div><span style="color:#888">LOD Level:</span> ${(this.stats.lodLevel * 100).toFixed(0)}%</div>
            <div><span style="color:#888">Avg Steps:</span> ${this.stats.avgSteps.toFixed(1)}</div>
            <div><span style="color:#888">Eye Open:</span> ${(this.stats.eyeOpenness * 100).toFixed(0)}%</div>
            <div><span style="color:#888">Calibration:</span> ${this.stats.calibrationScore.toFixed(0)}%</div>
        `;
    }

    /**
     * Draw video frame with face landmarks
     * @param {HTMLVideoElement} video - Video element
     * @param {Array} landmarks - MediaPipe face landmarks (468 points)
     */
    drawVideoWithLandmarks(video, landmarks) {
        if (!this.visible || !video) return;

        const ctx = this.videoCtx;
        const w = this.videoCanvas.width;
        const h = this.videoCanvas.height;

        // Draw video frame (mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -w, 0, w, h);
        ctx.restore();

        // Draw landmarks
        if (landmarks && landmarks.length > 0) {
            // Draw all 468 points
            ctx.fillStyle = 'rgba(0, 255, 136, 0.5)';
            for (const landmark of landmarks) {
                const x = (1 - landmark.x) * w; // Mirrored
                const y = landmark.y * h;
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }

            // Highlight eye landmarks (indices 33, 133, 362, 263 for eye corners)
            const eyeIndices = [33, 133, 362, 263, 159, 145, 386, 374]; // Eye corners and centers
            ctx.fillStyle = '#ff0066';
            for (const idx of eyeIndices) {
                if (landmarks[idx]) {
                    const x = (1 - landmarks[idx].x) * w;
                    const y = landmarks[idx].y * h;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw iris centers if available (indices 468-477)
            ctx.fillStyle = '#00ffff';
            for (let i = 468; i < Math.min(478, landmarks.length); i++) {
                if (landmarks[i]) {
                    const x = (1 - landmarks[i].x) * w;
                    const y = landmarks[i].y * h;
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Draw gaze point indicator
        const gazeX = (1 - this.stats.gazeX) * w;
        const gazeY = this.stats.gazeY * h;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gazeX - 10, gazeY);
        ctx.lineTo(gazeX + 10, gazeY);
        ctx.moveTo(gazeX, gazeY - 10);
        ctx.lineTo(gazeX, gazeY + 10);
        ctx.stroke();
    }

    /**
     * Show the debug panel
     */
    show() {
        this.visible = true;
        this.container.style.display = 'block';
    }

    /**
     * Hide the debug panel
     */
    hide() {
        this.visible = false;
        this.container.style.display = 'none';
    }

    /**
     * Toggle visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Check if visible
     */
    isVisible() {
        return this.visible;
    }

    /**
     * Destroy the panel
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
