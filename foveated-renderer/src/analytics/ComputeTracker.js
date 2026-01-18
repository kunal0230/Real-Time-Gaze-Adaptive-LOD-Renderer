/**
 * Tracks rendering compute costs.
 * Compares full-render baseline vs selective foveated rendering.
 * Uses same frame count for both to ensure fair comparison.
 */
export class ComputeTracker {
    constructor() {
        // Constants for baseline calculation
        this.FULL_RENDER_STEPS = 80;       // Max steps per pixel at full quality
        this.PERIPHERAL_STEPS = 35;         // Min steps in periphery
        this.DEMO_DURATION_SEC = 45;

        // Cumulative data
        this.frameStepCounts = [];
        this.isTracking = false;
    }

    /**
     * Start tracking compute cost for the session
     */
    startSession(width, height) {
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
    endSession() {
        this.isTracking = false;
    }

    /**
     * Get the full-render baseline cost
     * Uses ACTUAL frames captured, not theoretical FPS
     * @returns {object} Cost metrics
     */
    getFullRenderCost() {
        // Use actual frame count for fair comparison
        const totalFrames = this.frameStepCounts.length || 1;
        const stepsPerFrame = this.FULL_RENDER_STEPS;
        const computeUnits = totalFrames * stepsPerFrame;

        return {
            totalFrames,
            avgStepsPerFrame: stepsPerFrame,
            computeUnits,
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
                computeUnits: 0,
                label: 'Selective Render'
            };
        }

        const totalFrames = this.frameStepCounts.length;
        const totalSteps = this.frameStepCounts.reduce((a, b) => a + b, 0);
        const avgStepsPerFrame = totalSteps / totalFrames;

        return {
            totalFrames,
            avgStepsPerFrame: Math.round(avgStepsPerFrame),
            computeUnits: Math.round(totalSteps),
            label: 'Selective Render'
        };
    }

    /**
     * Get session summary for the results screen
     */
    getSummary() {
        const fullRender = this.getFullRenderCost();
        const selectiveRender = this.getSelectiveRenderCost();

        // Calculate savings percentage (now fair comparison)
        let savingsPercent = 0;
        if (fullRender.computeUnits > 0) {
            savingsPercent = ((fullRender.computeUnits - selectiveRender.computeUnits) / fullRender.computeUnits) * 100;
        }

        // Calculate actual session duration based on frames
        const actualDuration = this.frameStepCounts.length > 0
            ? Math.min(this.DEMO_DURATION_SEC, Math.ceil(this.frameStepCounts.length / 30))
            : this.DEMO_DURATION_SEC;

        return {
            fullRender,
            selectiveRender,
            savingsPercent: Math.round(savingsPercent),
            sessionDurationSec: actualDuration,
            framesCaptured: selectiveRender.totalFrames
        };
    }

    /**
     * Format a large number for display
     * @param {number} num 
     */
    formatSteps(num) {
        return new Intl.NumberFormat().format(Math.round(num));
    }
}
