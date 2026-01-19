/**
 * HomeScreen - Professional layout with calibration info and performance disclaimer
 */

import { SceneCard } from '../components/SceneCard.js';
import { CosmicOrbs } from '../scenes/CosmicOrbs.js';
import { CrystalGrid } from '../scenes/CrystalGrid.js';
import { ForestValley } from '../scenes/ForestValley.js';

export class HomeScreen {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.onStart = null;
        this.onTutorial = null;
        this.faceReady = false;

        this.scenes = [
            new CosmicOrbs(),
            new CrystalGrid(),
            new ForestValley()
        ];
        this.selectedScene = this.scenes[0];
        this.sceneCards = [];

        this._createLayout();
    }

    _createLayout() {
        this.container.innerHTML = `
            <div class="home-screen compact">
                <header class="home-header">
                    <div class="header-content">
                        <h1>Gaze-Adaptive Rendering</h1>
                        <p class="subtitle">Real-time Level of Detail based on eye tracking</p>
                    </div>
                    <div class="header-actions">
                        <span class="renderer-badge" id="renderer-badge">WebGL2</span>
                        <button class="tutorial-btn" id="tutorial-btn">
                            <span class="icon">?</span>
                            Guide
                        </button>
                    </div>
                </header>
                
                <div class="home-content compact">
                    <section class="left-panel">
                        <div class="scene-section compact">
                            <h2>Select Scene</h2>
                            <div class="scene-grid compact" id="scene-grid"></div>
                        </div>
                        
                        <div class="info-section">
                            <div class="info-card calibration-info">
                                <h3>Calibration</h3>
                                <p>You will see 9 dots appear on screen. <strong>Look directly at each dot</strong> until it moves. Keep your head still and only move your eyes.</p>
                            </div>
                            
                            <div class="info-card performance-note">
                                <h3>Performance Note</h3>
                                <p>This demo uses real-time raymarching which requires GPU power. If you experience lag, try <strong>Cosmic Orbs</strong>.</p>
                            </div>
                        </div>
                        
                        <div class="action-section">
                            <div class="camera-status" id="camera-status">
                                <span class="status-dot"></span>
                                <span class="status-text">Position face in the camera</span>
                            </div>
                            <button class="start-button" id="start-btn" disabled>
                                Start Calibration
                            </button>
                        </div>
                    </section>
                    
                    <section class="camera-section compact">
                        <div class="camera-preview" id="camera-preview">
                            <video id="home-video" autoplay playsinline muted></video>
                            <div class="camera-placeholder">
                                <div class="spinner"></div>
                                <p>Initializing camera...</p>
                            </div>
                            
                            <!-- Stats Overlay -->
                            <div class="stats-overlay">
                                <div class="stat-pill">
                                    <span class="stat-icon">📷</span>
                                    <span id="stat-resolution">loading...</span>
                                </div>
                                <div class="stat-pill">
                                    <span class="stat-icon">⚡</span>
                                    <span id="stat-fps">--</span> Hz
                                </div>
                            </div>
                        </div>
                        <div class="requirements-list">
                            <div class="req-item">
                                <span class="req-icon check">&#10003;</span>
                                <span>Good lighting</span>
                            </div>
                            <div class="req-item">
                                <span class="req-icon check">&#10003;</span>
                                <span>Face camera</span>
                            </div>
                            <div class="req-item">
                                <span class="req-icon check">&#10003;</span>
                                <span>Head still</span>
                            </div>
                        </div>
                    </section>
                </div>
                
                <footer class="home-footer compact">
                    <p>Built with WebGL2, MediaPipe Face Mesh, and Ridge Regression | Demo runs for 45 seconds</p>
                </footer>
            </div>
        `;

        const sceneGrid = document.getElementById('scene-grid');
        this.scenes.forEach((scene, index) => {
            const card = new SceneCard(scene, (selectedScene) => {
                this._selectScene(selectedScene);
            });
            this.sceneCards.push(card);
            sceneGrid.appendChild(card.getElement());

            if (index === 0) {
                card.setSelected(true);
            }
        });

        this.video = document.getElementById('home-video');
        this.startBtn = document.getElementById('start-btn');
        this.cameraPreview = document.getElementById('camera-preview');
        this.cameraStatus = document.getElementById('camera-status');
        this.tutorialBtn = document.getElementById('tutorial-btn');
        this.rendererBadge = document.getElementById('renderer-badge');

        this.statResolution = document.getElementById('stat-resolution');
        this.statFps = document.getElementById('stat-fps');
        this.statConfidence = document.getElementById('stat-confidence');

        this.startBtn.addEventListener('click', () => {
            if (this.onStart && this.faceReady) {
                this.onStart(this.selectedScene);
            }
        });

        this.tutorialBtn.addEventListener('click', () => {
            if (this.onTutorial) this.onTutorial();
        });

        this._checkRendererSupport();
    }

    async _checkRendererSupport() {
        if (navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    this.rendererBadge.textContent = 'WebGPU';
                    this.rendererBadge.classList.add('webgpu');
                    return;
                }
            } catch (e) {
                // Fall through
            }
        }
        this.rendererBadge.textContent = 'WebGL2';
        this.rendererBadge.classList.add('webgl');
    }

    _selectScene(scene) {
        this.selectedScene = scene;
        this.sceneCards.forEach(card => {
            card.setSelected(card.scene === scene);
        });
    }

    getVideoElement() {
        return this.video;
    }

    getCameraContainer() {
        return this.cameraPreview;
    }

    getSelectedScene() {
        return this.selectedScene;
    }

    updateFaceStatus(detected, ready) {
        this.faceReady = ready;
        this.startBtn.disabled = !ready;

        const statusDot = this.cameraStatus.querySelector('.status-dot');
        const statusText = this.cameraStatus.querySelector('.status-text');

        // Update Stats Card Confidence
        if (this.statConfidence) {
            this.statConfidence.textContent = detected ? 'Detected' : 'Searching';
            this.statConfidence.className = `stat-value ${detected ? 'good' : 'bad'}`;
        }

        if (ready) {
            this.startBtn.classList.add('ready');
            statusDot.classList.add('ready');
            statusText.textContent = 'Ready to calibrate';
        } else if (detected) {
            this.startBtn.classList.remove('ready');
            statusDot.classList.remove('ready');
            statusDot.classList.add('detected');
            statusText.textContent = 'Adjust position';
        } else {
            this.startBtn.classList.remove('ready');
            statusDot.classList.remove('ready', 'detected');
            statusText.textContent = 'Looking for face...';
        }
    }

    showCameraActive() {
        const placeholder = this.container.querySelector('.camera-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    setOnStart(callback) {
        this.onStart = callback;
    }

    setOnTutorial(callback) {
        this.onTutorial = callback;
    }

    updateStats(fps, width, height) {
        if (this.statFps) {
            this.statFps.textContent = Math.round(fps);
            // Color code FPS
            if (fps > 50) this.statFps.className = 'stat-value good';
            else if (fps > 30) this.statFps.className = 'stat-value ok';
            else this.statFps.className = 'stat-value bad';
        }

        if (this.statResolution && width && height) {
            this.statResolution.textContent = `${width}x${height}`;
        }
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }
}
