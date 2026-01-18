/**
 * Foveated Renderer - Main Application
 * Multi-screen architecture with scene selection and tutorial
 */

import { GazeEstimator } from './eye-tracking/GazeEstimator.js';
import { CalibrationUI } from './calibration/CalibrationUI.js';
import { SceneRenderer } from './renderer/SceneRenderer.js';
import { KalmanFilter2D } from './utils/KalmanFilter.js';

// Screens
import { HomeScreen } from './screens/HomeScreen.js';
import { DemoScreen } from './screens/DemoScreen.js';
import { ResultsScreen } from './screens/ResultsScreen.js';

// Components
import { FaceGuide } from './components/FaceGuide.js';
import { DebugPanel } from './components/DebugPanel.js';
import { TutorialModal } from './components/TutorialModal.js';
import { ComputeTracker } from './analytics/ComputeTracker.js';

const SCREENS = {
    HOME: 'home',
    CALIBRATION: 'calibration',
    DEMO: 'demo',
    RESULTS: 'results'
};

class App {
    constructor() {
        this.currentScreen = SCREENS.HOME;

        // Screens
        this.homeScreen = new HomeScreen('home-screen');
        this.demoScreen = new DemoScreen('demo-screen');
        this.resultsScreen = new ResultsScreen('results-screen');

        // Components
        this.faceGuide = null;
        this.debugPanel = new DebugPanel();
        this.tutorialModal = new TutorialModal();
        this.computeTracker = new ComputeTracker();

        // Core systems
        this.gazeEstimator = null;
        this.calibrationUI = null;
        this.renderer = null;
        this.kalmanFilter = new KalmanFilter2D({ Q: 0.5, R: 0.4 });

        // Media
        this.video = null;
        this.stream = null;

        // State
        this.isRunning = false;
        this.selectedScene = null;
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsTime = performance.now();
        this.lastLandmarks = null;

        // Shared gaze state (for decoupled loops)
        this.gazeState = {
            x: 0.5,
            y: 0.5,
            avgSteps: 50
        };

        this._init();
    }

    async _init() {
        // Screen callbacks
        this.homeScreen.setOnStart((scene) => {
            this.selectedScene = scene;
            this._startCalibration();
        });
        this.homeScreen.setOnTutorial(() => this.tutorialModal.show());
        this.demoScreen.setOnTimerEnd(() => this._endDemo());
        this.demoScreen.setOnDebugToggle((show) => {
            if (show) this.debugPanel.show();
            else this.debugPanel.hide();
        });
        this.resultsScreen.setOnRestart(() => this._restartFromHome());

        this._showScreen(SCREENS.HOME);
        await this._initCamera();
    }

    async _initCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            this.video = this.homeScreen.getVideoElement();
            this.video.srcObject = this.stream;
            await this.video.play();
            this.homeScreen.showCameraActive();

            this.gazeEstimator = new GazeEstimator();
            await this.gazeEstimator.initialize();

            this.faceGuide = new FaceGuide('camera-preview');
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

        this.calibrationUI = new CalibrationUI(this.gazeEstimator);

        const processFrame = async () => {
            return await this.gazeEstimator.processFrame(this.video);
        };

        this.calibrationUI.onComplete = (success) => {
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

        const canvas = this.demoScreen.getCanvas();

        // Use new SceneRenderer with selected scene
        this.renderer = new SceneRenderer(canvas);
        this.renderer.loadScene(this.selectedScene);
        this.renderer.resize();

        this.demoScreen.reset();
        this.computeTracker.startSession(canvas.width, canvas.height);
        this.demoScreen.startTimer();

        const smoothing = this.demoScreen.getSmoothing();
        this.kalmanFilter.filterX.R = smoothing;
        this.kalmanFilter.filterY.R = smoothing;
        this.kalmanFilter.reset();

        this.isRunning = true;

        // Start DECOUPLED loops
        this._startGazeLoop();
        this._startRenderLoop();
    }

