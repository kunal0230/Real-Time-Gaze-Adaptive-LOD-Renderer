/**
 * GazeEstimator - Browser-based eye tracking using MediaPipe
 * Ported from EyeTrax gaze.py
 */

import * as faceMesh from '@mediapipe/face_mesh';
import { LEFT_EYE_INDICES, RIGHT_EYE_INDICES, MUTUAL_INDICES } from './constants.js';
import { RidgeRegression } from './RidgeRegression.js';

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

    /**
     * Initialize MediaPipe FaceMesh
     */
    async initialize() {
        return new Promise((resolve) => {
            // Handle different import structures (ESM vs CommonJS/Bundled)
            const FaceMeshClass = faceMesh.FaceMesh || (faceMesh.default ? faceMesh.default.FaceMesh : null) || window.FaceMesh;

            if (!FaceMeshClass) {
                console.error("FaceMesh not found in import", faceMesh);
                throw new Error('FaceMesh constructor not found');
            }

            this.faceMesh = new FaceMeshClass({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            this.faceMesh.onResults((results) => {
                this.lastResults = results;
            });

            this.faceMesh.initialize().then(() => {
                this.isReady = true;
                resolve();
            });
        });
    }

    /**
     * Process a video frame
     * @param {HTMLVideoElement} video - Video element with webcam feed
     */
    async processFrame(video) {
        if (!this.isReady) return null;
        await this.faceMesh.send({ image: video });
        return this.lastResults;
    }

    /**
     * Extract features from face landmarks
     * @param {Object} results - MediaPipe FaceMesh results
     * @returns {Object} - { features, blinkDetected }
     */
    extractFeatures(results) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return { features: null, blinkDetected: false };
        }

        const landmarks = results.multiFaceLandmarks[0];

        // Convert landmarks to array of [x, y, z]
        const allPoints = landmarks.map(lm => [lm.x, lm.y, lm.z]);

        // Nose anchor for normalization
        const noseAnchor = allPoints[4];
        const leftCorner = allPoints[33];
        const rightCorner = allPoints[263];
        const topOfHead = allPoints[10];

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

        // Rotate points
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

        // Extract subset of indices
        const subsetIndices = [...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES, ...MUTUAL_INDICES];
        const eyeLandmarks = subsetIndices.map(i => scaledPoints[i]);

        // Flatten to feature vector
        let features = eyeLandmarks.flat();

        // Add head pose (yaw, pitch, roll)
        const yaw = Math.atan2(R[1][0], R[0][0]);
        const pitch = Math.atan2(-R[2][0], Math.sqrt(R[2][1] ** 2 + R[2][2] ** 2));
        const roll = Math.atan2(R[2][1], R[2][2]);
        features = [...features, yaw, pitch, roll];

        // Blink detection using Eye Aspect Ratio (EAR)
        const leftEyeInner = [landmarks[133].x, landmarks[133].y];
        const leftEyeOuter = [landmarks[33].x, landmarks[33].y];
        const leftEyeTop = [landmarks[159].x, landmarks[159].y];
        const leftEyeBottom = [landmarks[145].x, landmarks[145].y];

        const rightEyeInner = [landmarks[362].x, landmarks[362].y];
        const rightEyeOuter = [landmarks[263].x, landmarks[263].y];
        const rightEyeTop = [landmarks[386].x, landmarks[386].y];
        const rightEyeBottom = [landmarks[374].x, landmarks[374].y];

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

    /**
     * Train the gaze model
     * @param {number[][]} X - Feature matrix
     * @param {number[][]} y - Target coordinates
     */
    train(X, y) {
        this.model.train(X, y);
    }

    /**
     * Predict gaze location
     * @param {number[]} features - Feature vector
     * @returns {number[]} - [x, y] screen coordinates
     */
    predict(features) {
        return this.model.predict(features);
    }

    /**
     * Check if model is trained
     */
    isTrained() {
        return this.model.trained;
    }

    /**
     * Save model to localStorage
     */
    saveModel(key = 'gazeModel') {
        localStorage.setItem(key, JSON.stringify(this.model.toJSON()));
    }

    /**
     * Load model from localStorage
     */
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
