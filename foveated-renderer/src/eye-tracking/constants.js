/**
 * MediaPipe landmark indices for eye tracking
 * Uses all 478 landmarks for maximum accuracy
 */

// All 478 MediaPipe Face Mesh landmarks (0-477)
// Landmarks 0-467: Face mesh points
// Landmarks 468-477: Iris landmarks (5 per eye)
export const ALL_LANDMARK_COUNT = 478;

// Iris-specific landmarks for precise gaze tracking
export const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
export const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];

// Eye corner landmarks for blink detection
export const LEFT_EYE_CORNERS = {
  inner: 133,
  outer: 33,
  top: 159,
  bottom: 145
};

export const RIGHT_EYE_CORNERS = {
  inner: 362,
  outer: 263,
  top: 386,
  bottom: 374
};

// Key face landmarks for pose estimation
export const POSE_LANDMARKS = {
  nose: 4,
  leftEyeCorner: 33,
  rightEyeCorner: 263,
  topOfHead: 10
};
