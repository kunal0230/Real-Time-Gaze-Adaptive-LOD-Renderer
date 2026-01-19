/**
 * Forest Valley Scene - Matching reference aesthetic
 * Bumpy grass, blue sky, mushroom trees, calm river
 */

import { BaseScene } from './BaseScene.js';

export class ForestValley extends BaseScene {
    getName() {
        return 'Forest Valley';
    }

    getDescription() {
        return 'Lush valley with detailed grass and stylized trees';
    }

    getThumbnail() {
        return 'linear-gradient(135deg, #87CEEB 0%, #98FB98 50%, #228B22 100%)';
    }

    getMaxSteps() {
        return 64;
    }

    getResolutionScale() {
        return 0.85;
    }

    getFragmentShader() {
        return `#version 300 es
            precision highp float;
            
            uniform vec2 u_resolution;
            uniform vec2 u_gaze;
            uniform float u_time;
            uniform float u_foveaRadius;
            uniform bool u_showHeatmap;
            uniform bool u_extraDetails;
            
            out vec4 outColor;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            // FBM for terrain - more octaves when focused
            float fbm(vec2 p, int octaves) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 4; i++) {
                    if (i >= octaves) break;
                    value += amplitude * noise(p);
                    p *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }

            float getHeight(vec2 p, int octaves) {
                float valley = smoothstep(0.0, 8.0, abs(p.x));
                float h = fbm(p * 0.15, octaves) * 3.5 * valley;
                h -= (1.0 - valley) * 1.2;
                return h;
            }

            // Mushroom-style tree (flat top)
            float sdMushroomTree(vec3 p, vec3 treePos, float scale) {
                vec3 q = (p - treePos) / scale;
                
                // Trunk - thin cylinder
                float trunk = length(q.xz) - 0.08;
                trunk = max(trunk, -q.y - 0.1);
                trunk = max(trunk, q.y - 1.0);
                
                // Canopy - flat disc/umbrella
                vec3 cap = q - vec3(0.0, 1.1, 0.0);
                float canopy = length(cap.xz) - 0.6;
                canopy = max(canopy, abs(cap.y) - 0.15);
                
                return min(trunk, canopy) * scale;
            }

            // Rock
            float sdRock(vec3 p, vec3 pos, float size) {
                vec3 q = p - pos;
                float d = length(q / vec3(1.0, 0.6, 0.85)) - size;
                return d;
            }

            // Scene constants
            const vec3 SUN_DIR = normalize(vec3(0.3, 0.6, -0.4));
            const float WATER_LEVEL = -0.9;

            vec2 mapScene(vec3 p, float lod) {
                // Terrain octaves based on LOD
                int octaves = lod < 0.3 ? 4 : (lod < 0.6 ? 3 : 2);
                float h = getHeight(p.xz, octaves);
                
                // Grass bump detail - key for visible LOD difference
                float grassBump = 0.0;
                if (lod < 0.5 && abs(p.x) > 2.0) {
                    float intensity = (1.0 - lod * 2.0) * 0.08;
                    grassBump = noise(p.xz * 8.0) * intensity;
                    if (lod < 0.25) {
                        grassBump += noise(p.xz * 16.0) * intensity * 0.5;
                    }
                }
                
                float terrain = p.y - h - grassBump;
                float d = terrain;
                float mat = 0.0;
                
                // Mushroom trees - scattered
                vec3 trees[8];
                trees[0] = vec3(-5.0, 2.2, -8.0);
                trees[1] = vec3(6.0, 2.0, -6.0);
                trees[2] = vec3(-7.0, 2.5, -15.0);
                trees[3] = vec3(8.0, 2.3, -12.0);
                trees[4] = vec3(-4.0, 1.8, -20.0);
                trees[5] = vec3(5.0, 1.9, -18.0);
                trees[6] = vec3(-8.0, 2.1, -25.0);
                trees[7] = vec3(7.0, 2.0, -22.0);
                
                float scales[8];
                scales[0] = 1.3; scales[1] = 1.1; scales[2] = 1.5; scales[3] = 1.2;
                scales[4] = 1.0; scales[5] = 1.4; scales[6] = 1.1; scales[7] = 1.3;
                
                // Only render nearby trees based on LOD
                int treeCount = lod < 0.4 ? 8 : (lod < 0.7 ? 6 : 4);
                for (int i = 0; i < 8; i++) {
                    if (i >= treeCount) break;
                    float treeD = sdMushroomTree(p, trees[i], scales[i]);
                    if (treeD < d) { d = treeD; mat = 1.0; }
                }
                
                // Rocks
                if (lod < 0.6) {
                    vec3 rocks[4];
                    rocks[0] = vec3(-3.0, 1.0, -5.0);
                    rocks[1] = vec3(3.5, 0.8, -7.0);
                    rocks[2] = vec3(-4.5, 1.2, -12.0);
                    rocks[3] = vec3(4.0, 0.9, -10.0);
                    
                    for (int i = 0; i < 4; i++) {
                        float rockD = sdRock(p, rocks[i], 0.3 + float(i) * 0.05);
                        if (rockD < d) { d = rockD; mat = 2.0; }
                    }
                }
                
                return vec2(d, mat);
            }

            vec3 getNormal(vec3 p, float lod) {
                float eps = mix(0.01, 0.05, lod);
                vec2 e = vec2(eps, 0.0);
                return normalize(vec3(
                    mapScene(p + e.xyy, lod).x - mapScene(p - e.xyy, lod).x,
                    mapScene(p + e.yxy, lod).x - mapScene(p - e.yxy, lod).x,
                    mapScene(p + e.yyx, lod).x - mapScene(p - e.yyx, lod).x
                ));
            }

            // Bright blue sky
            vec3 getSky(vec3 rd) {
                float y = rd.y;
                
                // Vibrant sky gradient
                vec3 zenith = vec3(0.3, 0.55, 0.95);
                vec3 horizon = vec3(0.55, 0.75, 0.95);
                
                vec3 sky = mix(horizon, zenith, max(y, 0.0));
                
                // Sun
                float sun = max(dot(rd, SUN_DIR), 0.0);
                sky += vec3(1.0, 0.95, 0.8) * pow(sun, 24.0) * 0.6;
                sky += vec3(1.0, 1.0, 0.95) * pow(sun, 256.0) * 1.2;
                
                return sky;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                float distToGaze = length(uv - u_gaze);
                
                // LOD calculation - balanced fovea
                float foveaSize = u_foveaRadius * 1.5;
                float lod = smoothstep(foveaSize * 0.15, foveaSize * 1.2, distToGaze);
                
                // Adaptive quality
                int maxSteps = int(mix(64.0, 20.0, lod));
                float epsilon = mix(0.005, 0.04, lod);
                
                // Camera looking down the valley
                float camT = u_time * 0.03;
                vec3 ro = vec3(sin(camT) * 2.0, 5.0 + sin(camT * 0.5) * 0.5, 8.0);
                vec3 lookAt = vec3(0.0, 1.5, -15.0);
                
                vec3 fwd = normalize(lookAt - ro);
                vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
                vec3 up = cross(fwd, right);
                vec3 rd = normalize(fwd * 1.5 + right * p.x + up * p.y);
                
                float t = 0.0;
                float maxDist = 50.0;
                vec2 hit = vec2(maxDist, -1.0);
                
                for (int i = 0; i < 64; i++) {
                    if (i >= maxSteps) break;
                    vec3 pos = ro + rd * t;
                    vec2 res = mapScene(pos, lod);
                    if (res.x < epsilon) { hit = vec2(t, res.y); break; }
                    t += res.x * 0.9;
                    if (t > maxDist) break;
                }
                
                vec3 col = getSky(rd);
                
                // Water plane
                float tWater = (WATER_LEVEL - ro.y) / rd.y;
                
                if (tWater > 0.0 && tWater < maxDist && (hit.y < 0.0 || tWater < hit.x)) {
                    vec3 wPos = ro + rd * tWater;
                    
                    // Calm waves
                    float wave = sin(wPos.x * 0.5 + u_time * 0.8) * cos(wPos.z * 0.3 + u_time * 0.5) * 0.015;
                    vec3 wNor = normalize(vec3(wave, 1.0, wave * 0.7));
                    
                    vec3 ref = reflect(rd, wNor);
                    float fresnel = pow(1.0 - max(dot(wNor, -rd), 0.0), 2.5);
                    
                    // Vivid turquoise water
                    vec3 waterCol = vec3(0.15, 0.5, 0.6);
                    col = mix(waterCol, getSky(ref), 0.25 + fresnel * 0.35);
                    
                    // Sun reflection
                    float spec = pow(max(dot(ref, SUN_DIR), 0.0), 64.0);
                    col += vec3(1.0, 0.95, 0.85) * spec * 1.0;
                }
                else if (hit.y >= 0.0) {
                    vec3 pos = ro + rd * hit.x;
                    vec3 nor = getNormal(pos, lod);
                    
                    vec3 mate;
                    
                    if (hit.y < 0.5) {
                        // Grass - bright vibrant green
                        float grassVar = noise(pos.xz * 3.0);
                        vec3 darkGrass = vec3(0.25, 0.55, 0.18);
                        vec3 lightGrass = vec3(0.45, 0.75, 0.28);
                        mate = mix(darkGrass, lightGrass, grassVar * (1.0 - lod * 0.4) + 0.35);
                        
                        // Yellow-green on slopes
                        float slope = 1.0 - nor.y;
                        mate = mix(mate, vec3(0.55, 0.6, 0.3), smoothstep(0.3, 0.6, slope) * 0.25);
                    }
                    else if (hit.y < 1.5) {
                        // Tree - richer colors
                        vec3 trunkBrown = vec3(0.4, 0.28, 0.15);
                        vec3 canopyGreen = vec3(0.18, 0.5, 0.18);
                        mate = pos.y > 1.0 ? canopyGreen : trunkBrown;
                    }
                    else {
                        // Rock - gray with moss
                        mate = vec3(0.45, 0.42, 0.38);
                    }
                    
                    // Bright lighting - more contrast
                    float sun = max(dot(nor, SUN_DIR), 0.0);
                    float sky = 0.5 + 0.5 * nor.y;
                    
                    vec3 sunCol = vec3(1.0, 0.95, 0.85);
                    vec3 skyCol = vec3(0.5, 0.6, 0.8);
                    
                    vec3 lin = sunCol * sun * 1.1 + skyCol * sky * 0.45;
                    col = mate * lin;
                }
                
                if (u_showHeatmap) {
                    vec3 heatCol = mix(vec3(0.0, 0.6, 1.0), vec3(1.0, 0.15, 0.0), lod);
                    col = mix(col, heatCol, 0.5);
                }
                
                // Light vignette
                col *= 0.7 + 0.3 * pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.1);
                
                // Tonemap
                col = pow(col, vec3(0.45));
                
                outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;
    }
}
