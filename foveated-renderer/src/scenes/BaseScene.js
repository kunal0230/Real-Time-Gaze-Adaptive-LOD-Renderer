/**
 * BaseScene - Abstract interface for all demo scenes
 * Each scene provides shader code and metadata for the renderer
 */

export class BaseScene {
    constructor() {
        if (this.constructor === BaseScene) {
            throw new Error('BaseScene is abstract and cannot be instantiated');
        }
    }

    /**
     * Get the scene display name
     * @returns {string}
     */
    getName() {
        throw new Error('getName() must be implemented');
    }

    /**
     * Get scene description
     * @returns {string}
     */
    getDescription() {
        throw new Error('getDescription() must be implemented');
    }

    /**
     * Get the scene thumbnail CSS gradient or image URL
     * @returns {string}
     */
    getThumbnail() {
        throw new Error('getThumbnail() must be implemented');
    }

    /**
     * Get the WebGL fragment shader source
     * @returns {string}
     */
    getFragmentShader() {
        throw new Error('getFragmentShader() must be implemented');
    }

    /**
     * Get recommended max raymarching steps for this scene
     * @returns {number}
     */
    getMaxSteps() {
        return 64;
    }

    /**
     * Get recommended resolution scale (0.5 = half resolution)
     * @returns {number}
     */
    getResolutionScale() {
        return 1.0;
    }
}
