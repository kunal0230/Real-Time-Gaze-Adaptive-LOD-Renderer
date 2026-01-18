/**
 * GazeEstimator - Eye tracking using MediaPipe with all 478 landmarks.
 */

import {
    ALL_LANDMARK_COUNT,
    LEFT_EYE_CORNERS,
    RIGHT_EYE_CORNERS,
    POSE_LANDMARKS
} from './constants.js';
import { RidgeRegression } from './RidgeRegression.js';

// Load MediaPipe from CDN dynamically
async function loadMediaPipe() {
    return new Promise((resolve, reject) => {
        if (window.FaceMesh) {
            resolve(window.FaceMesh);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            setTimeout(() => {
                if (window.FaceMesh) {
                    resolve(window.FaceMesh);
                } else {
                    reject(new Error('FaceMesh not available after script load'));
                }
            }, 100);
        };
        script.onerror = () => reject(new Error('Failed to load MediaPipe FaceMesh'));
        document.head.appendChild(script);
    });
}

export class GazeEstimator {
    constructor(options = {}) {
        this.model = new RidgeRegression(options.alpha || 1.0);
        this.faceMesh = null;
        this.isReady = false;
        this.lastResults = null;

        // Blink detection
        this.earHistory = [];
        this.earHistoryLen = options.earHistoryLen || 50;
        this.blinkThresholdRatio = options.blinkThresholdRatio || 0.8;
        this.minHistory = options.minHistory || 15;
    }

    async initialize() {
        const FaceMesh = await loadMediaPipe();

        return new Promise((resolve, reject) => {
            try {
                this.faceMesh = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                    }
                });

                this.faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true, // Required for iris landmarks (468-477)
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                this.faceMesh.onResults((results) => {
                    this.lastResults = results;
                });

                this.faceMesh.initialize().then(() => {
                    this.isReady = true;
                    resolve();
                }).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    async processFrame(video) {
        if (!this.isReady) return null;
        await this.faceMesh.send({ image: video });
        return this.lastResults;
    }

    /**
     * Extract features from all 478 face landmarks
     * @param {Object} results - MediaPipe FaceMesh results
     * @returns {Object} - { features, blinkDetected }
     */
    extractFeatures(results) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return { features: null, blinkDetected: false };
        }

        const landmarks = results.multiFaceLandmarks[0];

        // Validate we have all landmarks (need iris landmarks for best accuracy)
        if (landmarks.length < ALL_LANDMARK_COUNT) {
            console.warn(`Expected ${ALL_LANDMARK_COUNT} landmarks, got ${landmarks.length}`);
        }

        // Convert all landmarks to array of [x, y, z]
        const allPoints = landmarks.map(lm => [lm.x, lm.y, lm.z]);

        // Nose anchor for normalization
        const noseAnchor = allPoints[POSE_LANDMARKS.nose];
        const leftCorner = allPoints[POSE_LANDMARKS.leftEyeCorner];
        const rightCorner = allPoints[POSE_LANDMARKS.rightEyeCorner];
        const topOfHead = allPoints[POSE_LANDMARKS.topOfHead];

        // Shift points relative to nose
        const shiftedPoints = allPoints.map(p => [
            p[0] - noseAnchor[0],
            p[1] - noseAnchor[1],
            p[2] - noseAnchor[2],
        ]);

        // Calculate rotation axes
        const xAxis = this._normalize([
            rightCorner[0] - leftCorner[0],
            rightCorner[1] - leftCorner[1],
            rightCorner[2] - leftCorner[2],
        ]);

        let yApprox = this._normalize([
            topOfHead[0] - noseAnchor[0],
            topOfHead[1] - noseAnchor[1],
            topOfHead[2] - noseAnchor[2],
        ]);

        // Orthogonalize y-axis
        const dotXY = this._dot(yApprox, xAxis);
        yApprox = this._normalize([
            yApprox[0] - dotXY * xAxis[0],
            yApprox[1] - dotXY * xAxis[1],
            yApprox[2] - dotXY * xAxis[2],
        ]);

        const zAxis = this._normalize(this._cross(xAxis, yApprox));

        // Rotation matrix
        const R = [xAxis, yApprox, zAxis];

        // Rotate all points
        const rotatedPoints = shiftedPoints.map(p => this._matVecMul(R, p));

