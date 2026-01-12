/**
 * Ridge Regression with StandardScaler for gaze prediction
 * Properly implements sklearn-like behavior
 */

export class RidgeRegression {
    constructor(alpha = 1.0) {
        this.alpha = alpha;
        this.weights = null;
        this.bias = null;
        this.trained = false;

        // StandardScaler parameters
        this.mean = null;
        this.std = null;
    }

    /**
     * Fit StandardScaler on features
     */
    _fitScaler(X) {
        const n = X.length;
        const d = X[0].length;

        // Calculate mean
        this.mean = new Array(d).fill(0);
        for (const row of X) {
            for (let j = 0; j < d; j++) {
                this.mean[j] += row[j];
            }
        }
        for (let j = 0; j < d; j++) {
            this.mean[j] /= n;
        }

        // Calculate std
        this.std = new Array(d).fill(0);
        for (const row of X) {
            for (let j = 0; j < d; j++) {
                this.std[j] += (row[j] - this.mean[j]) ** 2;
            }
        }
        for (let j = 0; j < d; j++) {
            this.std[j] = Math.sqrt(this.std[j] / n) || 1; // Avoid division by zero
        }
    }

    /**
     * Transform features using fitted scaler
     */
    _transform(X) {
        if (Array.isArray(X[0])) {
            // 2D array
            return X.map(row =>
                row.map((val, j) => (val - this.mean[j]) / this.std[j])
            );
        } else {
            // 1D array (single sample)
            return X.map((val, j) => (val - this.mean[j]) / this.std[j]);
        }
    }

    /**
     * Train the model on calibration data
     * @param {number[][]} X - Feature matrix (n_samples x n_features)
     * @param {number[][]} y - Target matrix (n_samples x 2) for x,y coordinates
     */
    train(X, y) {
        if (X.length < 2) {
            console.error('Need at least 2 samples to train');
            return;
        }

        const n = X.length;
        const d = X[0].length;

        console.log(`Training on ${n} samples with ${d} features`);

        // Fit and transform with StandardScaler (CRITICAL!)
        this._fitScaler(X);
        const Xs = this._transform(X);

        // Add bias term by appending 1s to X
        const XBias = Xs.map(row => [...row, 1]);

        // Convert to matrices for computation
        // XtX = X^T * X
        const XtX = this._matMul(this._transpose(XBias), XBias);

        // Add regularization: XtX + alpha * I
        for (let i = 0; i < XtX.length; i++) {
            XtX[i][i] += this.alpha;
        }

        // XtY = X^T * Y
        const XtY = this._matMul(this._transpose(XBias), y);

        // Solve: weights = (XtX)^-1 * XtY
        const XtXInv = this._inverse(XtX);
        if (!XtXInv) {
            console.error('Matrix inversion failed');
            return;
        }

        const weightsWithBias = this._matMul(XtXInv, XtY);

        // Extract weights and bias
        this.weights = weightsWithBias.slice(0, d);
        this.bias = weightsWithBias[d];
        this.trained = true;

        console.log('Model trained successfully');
    }

    /**
     * Predict gaze coordinates
     * @param {number[]} features - Feature vector
     * @returns {number[]} - [x, y] screen coordinates
     */
    predict(features) {
        if (!this.trained) {
            throw new Error('Model not trained');
        }

        // Transform features using scaler (CRITICAL!)
        const scaledFeatures = this._transform(features);

        // y = X * weights + bias
        const result = [0, 0];
        for (let i = 0; i < 2; i++) {
            let sum = this.bias[i];
            for (let j = 0; j < scaledFeatures.length; j++) {
                sum += scaledFeatures[j] * this.weights[j][i];
            }
            result[i] = sum;
        }
        return result;
    }

    // Matrix operations
    _transpose(m) {
        return m[0].map((_, i) => m.map(row => row[i]));
    }

    _matMul(a, b) {
        const result = Array(a.length).fill(null).map(() => Array(b[0].length).fill(0));
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < b[0].length; j++) {
                for (let k = 0; k < b.length; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return result;
    }

    _inverse(m) {
        const n = m.length;
        const aug = m.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);

        // Gaussian elimination with partial pivoting
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
                    maxRow = k;
                }
            }
            [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

            // Check for singularity
            if (Math.abs(aug[i][i]) < 1e-10) {
                console.warn('Matrix near singular, using regularization');
                aug[i][i] = 1e-10;
            }

            // Scale pivot row
            const scale = aug[i][i];
            for (let j = 0; j < 2 * n; j++) {
                aug[i][j] /= scale;
            }

            // Eliminate column
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug[k][i];
                    for (let j = 0; j < 2 * n; j++) {
                        aug[k][j] -= factor * aug[i][j];
                    }
                }
            }
        }

        return aug.map(row => row.slice(n));
    }

    /**
     * Serialize model for storage
     */
    toJSON() {
        return {
            alpha: this.alpha,
            weights: this.weights,
            bias: this.bias,
            trained: this.trained,
            mean: this.mean,
            std: this.std,
        };
    }

    /**
     * Load model from serialized data
     */
    static fromJSON(data) {
        const model = new RidgeRegression(data.alpha);
        model.weights = data.weights;
        model.bias = data.bias;
        model.trained = data.trained;
        model.mean = data.mean;
        model.std = data.std;
        return model;
    }
}
