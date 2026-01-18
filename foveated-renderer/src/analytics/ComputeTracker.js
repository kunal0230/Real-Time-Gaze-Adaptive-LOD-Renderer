/**
 * ComputeTracker - Analytics module for tracking rendering compute costs
 * Compares full-render baseline vs selective foveated rendering
 */

export class ComputeTracker {
    constructor() {
        // Constants for baseline calculation
        this.FULL_RENDER_STEPS = 80;       // Max steps per pixel at full quality
        this.PERIPHERAL_STEPS = 35;         // Min steps in periphery
        this.DEMO_DURATION_SEC = 45;
        this.TARGET_FPS = 60;

        // Session tracking
        this.frameStepCounts = [];          // Array of average steps per frame
        this.sessionStartTime = null;
        this.sessionEndTime = null;
        this.isTracking = false;

        // Estimated pixels (will be set based on resolution)
        this.pixelCount = 1920 * 1080;      // Default, updated at runtime
    }

    /**
     * Start a new tracking session
     */
    startSession(width = 1920, height = 1080) {
        this.frameStepCounts = [];
        this.pixelCount = width * height;
        this.sessionStartTime = Date.now();
        this.sessionEndTime = null;
        this.isTracking = true;
    }

    /**
     * Record compute cost for a single frame
     * @param {number} avgSteps - Average step count per pixel for this frame
     */
    recordFrame(avgSteps) {
        if (!this.isTracking) return;
        this.frameStepCounts.push(avgSteps);
    }

    /**
     * End the current tracking session
     */
    endSession() {
        this.sessionEndTime = Date.now();
        this.isTracking = false;
    }

    /**
     * Get the static full-render baseline cost
     * This is constant since we know the scene and duration
     * @returns {object} Cost metrics
     */
    getFullRenderCost() {
        const totalFrames = this.DEMO_DURATION_SEC * this.TARGET_FPS;
        const stepsPerFrame = this.FULL_RENDER_STEPS; // Uniform high quality
        const totalSteps = totalFrames * stepsPerFrame;

        return {
            totalFrames,
            avgStepsPerFrame: this.FULL_RENDER_STEPS,
            totalSteps,
            // Normalized "compute units" for comparison
            computeUnits: totalSteps
        };
    }

    /**
     * Get the dynamic selective-render cost for this session
     * This varies based on where the user looked
     * @returns {object} Cost metrics
     */
    getSelectiveRenderCost() {
        if (this.frameStepCounts.length === 0) {
            return {
                totalFrames: 0,
                avgStepsPerFrame: 0,
                totalSteps: 0,
                computeUnits: 0
            };
        }

        const totalFrames = this.frameStepCounts.length;
        const totalSteps = this.frameStepCounts.reduce((sum, steps) => sum + steps, 0);
        const avgStepsPerFrame = totalSteps / totalFrames;

        return {
            totalFrames,
            avgStepsPerFrame: Math.round(avgStepsPerFrame * 10) / 10,
            totalSteps: Math.round(totalSteps),
            computeUnits: Math.round(totalSteps)
        };
    }

    /**
     * Get savings percentage
     * @returns {number} Percentage saved (0-100)
     */
    getSavingsPercent() {
        const full = this.getFullRenderCost();
        const selective = this.getSelectiveRenderCost();

        if (full.computeUnits === 0) return 0;

        // Normalize to same frame count for fair comparison
        const normalizedSelective = (selective.avgStepsPerFrame / this.FULL_RENDER_STEPS) * 100;
        const savings = 100 - normalizedSelective;

        return Math.round(savings * 10) / 10; // One decimal place
    }

    /**
     * Get session duration in seconds
     */
    getSessionDuration() {
        if (!this.sessionStartTime) return 0;
        const endTime = this.sessionEndTime || Date.now();
        return (endTime - this.sessionStartTime) / 1000;
    }

    /**
     * Get detailed analytics summary
     */
    getSummary() {
        const full = this.getFullRenderCost();
        const selective = this.getSelectiveRenderCost();
        const savings = this.getSavingsPercent();

        return {
            fullRender: full,
            selectiveRender: selective,
            savingsPercent: savings,
            sessionDurationSec: Math.round(this.getSessionDuration() * 10) / 10,
            framesCaptured: this.frameStepCounts.length
        };
    }
}
