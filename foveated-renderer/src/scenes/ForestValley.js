/**
 * Forest Valley Scene - Vibrant sunset terrain with water
 * Optimized with bright, detailed colors
 */

import { BaseScene } from './BaseScene.js';

export class ForestValley extends BaseScene {
    getName() {
        return 'Forest Valley';
    }

    getDescription() {
        return 'Vibrant sunset valley with golden hills and reflective water';
    }

    getThumbnail() {
        return 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 30%, #2eb872 70%, #1a4a2e 100%)';
    }

    getMaxSteps() {
        return 56;
    }

    getResolutionScale() {
        return 0.8;
    }

    getFragmentShader() {
        return `#version 300 es
            precision highp float;
            
            uniform vec2 u_resolution;
            uniform vec2 u_gaze;
            uniform float u_time;
            uniform float u_foveaRadius;
            uniform bool u_showHeatmap;
            
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

            float fbmLOD(vec2 p, int octaves) {
                float f = 0.0;
                float amp = 0.5;
                for (int i = 0; i < 4; i++) {
                    if (i >= octaves) break;
                    f += amp * noise(p);
                    p *= 2.0;
                    amp *= 0.5;
                }
                return f;
            }

            float getTerrainHeight(vec2 p, int lod) {
                float h = fbmLOD(p * 0.1, lod) * 4.0;
                float valley = smoothstep(0.0, 15.0, abs(p.x));
                h *= valley;
                h -= (1.0 - valley) * 2.0;
                return h;
            }

            vec2 mapScene(vec3 p, float lod) {
                int terrainLOD = lod < 0.3 ? 4 : (lod < 0.6 ? 3 : 2);
                float h = getTerrainHeight(p.xz, terrainLOD);
                float terrain = p.y - h;
                return vec2(terrain, 0.0);
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

            // Vibrant sunset sky
            vec3 getSky(vec3 rd, vec3 sunDir) {
                float y = max(rd.y, 0.0);
                float sunAmount = max(dot(rd, sunDir), 0.0);
                
                // Warm sunset gradient
                vec3 horizon = vec3(1.0, 0.5, 0.2);   // Orange
                vec3 midSky = vec3(0.9, 0.3, 0.4);    // Pink-red
                vec3 zenith = vec3(0.2, 0.3, 0.6);    // Deep blue
                
                vec3 sky = mix(horizon, midSky, smoothstep(0.0, 0.15, y));
                sky = mix(sky, zenith, smoothstep(0.15, 0.6, y));
                
                // Sun glow
                sky += vec3(1.0, 0.8, 0.4) * pow(sunAmount, 8.0) * 0.5;
                sky += vec3(1.0, 0.9, 0.7) * pow(sunAmount, 64.0);
                sky += vec3(1.0, 0.95, 0.8) * pow(sunAmount, 256.0) * 2.0;
                
                return sky;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                float distToGaze = length(uv - u_gaze);
                float lod = smoothstep(u_foveaRadius * 0.3, u_foveaRadius * 2.5, distToGaze);
                
                int maxSteps = lod < 0.3 ? 56 : (lod < 0.6 ? 36 : 20);
                float epsilon = mix(0.01, 0.05, lod);
                
                // Camera
                vec3 ro = vec3(0.0, 8.0, 15.0);
                vec3 lookAt = vec3(0.0, 2.0, 0.0);
                vec3 fwd = normalize(lookAt - ro);
                vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
                vec3 up = cross(fwd, right);
                vec3 rd = normalize(fwd * 1.5 + right * p.x + up * p.y);
                
                // Sunset sun position
                vec3 sunDir = normalize(vec3(0.3, 0.15, -0.9));
                
                float t = 0.0;
                vec2 hit = vec2(100.0, -1.0);
                
                for (int i = 0; i < 56; i++) {
                    if (i >= maxSteps) break;
                    
                    vec3 pos = ro + rd * t;
                    vec2 res = mapScene(pos, lod);
                    
                    if (res.x < epsilon) {
                        hit = vec2(t, res.y);
                        break;
                    }
                    
                    t += res.x * 0.8;
                    if (t > 100.0) break;
                }
                
                vec3 col = getSky(rd, sunDir);
                
                // Water plane
                float waterLevel = -1.0;
                float tWater = (waterLevel - ro.y) / rd.y;
                
                if (tWater > 0.0 && (hit.y < 0.0 || tWater < hit.x)) {
                    vec3 waterPos = ro + rd * tWater;
                    
                    vec3 waterNor = vec3(0.0, 1.0, 0.0);
                    float wave = noise(waterPos.xz * 0.5 + u_time * 0.3) * 0.03;
                    waterNor = normalize(vec3(wave, 1.0, wave));
                    
                    vec3 refDir = reflect(rd, waterNor);
                    float fresnel = pow(1.0 - max(dot(waterNor, -rd), 0.0), 4.0);
                    
                    // Warm water reflecting sunset
                    vec3 waterCol = vec3(0.15, 0.25, 0.35);
                    vec3 refSky = getSky(refDir, sunDir);
                    
                    col = mix(waterCol, refSky, 0.5 + fresnel * 0.4);
                    
                    // Sun reflection sparkle
                    float spec = pow(max(dot(refDir, sunDir), 0.0), 256.0);
                    col += vec3(1.0, 0.9, 0.7) * spec * 3.0;
                }
                else if (hit.y >= 0.0) {
                    vec3 pos = ro + rd * hit.x;
                    vec3 nor = getNormal(pos, lod);
                    
                    // Vibrant grass colors
                    float n = noise(pos.xz * 2.0);
                    vec3 grass1 = vec3(0.3, 0.55, 0.15);   // Bright green
                    vec3 grass2 = vec3(0.5, 0.7, 0.2);     // Yellow-green
                    vec3 grass3 = vec3(0.35, 0.45, 0.12);  // Darker accent
                    
                    vec3 grass = mix(grass1, grass2, n);
                    grass = mix(grass, grass3, noise(pos.xz * 5.0) * 0.3);
                    
                    // Warm sunset lighting on grass
                    float slope = 1.0 - nor.y;
                    vec3 dirt = vec3(0.45, 0.3, 0.2);
                    vec3 mate = mix(grass, dirt, smoothstep(0.4, 0.7, slope));
                    
                    // Golden hour lighting
                    float sunLight = max(dot(nor, sunDir), 0.0);
                    float ao = 0.5 + 0.5 * nor.y;
                    
                    vec3 sunColor = vec3(1.0, 0.7, 0.4);    // Warm sun
                    vec3 skyColor = vec3(0.4, 0.5, 0.7);    // Cool fill
                    
                    vec3 lin = sunColor * sunLight * 1.2;
                    lin += skyColor * ao * 0.3;
                    
                    col = mate * lin;
                    
                    // Warm fog
                    float fog = 1.0 - exp(-hit.x * 0.008);
                    vec3 fogColor = vec3(0.9, 0.7, 0.5);
                    col = mix(col, fogColor, fog);
                }
                
                if (u_showHeatmap) {
                    vec3 lodColor = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.2, 0.0), lod);
                    col = mix(col, lodColor, 0.6);
                }
                
                // Warm vignette
                col *= 0.6 + 0.4 * pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.15);
                
                // Color grading - boost saturation
                float luminance = dot(col, vec3(0.2126, 0.7152, 0.0722));
                col = mix(vec3(luminance), col, 1.2);
                
                col = pow(col, vec3(0.45));
                
                outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;
    }
}
