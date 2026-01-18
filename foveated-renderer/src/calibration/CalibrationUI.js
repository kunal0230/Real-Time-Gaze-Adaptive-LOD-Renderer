/**
 * 9-Point Calibration UI with Instruction Screen
 * Shows instructions first, then starts dot calibration on button click
 */

export class CalibrationUI {
    constructor(gazeEstimator, options = {}) {
        this.gazeEstimator = gazeEstimator;
        this.overlay = document.getElementById('calibration-overlay');
        this.point = document.getElementById('calibration-point');
        this.status = document.getElementById('calibration-status');

        // Calibration settings
        this.pulseDuration = options.pulseDuration || 1000;
        this.captureDuration = options.captureDuration || 1000;
        this.marginRatio = options.marginRatio || 0.12; // 12% margin for safety

        // Collected data
        this.features = [];
        this.targets = [];

        // State
        this.isRunning = false;

        // Callbacks
        this.onComplete = null;
        this.onProgress = null;
    }

    /**
     * Get calibration points - adapts to any screen size
     */
    getCalibrationPoints() {
        const sw = window.innerWidth;
        const sh = window.innerHeight;

        // 3x3 grid order: center, corners, edges
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

        // Calculate grid with margins (percentage-based for any screen size)
        const mx = Math.floor(sw * this.marginRatio);
        const my = Math.floor(sh * this.marginRatio);
        const gw = sw - 2 * mx;
        const gh = sh - 2 * my;

        const stepX = gw / 2;
        const stepY = gh / 2;

        return order.map(([r, c]) => ({
            x: mx + Math.floor(c * stepX),
            y: my + Math.floor(r * stepY),
        }));
    }

    /**
     * Show instruction screen first, then start on button click
     */
    async start(processFrame) {
        this.features = [];
        this.targets = [];

        // Show overlay with instruction screen
        this.overlay.classList.remove('hidden');
        this.point.style.display = 'none';

        // Create instruction screen
        this._showInstructions();

        // Wait for user to click Start
        await this._waitForStartClick();

        // Remove instruction screen
        this._hideInstructions();

        // Now run actual calibration
        await this._runCalibration(processFrame);
    }

    _showInstructions() {
        // Create instruction container
        const instructionDiv = document.createElement('div');
        instructionDiv.id = 'calibration-instructions';
        instructionDiv.className = 'calibration-instructions';
        instructionDiv.innerHTML = `
            <div class="instruction-card">
                <h2>Calibration Instructions</h2>
                <div class="instruction-steps">
                    <div class="step">
                        <span class="step-num">1</span>
                        <span>Keep your head still during calibration</span>
                    </div>
                    <div class="step">
                        <span class="step-num">2</span>
                        <span>A dot will appear at 9 different positions</span>
                    </div>
                    <div class="step">
                        <span class="step-num">3</span>
                        <span>Look directly at each dot until it moves</span>
                    </div>
                    <div class="step">
                        <span class="step-num">4</span>
                        <span>Only move your eyes, not your head</span>
                    </div>
                </div>
                <p class="instruction-note">The process takes about 20 seconds</p>
                <button id="begin-calibration-btn" class="begin-calibration-btn">
                    Begin Calibration
                </button>
            </div>
        `;
        this.overlay.appendChild(instructionDiv);
    }

    _hideInstructions() {
        const instructionDiv = document.getElementById('calibration-instructions');
        if (instructionDiv) {
            instructionDiv.remove();
        }
        this.point.style.display = 'block';
    }

    _waitForStartClick() {
        return new Promise(resolve => {
            const btn = document.getElementById('begin-calibration-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    resolve();
                }, { once: true });
            } else {
                // Fallback if button not found
                setTimeout(resolve, 100);
            }
        });
    }

    async _runCalibration(processFrame) {
        this.isRunning = true;
        const points = this.getCalibrationPoints();

        // Brief countdown
        this.status.textContent = 'Starting in 3...';
        await this._delay(700);
        this.status.textContent = 'Starting in 2...';
        await this._delay(700);
        this.status.textContent = 'Starting in 1...';
        await this._delay(700);

        for (let i = 0; i < points.length; i++) {
            if (!this.isRunning) break;

            const pt = points[i];

            // Move point to position
            this.point.style.left = `${pt.x}px`;
            this.point.style.top = `${pt.y}px`;

            // PULSE PHASE
            this.status.textContent = `Point ${i + 1}/${points.length} - Look at the dot`;
            const pulseStart = performance.now();

            while (performance.now() - pulseStart < this.pulseDuration) {
                if (!this.isRunning) break;
                await this._delay(50);
            }

            // CAPTURE PHASE
            this.status.textContent = `Point ${i + 1}/${points.length} - Hold...`;
            const captureStart = performance.now();
            let samplesThisPoint = 0;

            while (performance.now() - captureStart < this.captureDuration) {
                if (!this.isRunning) break;

                const results = await processFrame();
                if (results) {
                    const { features, blinkDetected } = this.gazeEstimator.extractFeatures(results);

                    if (features && !blinkDetected) {
                        this.features.push([...features]);
                        this.targets.push([pt.x, pt.y]);
                        samplesThisPoint++;
                    }
                }

                await this._delay(33);
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

        // Complete
        this.overlay.classList.add('hidden');
        this.isRunning = false;

        console.log(`Total samples collected: ${this.features.length}`);

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

    cancel() {
        this.isRunning = false;
        this._hideInstructions();
        this.overlay.classList.add('hidden');
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
