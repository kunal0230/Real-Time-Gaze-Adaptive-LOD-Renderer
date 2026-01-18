/**
 * Cosmic Orbs Scene - Glowing spheres in space
 * Simple, beautiful, and guaranteed 60 FPS
 */

import { BaseScene } from './BaseScene.js';

export class CosmicOrbs extends BaseScene {
    getName() {
        return 'Cosmic Orbs';
    }

    getDescription() {
        return 'Glowing spheres floating in space with dynamic lighting';
    }

    getThumbnail() {
        return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
    }

    getMaxSteps() {
        return 48; // Very fast
    }

    getResolutionScale() {
        return 1.0; // Full resolution - scene is simple enough
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

            // Simple sphere SDF
            float sdSphere(vec3 p, float r) {
                return length(p) - r;
            }

            // Scene with floating orbs
            vec2 mapScene(vec3 p, float lod) {
                vec2 res = vec2(1000.0, -1.0);
                
                // Number of orbs based on LOD
                int numOrbs = lod < 0.3 ? 7 : (lod < 0.6 ? 5 : 3);
                
                for (int i = 0; i < 7; i++) {
                    if (i >= numOrbs) break;
                    
                    float fi = float(i);
                    float angle = fi * 0.9 + u_time * (0.3 + fi * 0.05);
                    float radius = 2.0 + sin(fi * 1.5) * 0.8;
                    float height = sin(fi * 0.7 + u_time * 0.4) * 1.5;
                    
                    vec3 orbPos = vec3(
                        cos(angle) * radius,
                        height,
                        sin(angle) * radius
                    );
                    
                    float orbSize = 0.4 + sin(fi * 2.0) * 0.15;
                    float d = sdSphere(p - orbPos, orbSize);
                    
                    if (d < res.x) {
                        res = vec2(d, fi);
                    }
                }
                
                // Central large orb
                float central = sdSphere(p, 0.8 + sin(u_time * 0.5) * 0.1);
                if (central < res.x) {
                    res = vec2(central, 10.0);
                }
                
                return res;
            }

            vec3 getNormal(vec3 p, float lod) {
                vec2 e = vec2(0.001, 0.0);
                return normalize(vec3(
                    mapScene(p + e.xyy, lod).x - mapScene(p - e.xyy, lod).x,
                    mapScene(p + e.yxy, lod).x - mapScene(p - e.yxy, lod).x,
                    mapScene(p + e.yyx, lod).x - mapScene(p - e.yyx, lod).x
                ));
            }

            // Colorful orb colors
            vec3 getOrbColor(float id) {
                if (id >= 10.0) return vec3(1.0, 0.8, 0.3); // Central - gold
                
                vec3 colors[7] = vec3[](
                    vec3(0.9, 0.2, 0.4),  // Pink
                    vec3(0.2, 0.6, 0.9),  // Blue
                    vec3(0.4, 0.9, 0.5),  // Green
                    vec3(0.9, 0.5, 0.2),  // Orange
                    vec3(0.6, 0.3, 0.9),  // Purple
                    vec3(0.2, 0.9, 0.9),  // Cyan
                    vec3(0.9, 0.9, 0.3)   // Yellow
                );
                return colors[int(mod(id, 7.0))];
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                // LOD based on gaze distance
                float distToGaze = length(uv - u_gaze);
                float lod = smoothstep(u_foveaRadius * 0.3, u_foveaRadius * 2.5, distToGaze);
                
                // Adaptive raymarching
                int maxSteps = lod < 0.3 ? 48 : (lod < 0.6 ? 32 : 20);
                float epsilon = mix(0.002, 0.01, lod);
                
                // Camera
                vec3 ro = vec3(0.0, 0.0, 6.0);
                vec3 rd = normalize(vec3(p, -1.5));
                
                // Raymarch
                float t = 0.0;
                vec2 hit = vec2(100.0, -1.0);
                
                for (int i = 0; i < 48; i++) {
                    if (i >= maxSteps) break;
                    
                    vec3 pos = ro + rd * t;
                    vec2 res = mapScene(pos, lod);
                    
                    if (res.x < epsilon) {
                        hit = vec2(t, res.y);
                        break;
                    }
                    
                    t += res.x;
                    if (t > 20.0) break;
                }
                
                // Background - deep space gradient
                vec3 col = mix(
                    vec3(0.02, 0.02, 0.05),
                    vec3(0.05, 0.02, 0.1),
                    uv.y
                );
                
                // Add stars in high detail areas
                if (lod < 0.5) {
                    float stars = pow(fract(sin(dot(floor(gl_FragCoord.xy * 0.5), vec2(12.9898, 78.233))) * 43758.5453), 20.0);
                    col += vec3(stars * 0.5);
                }
                
                if (hit.y >= 0.0) {
                    vec3 pos = ro + rd * hit.x;
                    vec3 nor = getNormal(pos, lod);
                    
                    vec3 orbColor = getOrbColor(hit.y);
                    
                    // Lighting
                    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
                    float diff = max(dot(nor, lightDir), 0.0);
                    float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 32.0);
                    float fresnel = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);
                    
                    // Glow effect
                    vec3 glow = orbColor * 0.3;
                    
                    col = orbColor * (0.2 + diff * 0.6);
                    col += vec3(1.0) * spec * 0.5;
                    col += orbColor * fresnel * 0.4;
                    col += glow;
                }
                
                // Heatmap overlay
                if (u_showHeatmap) {
                    vec3 lodColor = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.2, 0.0), lod);
                    col = mix(col, lodColor, 0.6);
                }
                
                // Vignette
                float vig = 1.0 - dot(p * 0.3, p * 0.3);
                col *= vig;
                
                // Gamma
                col = pow(col, vec3(0.45));
                
                outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;
    }
}
