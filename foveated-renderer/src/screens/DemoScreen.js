/**
 * DemoScreen - 45-second timed demo with rendering and controls
 */

export class DemoScreen {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.onTimerEnd = null;
        this.onDebugToggle = null;

        this.timerInterval = null;
        this.remainingTime = 45;
        this.isRunning = false;
        this.isPaused = false;
        this.onPauseToggle = null;

        this._createLayout();
    }

    _createLayout() {
        this.container.innerHTML = `
            <div class="demo-screen">
                <canvas id="render-canvas"></canvas>
                
                <div class="demo-overlay">
                    <div class="timer-container">
                        <div class="timer-display" id="timer-display">
                            <span class="timer-icon">⏱️</span>
                            <span class="timer-value" id="timer-value">45</span>
                            <span class="timer-label">sec</span>
                        </div>
                        <button class="pause-button" id="pause-button" title="Pause/Resume">
                            <span class="pause-icon" id="pause-icon">⏸️</span>
                        </button>
                    </div>
                    
                    <div class="demo-controls">
                        <div class="control-group">
                            <label for="smoothing-slider">Smoothing</label>
                            <input type="range" id="smoothing-slider" min="0.1" max="1" step="0.1" value="0.4">
                            <span id="smoothing-value">0.4</span>
                        </div>
                        
                        <div class="control-group checkbox-group">
                            <input type="checkbox" id="show-heatmap">
                            <label for="show-heatmap">Show Compute Cost</label>
                        </div>
                        
                        <div class="control-group checkbox-group">
                            <input type="checkbox" id="show-gaze">
                            <label for="show-gaze">Show Gaze Point</label>
                        </div>
                        
                        <div class="control-group checkbox-group">
                            <input type="checkbox" id="debug-mode">
                            <label for="debug-mode">Debug Mode</label>
                        </div>
                        
                        <div class="control-group checkbox-group">
                            <input type="checkbox" id="extra-details">
                            <label for="extra-details">Extra Details</label>
                        </div>
                    </div>
                    
                    <div class="gaze-indicator" id="gaze-indicator">
                        <div class="gaze-dot"></div>
                    </div>
                </div>
            </div>
        `;

        // Get references
        this.canvas = document.getElementById('render-canvas');
        this.timerDisplay = document.getElementById('timer-display');
        this.timerValue = document.getElementById('timer-value');
        this.pauseButton = document.getElementById('pause-button');
        this.pauseIcon = document.getElementById('pause-icon');
        this.smoothingSlider = document.getElementById('smoothing-slider');
        this.smoothingValue = document.getElementById('smoothing-value');
        this.showHeatmap = document.getElementById('show-heatmap');
        this.showGaze = document.getElementById('show-gaze');
        this.debugMode = document.getElementById('debug-mode');
        this.extraDetails = document.getElementById('extra-details');
        this.gazeIndicator = document.getElementById('gaze-indicator');

        // Event listeners
        this.smoothingSlider.addEventListener('input', () => {
            this.smoothingValue.textContent = this.smoothingSlider.value;
        });

        this.pauseButton.addEventListener('click', () => {
            this.togglePause();
        });

        this.showGaze.addEventListener('change', () => {
            this.gazeIndicator.style.display = this.showGaze.checked ? 'block' : 'none';
        });

        this.debugMode.addEventListener('change', () => {
            if (this.onDebugToggle) {
                this.onDebugToggle(this.debugMode.checked);
            }
        });
    }

    /**
     * Get the render canvas
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Get smoothing value
     */
    getSmoothing() {
        return parseFloat(this.smoothingSlider.value);
    }

    /**
     * Check if heatmap should be shown
     */
    shouldShowHeatmap() {
        return this.showHeatmap.checked;
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugMode() {
        return this.debugMode.checked;
    }

    /**
     * Check if extra details should be shown
     */
    shouldShowExtraDetails() {
        return this.extraDetails.checked;
    }

    /**
     * Update gaze indicator position
     */
    updateGazePosition(x, y) {
        if (this.showGaze.checked) {
            this.gazeIndicator.style.left = `${x * 100}%`;
            this.gazeIndicator.style.top = `${y * 100}%`;
        }
    }

    /**
     * Start the 45-second timer
     */
    startTimer() {
        this.remainingTime = 45;
        this.isRunning = true;
        this.isPaused = false;
        this._updateTimerDisplay();
        this._updatePauseButton();

        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.remainingTime--;
                this._updateTimerDisplay();

                if (this.remainingTime <= 0) {
                    this.stopTimer();
                    if (this.onTimerEnd) {
                        this.onTimerEnd();
                    }
                }
            }
        }, 1000);
    }

    /**
     * Stop the timer
     */
    stopTimer() {
        this.isRunning = false;
        this.isPaused = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this._updatePauseButton();
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        if (!this.isRunning) return;

        this.isPaused = !this.isPaused;
        this._updatePauseButton();

        if (this.onPauseToggle) {
            this.onPauseToggle(this.isPaused);
        }
    }

    /**
     * Pause the timer
     */
    pauseTimer() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        this._updatePauseButton();

        if (this.onPauseToggle) {
            this.onPauseToggle(this.isPaused);
        }
    }

    /**
     * Resume the timer
     */
    resumeTimer() {
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this._updatePauseButton();

        if (this.onPauseToggle) {
            this.onPauseToggle(this.isPaused);
        }
    }

    /**
     * Check if timer is paused
     */
    isTimerPaused() {
        return this.isPaused;
    }

    _updatePauseButton() {
        if (this.pauseIcon) {
            this.pauseIcon.textContent = this.isPaused ? '▶️' : '⏸️';
        }
        if (this.pauseButton) {
            this.pauseButton.title = this.isPaused ? 'Resume' : 'Pause';
            this.pauseButton.classList.toggle('paused', this.isPaused);
        }
        if (this.timerDisplay) {
            this.timerDisplay.classList.toggle('paused', this.isPaused);
        }
    }

    _updateTimerDisplay() {
        this.timerValue.textContent = this.remainingTime;

        // Visual feedback when time is running out
        if (this.remainingTime <= 10) {
            this.timerDisplay.classList.add('warning');
        }
        if (this.remainingTime <= 5) {
            this.timerDisplay.classList.add('critical');
        }
    }

    /**
     * Get remaining time
     */
    getRemainingTime() {
        return this.remainingTime;
    }

    /**
     * Set callbacks
     */
    setOnTimerEnd(callback) {
        this.onTimerEnd = callback;
    }

    setOnDebugToggle(callback) {
        this.onDebugToggle = callback;
    }

    setOnPauseToggle(callback) {
        this.onPauseToggle = callback;
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
        this.stopTimer();
    }

    /**
     * Reset for new session
     */
    reset() {
        this.remainingTime = 45;
        this.isPaused = false;
        this.timerDisplay.classList.remove('warning', 'critical', 'paused');
        this._updateTimerDisplay();
        this._updatePauseButton();
        this.showHeatmap.checked = false;
        this.showGaze.checked = false;
        this.debugMode.checked = false;
        this.gazeIndicator.style.display = 'none';
    }
}
