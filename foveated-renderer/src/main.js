/**
 * Foveated Renderer - Main Application
 * Multi-screen architecture with Home → Calibration → Demo → Results flow
 */

import { GazeEstimator } from './eye-tracking/GazeEstimator.js';
import { CalibrationUI } from './calibration/CalibrationUI.js';
import { RaymarchingRenderer } from './renderer/RaymarchingRenderer.js';
import { KalmanFilter2D } from './utils/KalmanFilter.js';

// New components
import { HomeScreen } from './screens/HomeScreen.js';
import { DemoScreen } from './screens/DemoScreen.js';
import { ResultsScreen } from './screens/ResultsScreen.js';
import { FaceGuide } from './components/FaceGuide.js';
import { DebugPanel } from './components/DebugPanel.js';
import { ComputeTracker } from './analytics/ComputeTracker.js';

// Screen states
const SCREENS = {
    HOME: 'home',
    CALIBRATION: 'calibration',
    DEMO: 'demo',
    RESULTS: 'results'
};

class App {
    constructor() {
        // Current screen
        this.currentScreen = SCREENS.HOME;

        // Screen instances
        this.homeScreen = new HomeScreen('home-screen');
        this.demoScreen = new DemoScreen('demo-screen');
        this.resultsScreen = new ResultsScreen('results-screen');

        // Components
        this.faceGuide = null;
        this.debugPanel = new DebugPanel();
        this.computeTracker = new ComputeTracker();

        // Core systems
        this.gazeEstimator = null;
        this.calibrationUI = null;
        this.renderer = null;
        this.kalmanFilter = new KalmanFilter2D({ Q: 0.5, R: 0.4 }); // Default smoothing 0.4

        // Media
        this.video = null;
        this.stream = null;

        // State
        this.isRunning = false;
        this.isCalibrating = false;
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsTime = performance.now();
        this.lastLandmarks = null;

        // Gaze position
        this.gazeX = 0.5;
        this.gazeY = 0.5;

        this._init();
    }

    async _init() {
        // Set up screen callbacks
        this.homeScreen.setOnStart(() => this._startCalibration());
        this.demoScreen.setOnTimerEnd(() => this._endDemo());
        this.demoScreen.setOnDebugToggle((show) => {
            if (show) this.debugPanel.show();
            else this.debugPanel.hide();
        });
        this.resultsScreen.setOnRestart(() => this._restartFromHome());

        // Show home screen initially
        this._showScreen(SCREENS.HOME);

        // Initialize camera immediately for face preview
        await this._initCamera();
    }

    async _initCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            // Set up video for home screen
            this.video = this.homeScreen.getVideoElement();
            this.video.srcObject = this.stream;
            await this.video.play();
            this.homeScreen.showCameraActive();

            // Initialize gaze estimator for face detection
            this.gazeEstimator = new GazeEstimator();
            await this.gazeEstimator.initialize();

            // Set up face guide overlay
            this.faceGuide = new FaceGuide('camera-preview');

