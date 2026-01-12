/**
 * FaceGuide - Face positioning overlay for camera preview
 * Guides user to position their face correctly for optimal eye tracking
 */

export class FaceGuide {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = null;
        this.ctx = null;
        this.faceDetected = false;
        this.facePosition = { x: 0.5, y: 0.5, size: 0 };
        this.status = 'searching'; // 'searching' | 'too_far' | 'too_close' | 'off_center' | 'good'
        this.statusText = 'Looking for face...';

        this._createCanvas();
    }

    _createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'face-guide-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        `;
        this.container.style.position = 'relative';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Update face detection status
     * @param {object|null} landmarks - MediaPipe face landmarks or null
     */
    updateFace(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            this.faceDetected = false;
            this.status = 'searching';
            this.statusText = 'Looking for face...';
            return;
        }

        this.faceDetected = true;

        // Calculate face bounding box from landmarks
        const xs = landmarks.map(l => l.x);
        const ys = landmarks.map(l => l.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const faceWidth = maxX - minX;
        const faceHeight = maxY - minY;
        const faceSize = Math.max(faceWidth, faceHeight);

        this.facePosition = { x: centerX, y: centerY, size: faceSize };

        // Determine status based on position and size
        const idealSize = 0.35; // Face should be ~35% of frame width
        const sizeTolerance = 0.1;
        const centerTolerance = 0.15;

        const offCenterX = Math.abs(centerX - 0.5);
        const offCenterY = Math.abs(centerY - 0.45); // Slightly above center

        if (faceSize < idealSize - sizeTolerance) {
            this.status = 'too_far';
            this.statusText = 'Move closer to camera';
        } else if (faceSize > idealSize + sizeTolerance + 0.1) {
            this.status = 'too_close';
            this.statusText = 'Move back a little';
        } else if (offCenterX > centerTolerance || offCenterY > centerTolerance) {
            this.status = 'off_center';
            this.statusText = 'Center your face';
        } else {
            this.status = 'good';
            this.statusText = 'Perfect! Ready to start';
        }
    }

    /**
     * Render the face guide overlay
     */
    render() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Draw oval guide
        const ovalCenterX = w * 0.5;
        const ovalCenterY = h * 0.45;
        const ovalRadiusX = w * 0.18;
        const ovalRadiusY = h * 0.28;

        // Determine color based on status
        let guideColor = '#ff6b6b'; // Red - not good
        let bgAlpha = 0.3;

        if (this.status === 'good') {
            guideColor = '#51cf66'; // Green - good
            bgAlpha = 0.2;
        } else if (this.status === 'off_center') {
            guideColor = '#ffd43b'; // Yellow - close
        }

        // Draw darkened area outside oval
        ctx.fillStyle = `rgba(0, 0, 0, ${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);

        // Cut out oval (clear it)
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.ellipse(ovalCenterX, ovalCenterY, ovalRadiusX, ovalRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw oval border
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.ellipse(ovalCenterX, ovalCenterY, ovalRadiusX, ovalRadiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw corner guides
        const cornerSize = 20;
        const margin = 30;
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 3;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(margin, margin + cornerSize);
        ctx.lineTo(margin, margin);
        ctx.lineTo(margin + cornerSize, margin);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(w - margin - cornerSize, margin);
        ctx.lineTo(w - margin, margin);
        ctx.lineTo(w - margin, margin + cornerSize);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(margin, h - margin - cornerSize);
        ctx.lineTo(margin, h - margin);
        ctx.lineTo(margin + cornerSize, h - margin);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(w - margin - cornerSize, h - margin);
        ctx.lineTo(w - margin, h - margin);
        ctx.lineTo(w - margin, h - margin - cornerSize);
        ctx.stroke();

        // Draw status text
        ctx.font = 'bold 18px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = guideColor;
        ctx.fillText(this.statusText, w / 2, h - 40);

        // Draw face indicator if detected
        if (this.faceDetected) {
            const faceX = this.facePosition.x * w;
            const faceY = this.facePosition.y * h;

            ctx.beginPath();
            ctx.arc(faceX, faceY, 8, 0, Math.PI * 2);
            ctx.fillStyle = guideColor;
            ctx.fill();
        }
    }

    /**
     * Check if face is ready for calibration
     */
    isReady() {
        return this.status === 'good';
    }

    /**
     * Destroy the overlay
     */
    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
