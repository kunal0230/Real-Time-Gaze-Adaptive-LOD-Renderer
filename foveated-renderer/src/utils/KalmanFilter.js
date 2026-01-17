/**
 * 1D Kalman Filter for gaze smoothing.
 */
export class KalmanFilter {
    constructor(options = {}) {
        // Process noise (how much we trust our prediction)
        this.Q = options.Q || 0.1;
        // Measurement noise (how much we trust measurements)
        this.R = options.R || 1.0;

        // State estimate
        this.x = 0;
        // Error covariance
        this.P = 1;

        this.initialized = false;
    }

    /**
     * Update filter with new measurement
     * @param {number} measurement - New measurement value
     * @returns {number} - Filtered value
     */
    update(measurement) {
        if (!this.initialized) {
            this.x = measurement;
            this.initialized = true;
            return this.x;
        }

        // Prediction step
        const xPred = this.x;
        const pPred = this.P + this.Q;

        // Update step
        const K = pPred / (pPred + this.R);
        this.x = xPred + K * (measurement - xPred);
        this.P = (1 - K) * pPred;

        return this.x;
    }

    /**
     * Reset the filter state
     */
    reset() {
        this.x = 0;
        this.P = 1;
        this.initialized = false;
    }
}

/**
 * 2D Kalman Filter for (x, y) gaze coordinates
 */
export class KalmanFilter2D {
    constructor(options = {}) {
        this.filterX = new KalmanFilter(options);
        this.filterY = new KalmanFilter(options);
    }

    /**
     * Update filter with new (x, y) measurement
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number[]} - Filtered [x, y]
     */
    update(x, y) {
        return [
            this.filterX.update(x),
            this.filterY.update(y),
        ];
    }

    reset() {
        this.filterX.reset();
        this.filterY.reset();
    }
}
