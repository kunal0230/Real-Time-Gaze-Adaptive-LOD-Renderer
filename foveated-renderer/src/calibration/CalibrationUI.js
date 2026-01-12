/**
 * 9-Point Calibration UI
 * Matches Python EyeTrax implementation:
 * - Pulse phase: 1 second animation to attract attention
 * - Capture phase: 1 second of continuous sample collection
 * - No averaging - train on ALL samples
 */

export class CalibrationUI {
    constructor(gazeEstimator, options = {}) {
        this.gazeEstimator = gazeEstimator;
        this.overlay = document.getElementById('calibration-overlay');
        this.point = document.getElementById('calibration-point');
        this.status = document.getElementById('calibration-status');

        // Calibration settings - match Python defaults
        this.pulseDuration = options.pulseDuration || 1000;  // 1 second pulse
        this.captureDuration = options.captureDuration || 1000; // 1 second capture
        this.marginRatio = options.marginRatio || 0.10; // 10% margin

        // Collected data - ALL samples, not averaged!
        this.features = [];
        this.targets = [];

        // State
        this.isRunning = false;

        // Callbacks
        this.onComplete = null;
        this.onProgress = null;
    }

    /**
     * Get calibration points using the same algorithm as Python
     */
    getCalibrationPoints() {
        const sw = window.innerWidth;
        const sh = window.innerHeight;

        // Order: center, corners, edges (same as EyeTrax nine_point.py)
        const order = [
            [1, 1], // Center
            [0, 0], // Top-left
            [2, 0], // Top-right
            [0, 2], // Bottom-left
            [2, 2], // Bottom-right
            [1, 0], // Top-center
            [0, 1], // Left-center
            [2, 1], // Right-center
            [1, 2], // Bottom-center
        ];

        // Match Python's compute_grid_points exactly
        const maxR = Math.max(...order.map(([r, _]) => r));
        const maxC = Math.max(...order.map(([_, c]) => c));

        const mx = Math.floor(sw * this.marginRatio);
        const my = Math.floor(sh * this.marginRatio);
        const gw = sw - 2 * mx;
        const gh = sh - 2 * my;

        const stepX = maxC === 0 ? 0 : gw / maxC;
        const stepY = maxR === 0 ? 0 : gh / maxR;

        return order.map(([r, c]) => ({
            x: mx + Math.floor(c * stepX),
            y: my + Math.floor(r * stepY),
        }));
    }

    /**
     * Start calibration process - matches Python _pulse_and_capture
     */
    async start(processFrame) {
        this.isRunning = true;
        this.features = [];
        this.targets = [];

        const points = this.getCalibrationPoints();
        this.overlay.classList.remove('hidden');

        // Initial countdown
        this.status.textContent = 'Get ready - look at each point...';
        await this._delay(1500);

        for (let i = 0; i < points.length; i++) {
            if (!this.isRunning) break;

            const pt = points[i];

            // Move point to position
            this.point.style.left = `${pt.x}px`;
            this.point.style.top = `${pt.y}px`;

            // === PULSE PHASE (1 second) ===
            // Just attract attention, no sample collection
            this.status.textContent = `Point ${i + 1}/${points.length} - Focus on the dot`;
            const pulseStart = performance.now();

            while (performance.now() - pulseStart < this.pulseDuration) {
                if (!this.isRunning) break;
                // Just wait and animate (CSS handles animation)
                await this._delay(50);
            }

            // === CAPTURE PHASE (1 second) ===
            // Collect samples continuously like Python does
            this.status.textContent = `Point ${i + 1}/${points.length} - Collecting...`;
            const captureStart = performance.now();
            let samplesThisPoint = 0;

            while (performance.now() - captureStart < this.captureDuration) {
                if (!this.isRunning) break;

                const results = await processFrame();
                if (results) {
                    const { features, blinkDetected } = this.gazeEstimator.extractFeatures(results);

                    if (features && !blinkDetected) {
                        // Store EACH sample separately (like Python)
                        this.features.push([...features]); // Clone the array
                        this.targets.push([pt.x, pt.y]);
                        samplesThisPoint++;
                    }
                }

                // Small delay to not overwhelm
                await this._delay(33); // ~30fps
            }

            console.log(`Point ${i + 1}: collected ${samplesThisPoint} samples`);

            if (this.onProgress) {
                this.onProgress({
                    point: i + 1,
                    totalPoints: points.length,
                    samples: samplesThisPoint,
                    totalSamples: this.features.length,
                });
            }
        }

        // Hide overlay
        this.overlay.classList.add('hidden');
        this.isRunning = false;

        console.log(`Total samples collected: ${this.features.length}`);

        // Train model if we have enough data
        if (this.features.length >= 20) {
            this.status.textContent = 'Training model...';

            try {
                this.gazeEstimator.train(this.features, this.targets);

                if (this.onComplete) {
                    this.onComplete(true);
                }
                return true;
            } catch (error) {
                console.error('Training failed:', error);
                if (this.onComplete) {
                    this.onComplete(false);
                }
                return false;
            }
        } else {
            console.error(`Not enough samples: ${this.features.length}`);
            if (this.onComplete) {
                this.onComplete(false);
            }
            return false;
        }
    }

    /**
     * Cancel calibration
     */
    cancel() {
        this.isRunning = false;
        this.overlay.classList.add('hidden');
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
