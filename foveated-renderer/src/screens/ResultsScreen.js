/**
 * ResultsScreen - Analytics and comparison after demo ends
 */

export class ResultsScreen {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.onRestart = null;

        this._createLayout();
    }

    _createLayout() {
        this.container.innerHTML = `
            <div class="results-screen">
                <header class="results-header">
                    <h1>📊 Session Analytics</h1>
                    <p class="subtitle">Here's how foveated rendering saved compute resources</p>
                </header>
                
                <div class="results-content">
                    <div class="comparison-section">
                        <div class="cost-card full-render">
                            <div class="cost-icon">🖥️</div>
                            <h3>Full Render</h3>
                            <p class="cost-description">Uniform high quality everywhere</p>
                            <div class="cost-value" id="full-render-cost">--</div>
                            <div class="cost-unit">compute units</div>
                            <div class="cost-details">
                                <span id="full-render-steps">80</span> steps × <span id="full-render-frames">2700</span> frames
                            </div>
                        </div>
                        
                        <div class="vs-indicator">VS</div>
                        
                        <div class="cost-card selective-render">
                            <div class="cost-icon">👁️</div>
                            <h3>Selective Render</h3>
                            <p class="cost-description">High detail only where you looked</p>
                            <div class="cost-value" id="selective-render-cost">--</div>
                            <div class="cost-unit">compute units</div>
                            <div class="cost-details">
                                Avg <span id="selective-avg-steps">--</span> steps × <span id="selective-frames">--</span> frames
                            </div>
                        </div>
                    </div>
                    
                    <div class="savings-section">
                        <h3>💰 Compute Savings</h3>
                        <div class="savings-bar-container">
                            <div class="savings-bar" id="savings-bar"></div>
                            <div class="savings-percentage" id="savings-percentage">0%</div>
                        </div>
                        <p class="savings-description" id="savings-description">
                            You saved <strong id="savings-value">0%</strong> of compute resources 
                            by using gaze-controlled foveated rendering!
                        </p>
                    </div>
                    
                    <div class="session-details">
                        <h4>Session Details</h4>
                        <div class="details-grid">
                            <div class="detail-item">
                                <span class="detail-label">Duration</span>
                                <span class="detail-value" id="session-duration">45s</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Frames Captured</span>
                                <span class="detail-value" id="frames-captured">--</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Avg FPS</span>
                                <span class="detail-value" id="avg-fps">--</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">LOD Variation</span>
                                <span class="detail-value" id="lod-variation">High</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <button class="try-again-btn" id="try-again-btn">
                            🔄 Try Again
                        </button>
                    </div>
                </div>
                
                <footer class="results-footer">
                    <p>This demo illustrates the concept of selective rendering for VR/AR applications</p>
                </footer>
            </div>
        `;

        // Get references
        this.fullRenderCost = document.getElementById('full-render-cost');
        this.fullRenderSteps = document.getElementById('full-render-steps');
        this.fullRenderFrames = document.getElementById('full-render-frames');
        this.selectiveRenderCost = document.getElementById('selective-render-cost');
        this.selectiveAvgSteps = document.getElementById('selective-avg-steps');
        this.selectiveFrames = document.getElementById('selective-frames');
        this.savingsBar = document.getElementById('savings-bar');
        this.savingsPercentage = document.getElementById('savings-percentage');
        this.savingsValue = document.getElementById('savings-value');
        this.sessionDuration = document.getElementById('session-duration');
        this.framesCaptured = document.getElementById('frames-captured');
        this.avgFps = document.getElementById('avg-fps');
        this.tryAgainBtn = document.getElementById('try-again-btn');

        // Event listener
        this.tryAgainBtn.addEventListener('click', () => {
            if (this.onRestart) {
                this.onRestart();
            }
        });
    }

    /**
     * Update with analytics data
     * @param {object} summary - Analytics summary from ComputeTracker
     */
    updateAnalytics(summary) {
        const { fullRender, selectiveRender, savingsPercent, sessionDurationSec, framesCaptured } = summary;

        // Full render
        this.fullRenderCost.textContent = fullRender.computeUnits.toLocaleString();
        this.fullRenderSteps.textContent = fullRender.avgStepsPerFrame;
        this.fullRenderFrames.textContent = fullRender.totalFrames.toLocaleString();

        // Selective render
        this.selectiveRenderCost.textContent = selectiveRender.computeUnits.toLocaleString();
        this.selectiveAvgSteps.textContent = selectiveRender.avgStepsPerFrame;
        this.selectiveFrames.textContent = selectiveRender.totalFrames.toLocaleString();

        // Savings
        const savingsClamp = Math.max(0, Math.min(100, savingsPercent));
        this.savingsBar.style.width = `${savingsClamp}%`;
        this.savingsPercentage.textContent = `${savingsClamp}%`;
        this.savingsValue.textContent = `${savingsClamp}%`;

        // Style based on savings level
        if (savingsClamp >= 40) {
            this.savingsBar.classList.add('high-savings');
        } else if (savingsClamp >= 20) {
            this.savingsBar.classList.add('medium-savings');
        } else {
            this.savingsBar.classList.add('low-savings');
        }

        // Session details
        this.sessionDuration.textContent = `${sessionDurationSec}s`;
        this.framesCaptured.textContent = framesCaptured.toLocaleString();
        this.avgFps.textContent = framesCaptured > 0
            ? Math.round(framesCaptured / sessionDurationSec)
            : '--';
    }

    /**
     * Set restart callback
     */
    setOnRestart(callback) {
        this.onRestart = callback;
    }

    /**
     * Show the screen
     */
    show() {
        this.container.style.display = 'block';
    }

    /**
     * Hide the screen
     */
    hide() {
        this.container.style.display = 'none';
    }

    /**
     * Reset state
     */
    reset() {
        this.savingsBar.style.width = '0%';
        this.savingsBar.classList.remove('high-savings', 'medium-savings', 'low-savings');
    }
}