        // Scale by inter-eye distance
        const leftCornerRot = this._matVecMul(R, [
            leftCorner[0] - noseAnchor[0],
            leftCorner[1] - noseAnchor[1],
            leftCorner[2] - noseAnchor[2],
        ]);
        const rightCornerRot = this._matVecMul(R, [
            rightCorner[0] - noseAnchor[0],
            rightCorner[1] - noseAnchor[1],
            rightCorner[2] - noseAnchor[2],
        ]);
        const interEyeDist = this._distance(rightCornerRot, leftCornerRot);

        const scaledPoints = interEyeDist > 1e-7
            ? rotatedPoints.map(p => p.map(v => v / interEyeDist))
            : rotatedPoints;

        // Flatten ALL landmarks to feature vector (478 landmarks × 3 = 1434 values)
        let features = scaledPoints.flat();

        // Add head pose (yaw, pitch, roll) = 3 more values
        const yaw = Math.atan2(R[1][0], R[0][0]);
        const pitch = Math.atan2(-R[2][0], Math.sqrt(R[2][1] ** 2 + R[2][2] ** 2));
        const roll = Math.atan2(R[2][1], R[2][2]);
        features = [...features, yaw, pitch, roll];

        // Blink detection using Eye Aspect Ratio (EAR)
        const leftEyeInner = [landmarks[LEFT_EYE_CORNERS.inner].x, landmarks[LEFT_EYE_CORNERS.inner].y];
        const leftEyeOuter = [landmarks[LEFT_EYE_CORNERS.outer].x, landmarks[LEFT_EYE_CORNERS.outer].y];
        const leftEyeTop = [landmarks[LEFT_EYE_CORNERS.top].x, landmarks[LEFT_EYE_CORNERS.top].y];
        const leftEyeBottom = [landmarks[LEFT_EYE_CORNERS.bottom].x, landmarks[LEFT_EYE_CORNERS.bottom].y];

        const rightEyeInner = [landmarks[RIGHT_EYE_CORNERS.inner].x, landmarks[RIGHT_EYE_CORNERS.inner].y];
        const rightEyeOuter = [landmarks[RIGHT_EYE_CORNERS.outer].x, landmarks[RIGHT_EYE_CORNERS.outer].y];
        const rightEyeTop = [landmarks[RIGHT_EYE_CORNERS.top].x, landmarks[RIGHT_EYE_CORNERS.top].y];
        const rightEyeBottom = [landmarks[RIGHT_EYE_CORNERS.bottom].x, landmarks[RIGHT_EYE_CORNERS.bottom].y];

        const leftEyeWidth = this._distance2D(leftEyeOuter, leftEyeInner);
        const leftEyeHeight = this._distance2D(leftEyeTop, leftEyeBottom);
        const leftEAR = leftEyeHeight / (leftEyeWidth + 1e-9);

        const rightEyeWidth = this._distance2D(rightEyeOuter, rightEyeInner);
        const rightEyeHeight = this._distance2D(rightEyeTop, rightEyeBottom);
        const rightEAR = rightEyeHeight / (rightEyeWidth + 1e-9);

        const EAR = (leftEAR + rightEAR) / 2;

        // Adaptive blink threshold
        this.earHistory.push(EAR);
        if (this.earHistory.length > this.earHistoryLen) {
            this.earHistory.shift();
        }

        let threshold = 0.2;
        if (this.earHistory.length >= this.minHistory) {
            const mean = this.earHistory.reduce((a, b) => a + b, 0) / this.earHistory.length;
            threshold = mean * this.blinkThresholdRatio;
        }

        const blinkDetected = EAR < threshold;

        return { features, blinkDetected };
    }

    train(X, y) {
        this.model.train(X, y);
    }

    predict(features) {
        return this.model.predict(features);
    }

    isTrained() {
        return this.model.trained;
    }

    saveModel(key = 'gazeModel') {
        localStorage.setItem(key, JSON.stringify(this.model.toJSON()));
    }

    loadModel(key = 'gazeModel') {
        const data = localStorage.getItem(key);
        if (data) {
            this.model = RidgeRegression.fromJSON(JSON.parse(data));
            return true;
        }
        return false;
    }

    // Vector math utilities
    _normalize(v) {
        const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) + 1e-9;
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    _dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    _cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
    }

    _matVecMul(m, v) {
        return [
            m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
            m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
            m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
        ];
    }

    _distance(a, b) {
        return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    }

    _distance2D(a, b) {
        return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    }
}