    /**
     * Gaze loop - runs at ~30Hz independently
     */
    _startGazeLoop() {
        const processGaze = async () => {
            if (!this.isRunning || this.currentScreen !== SCREENS.DEMO) return;

            try {
                const results = await this.gazeEstimator.processFrame(this.video);

                if (results && this.gazeEstimator.isTrained()) {
                    const { features, blinkDetected } = this.gazeEstimator.extractFeatures(results);
                    this.lastLandmarks = results.multiFaceLandmarks?.[0] || null;

                    if (features && !blinkDetected) {
                        const [rawX, rawY] = this.gazeEstimator.predict(features);

                        const smoothing = this.demoScreen.getSmoothing();
                        this.kalmanFilter.filterX.R = smoothing;
                        this.kalmanFilter.filterY.R = smoothing;

                        const [smoothX, smoothY] = this.kalmanFilter.update(rawX, rawY);

                        this.gazeState.x = Math.max(0, Math.min(1, smoothX / window.innerWidth));
                        this.gazeState.y = Math.max(0, Math.min(1, smoothY / window.innerHeight));

                        // Calculate LOD for analytics
                        const foveaFactor = Math.min(1, Math.sqrt(
                            Math.pow(this.gazeState.x - 0.5, 2) + Math.pow(this.gazeState.y - 0.5, 2)
                        ) * 3);
                        this.gazeState.avgSteps = 64 - foveaFactor * 40;
                    }
                }
            } catch (error) {
                console.error('Gaze error:', error);
            }

            setTimeout(processGaze, 33); // ~30Hz
        };

        processGaze();
    }

    /**
     * Render loop - runs at max FPS
     */
    _startRenderLoop() {
        const render = () => {
            if (!this.isRunning || this.currentScreen !== SCREENS.DEMO) return;

            const { x: gazeX, y: gazeY, avgSteps } = this.gazeState;

            this.renderer.setGazePoint(gazeX, gazeY);
            this.demoScreen.updateGazePosition(gazeX, gazeY);
            this.renderer.setHeatmap(this.demoScreen.shouldShowHeatmap());
            this.renderer.render();

            this.computeTracker.recordFrame(avgSteps);

            // Update debug panel
            if (this.debugPanel.isVisible()) {
                this.frameCount++;
                const now = performance.now();
                if (now - this.lastFpsTime >= 1000) {
                    this.fps = this.frameCount;
                    this.frameCount = 0;
                    this.lastFpsTime = now;
                }

                this.debugPanel.updateStats({
                    fps: this.fps,
                    gazeX: gazeX,
                    gazeY: gazeY,
                    lodLevel: Math.min(1, Math.sqrt(
                        Math.pow(gazeX - 0.5, 2) + Math.pow(gazeY - 0.5, 2)
                    ) * 3),
                    avgSteps: avgSteps,
                    eyeOpenness: 1.0,
                    calibrationScore: 85,
                    faceDetected: !!this.lastLandmarks
                });

                this.debugPanel.drawVideoWithLandmarks(this.video, this.lastLandmarks);
            }

            requestAnimationFrame(render);
        };

        render();
    }

    _endDemo() {
        this.isRunning = false;
        this.debugPanel.hide();

        this.computeTracker.endSession();
        const summary = this.computeTracker.getSummary();
        console.log('Session Analytics:', summary);

        this._showScreen(SCREENS.RESULTS);
        this.resultsScreen.updateAnalytics(summary);
    }

    _restartFromHome() {
        this.resultsScreen.reset();
        this._showScreen(SCREENS.HOME);
        this.kalmanFilter.reset();
    }

    _showScreen(screen) {
        this.homeScreen.hide();
        this.demoScreen.hide();
        this.resultsScreen.hide();

        const calibrationOverlay = document.getElementById('calibration-overlay');
        if (calibrationOverlay) {
            calibrationOverlay.style.display = screen === SCREENS.CALIBRATION ? 'block' : 'none';
        }

        this.currentScreen = screen;

        switch (screen) {
            case SCREENS.HOME:
                this.homeScreen.show();
                break;
            case SCREENS.CALIBRATION:
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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