            // Start face detection loop
            this._startFaceDetectionLoop();

        } catch (error) {
            console.error('Camera initialization failed:', error);
        }
    }

    _startFaceDetectionLoop() {
        const detectFace = async () => {
            if (this.currentScreen !== SCREENS.HOME) {
                requestAnimationFrame(detectFace);
                return;
            }

            if (this.video && this.gazeEstimator) {
                const results = await this.gazeEstimator.processFrame(this.video);

                if (results?.multiFaceLandmarks?.[0]) {
                    this.lastLandmarks = results.multiFaceLandmarks[0];
                    this.faceGuide.updateFace(this.lastLandmarks);
                    this.homeScreen.updateFaceStatus(true, this.faceGuide.isReady());
                } else {
                    this.faceGuide.updateFace(null);
                    this.homeScreen.updateFaceStatus(false, false);
                }

                this.faceGuide.render();
            }

            requestAnimationFrame(detectFace);
        };

        detectFace();
    }

    async _startCalibration() {
        this._showScreen(SCREENS.CALIBRATION);
        this.isCalibrating = true;

        // Create calibration UI
        this.calibrationUI = new CalibrationUI(this.gazeEstimator);

        const processFrame = async () => {
            return await this.gazeEstimator.processFrame(this.video);
        };

        this.calibrationUI.onComplete = (success) => {
            this.isCalibrating = false;

            if (success) {
                this.gazeEstimator.saveModel();
                this._startDemo();
            } else {
                this._showScreen(SCREENS.HOME);
            }
        };

        await this.calibrationUI.start(processFrame);
    }

    _startDemo() {
        this._showScreen(SCREENS.DEMO);

        // Initialize renderer on demo canvas
        const canvas = this.demoScreen.getCanvas();
        this.renderer = new RaymarchingRenderer(canvas);
        this.renderer.resize();

        // Reset demo screen
        this.demoScreen.reset();

        // Start analytics tracking
        this.computeTracker.startSession(canvas.width, canvas.height);

        // Start timer
        this.demoScreen.startTimer();

        // Update smoothing from slider
        const smoothing = this.demoScreen.getSmoothing();
        this.kalmanFilter.filterX.R = smoothing;
        this.kalmanFilter.filterY.R = smoothing;
        this.kalmanFilter.reset();

        // Start render loop
        this.isRunning = true;
        this._renderLoop();
    }

    async _renderLoop() {
        if (!this.isRunning || this.currentScreen !== SCREENS.DEMO) return;

        // Process frame for gaze
        const results = await this.gazeEstimator.processFrame(this.video);

        let avgSteps = 50; // Default for analytics

        if (results && this.gazeEstimator.isTrained()) {
            const { features, blinkDetected } = this.gazeEstimator.extractFeatures(results);
            this.lastLandmarks = results.multiFaceLandmarks?.[0] || null;

            if (features && !blinkDetected) {
                const [rawX, rawY] = this.gazeEstimator.predict(features);

                // Update smoothing from slider
                const smoothing = this.demoScreen.getSmoothing();
                this.kalmanFilter.filterX.R = smoothing;
                this.kalmanFilter.filterY.R = smoothing;

                const [smoothX, smoothY] = this.kalmanFilter.update(rawX, rawY);

                this.gazeX = Math.max(0, Math.min(1, smoothX / window.innerWidth));
                this.gazeY = Math.max(0, Math.min(1, smoothY / window.innerHeight));

                this.renderer.setGazePoint(this.gazeX, this.gazeY);
                this.demoScreen.updateGazePosition(this.gazeX, this.gazeY);

                // Calculate LOD level for analytics
                const foveaFactor = Math.min(1, Math.sqrt(
                    Math.pow(this.gazeX - 0.5, 2) + Math.pow(this.gazeY - 0.5, 2)
                ) * 3);
                avgSteps = 80 - foveaFactor * 45; // 80 steps center → 35 periphery
            }
        }

        // Update renderer settings
        this.renderer.setHeatmap(this.demoScreen.shouldShowHeatmap());

        // Render frame
        this.renderer.render();

        // Track compute cost
        this.computeTracker.recordFrame(avgSteps);

        // Update debug panel if visible
        if (this.debugPanel.isVisible()) {
            // Calculate FPS
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastFpsTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFpsTime = now;
            }

            this.debugPanel.updateStats({
                fps: this.fps,
                gazeX: this.gazeX,
                gazeY: this.gazeY,
                lodLevel: Math.min(1, Math.sqrt(
                    Math.pow(this.gazeX - 0.5, 2) + Math.pow(this.gazeY - 0.5, 2)
                ) * 3),
                avgSteps: avgSteps,
                eyeOpenness: 1.0,
                calibrationScore: 85,
                faceDetected: !!this.lastLandmarks
            });

            this.debugPanel.drawVideoWithLandmarks(this.video, this.lastLandmarks);
        }

        requestAnimationFrame(() => this._renderLoop());
    }

    _endDemo() {
        this.isRunning = false;
        this.debugPanel.hide();

        // End analytics tracking
        this.computeTracker.endSession();

        // Get analytics summary
        const summary = this.computeTracker.getSummary();
        console.log('Session Analytics:', summary);

        // Show results
        this._showScreen(SCREENS.RESULTS);
        this.resultsScreen.updateAnalytics(summary);
    }

    _restartFromHome() {
        this.resultsScreen.reset();
        this._showScreen(SCREENS.HOME);

        // Reset Kalman filter
        this.kalmanFilter.reset();
    }

    _showScreen(screen) {
        // Hide all screens
        this.homeScreen.hide();
        this.demoScreen.hide();
        this.resultsScreen.hide();

        // Hide calibration overlay if exists
        const calibrationOverlay = document.getElementById('calibration-overlay');
        if (calibrationOverlay) {
            calibrationOverlay.style.display = screen === SCREENS.CALIBRATION ? 'block' : 'none';
        }

        // Show requested screen
        this.currentScreen = screen;

        switch (screen) {
            case SCREENS.HOME:
                this.homeScreen.show();
                break;
            case SCREENS.CALIBRATION:
                // Calibration uses overlay
                break;
            case SCREENS.DEMO:
                this.demoScreen.show();
                break;
            case SCREENS.RESULTS:
                this.resultsScreen.show();
                break;
        }
    }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
