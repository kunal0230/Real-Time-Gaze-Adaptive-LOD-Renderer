/**
 * HomeScreen - Landing page with camera preview, face guide, and instructions
 */

export class HomeScreen {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.onStart = null; // Callback when user clicks start
        this.faceReady = false;

        this._createLayout();
    }

    _createLayout() {
        this.container.innerHTML = `
            <div class="home-screen">
                <header class="home-header">
                    <h1>Gaze-Controlled Foveated Rendering</h1>
                    <p class="subtitle">Experience game-style Level of Detail based on where you look</p>
                </header>
                
                <div class="home-content">
                    <div class="camera-section">
                        <div class="camera-preview" id="camera-preview">
                            <video id="home-video" autoplay playsinline muted></video>
                            <div class="camera-placeholder">
                                <div class="camera-icon">Camera</div>
                                <p>Camera initializing...</p>
                            </div>
                        </div>
                        <button class="start-button" id="start-btn" disabled>
                            <span class="btn-icon"></span>
                            Start Calibration
                        </button>
                    </div>
                    
                    <div class="instructions-section">
                        <div class="instruction-card">
                            <h3>How It Works</h3>
                            <p>This demo uses your webcam to track where you're looking. The 3D scene 
                            renders <strong>high detail where you look</strong> and 
                            <strong>lower detail in your peripheral vision</strong> — just like how 
                            your eyes actually work!</p>
                            <p class="highlight">This technique can save up to <strong>50% compute cost</strong> 
                            while maintaining perceived visual quality.</p>
                        </div>
                        
                        <div class="instruction-card dos-donts">
                            <div class="do-col">
                                <h4>Do's</h4>
                                <ul>
                                    <li>Use good, even lighting</li>
                                    <li>Face the camera directly</li>
                                    <li>Keep your head relatively still</li>
                                    <li>Position face in the guide oval</li>
                                    <li>Look at different parts of the scene</li>
                                </ul>
                            </div>
                            <div class="dont-col">
                                <h4>Don'ts</h4>
                                <ul>
                                    <li>Strong backlighting</li>
                                    <li>Multiple faces in frame</li>
                                    <li>Extreme head angles</li>
                                    <li>Glasses with heavy glare</li>
                                    <li>Moving around excessively</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="instruction-card demo-info">
                            <h4>Demo Duration</h4>
                            <p>The interactive demo runs for <strong>45 seconds</strong>. 
                            Look around the scene to explore the forest landscape. 
                            After the demo, you'll see analytics comparing compute costs.</p>
                        </div>
                    </div>
                </div>
                
                <footer class="home-footer">
                    <p>Built with WebGL2 • MediaPipe Face Mesh • Ridge Regression</p>
                </footer>
            </div>
        `;

        // Get references
        this.video = document.getElementById('home-video');
        this.startBtn = document.getElementById('start-btn');
        this.cameraPreview = document.getElementById('camera-preview');

        // Button click handler
        this.startBtn.addEventListener('click', () => {
            if (this.onStart && this.faceReady) {
                this.onStart();
            }
        });
    }

    /**
     * Get video element for camera stream
     */
    getVideoElement() {
        return this.video;
    }

    /**
     * Get camera preview container for face guide
     */
    getCameraContainer() {
        return this.cameraPreview;
    }

    /**
     * Update face detection status
     * @param {boolean} detected - Whether face is detected
     * @param {boolean} ready - Whether face is in good position
     */
    updateFaceStatus(detected, ready) {
        this.faceReady = ready;
        this.startBtn.disabled = !ready;

        if (ready) {
            this.startBtn.classList.add('ready');
        } else {
            this.startBtn.classList.remove('ready');
        }
    }

    /**
     * Show camera is active
     */
    showCameraActive() {
        const placeholder = this.container.querySelector('.camera-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    /**
     * Set callback for start button
     */
    setOnStart(callback) {
        this.onStart = callback;
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
}
