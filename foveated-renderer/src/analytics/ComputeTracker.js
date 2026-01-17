 * ComputeTracker - Tracks rendering compute costs
    * Compares full - render baseline vs selective foveated rendering
        */

export class ComputeTracker {
    constructor() {
        // Constants for baseline calculation
        this.FULL_RENDER_STEPS = 80;       // Max steps per pixel at full quality
        this.PERIPHERAL_STEPS = 35;         // Min steps in periphery
        this.DEMO_DURATION_SEC = 45;
        this.TARGET_FPS = 60;

        // Full render uses uniform high detail (80 steps)
        this.FULL_RENDER_STEPS = 80;

        // Cumulative data
        this.frameStepCounts = [];
        this.isTracking = false;
    }

    /**
     * Start tracking compute cost for the session
     */
    startTracking() {
        this.frameStepCounts = [];
        this.isTracking = true;
    }

    /**
     * Record the Average Steps taken for a frame
     * @param {number} avgSteps Average raymarching steps for this frame
     */
    recordFrame(avgSteps) {
        if (!this.isTracking) return;
        this.frameStepCounts.push(avgSteps);
    }

    /**
     * Stop tracking compute cost
     */
    stopTracking() {
        this.isTracking = false;
    }

    /**
     * Get the full-render baseline cost
     * @returns {object} Cost metrics
     */
    getFullRenderCost() {
        const totalFrames = this.DEMO_DURATION_SEC * this.TARGET_FPS;
        const stepsPerFrame = this.FULL_RENDER_STEPS; // Uniform high quality
        const totalSteps = totalFrames * stepsPerFrame;

        return {
            totalFrames,
            avgStepsPerFrame: stepsPerFrame,
            totalSteps,
            label: 'Full Render'
        };
    }

    /**
     * Get the selective-render cost for this session
     * @returns {object} Cost metrics
     */
    getSelectiveRenderCost() {
        if (this.frameStepCounts.length === 0) {
            return {
                totalFrames: 0,
                avgStepsPerFrame: 0,
                totalSteps: 0,
                label: 'Selective Render'
            };
        }

        const totalFrames = this.frameStepCounts.length;
        const totalSteps = this.frameStepCounts.reduce((a, b) => a + b, 0);
        const avgStepsPerFrame = totalSteps / totalFrames;

        return {
            totalFrames,
            avgStepsPerFrame,
            totalSteps,
            label: 'Selective Render'
        };
    }

    /**
     * Calculate savings percentage
     * @returns {number} Percentage (0-100)
     */
    calculateSavings() {
        const baseline = this.getFullRenderCost().totalSteps;
        const selective = this.getSelectiveRenderCost().totalSteps;

        if (baseline === 0) return 0;

        // Savings = (Baseline - Selective) / Baseline
        const rawSavings = (baseline - selective) / baseline;
        return Math.max(0, rawSavings * 100);
    }

    /**
     * Format a large number for display
     * @param {number} num 
     */
    formatSteps(num) {
        return new Intl.NumberFormat().format(Math.round(num));
    }

    /**
     * Get session summary for export
     */
    getSessionSummary() {
        const baseline = this.getFullRenderCost();
        const selective = this.getSelectiveRenderCost();
        const savings = this.calculateSavings();

        return {
            timestamp: new Date().toISOString(),
            duration: this.DEMO_DURATION_SEC,
            baseline: {
                totalSteps: baseline.totalSteps,
                avgSteps: baseline.avgStepsPerFrame
            },
            adaptive: {
                totalSteps: selective.totalSteps,
                avgSteps: selective.avgStepsPerFrame
            },
            savingsPercentage: savings.toFixed(1) + '%'
        };
    }
}
```
