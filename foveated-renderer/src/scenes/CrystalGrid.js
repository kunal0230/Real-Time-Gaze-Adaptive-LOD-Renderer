/**
 * Crystal Grid Scene - Geometric crystal formations
 * Modern, clean aesthetic with reflections
 */

import { BaseScene } from './BaseScene.js';

export class CrystalGrid extends BaseScene {
    getName() {
        return 'Crystal Grid';
    }

    getDescription() {
        return 'Geometric crystal formations with dynamic reflections';
    }

    getThumbnail() {
        return 'linear-gradient(135deg, #0c1445 0%, #1a237e 50%, #311b92 100%)';
    }

    getMaxSteps() {
        return 40; // Reduced for performance
    }

    getResolutionScale() {
        return 0.85; // Slight reduction for smoother FPS
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

            // Box SDF
            float sdBox(vec3 p, vec3 b) {
                vec3 q = abs(p) - b;
                return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
            }

            // Rotated box for crystal effect
            mat3 rotateY(float a) {
                float c = cos(a), s = sin(a);
                return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
            }

            // Crystal SDF
            float sdCrystal(vec3 p, float height, float width) {
                // Elongated octahedron shape
                vec3 q = abs(p);
                return (q.x + q.y * 2.0 + q.z) * 0.33 - height;
            }

            // Ground plane
            float sdPlane(vec3 p) {
                return p.y + 1.0;
            }

            vec2 mapScene(vec3 p, float lod) {
                // Ground
                float ground = sdPlane(p);
                vec2 res = vec2(ground, 0.0);
                
                // Crystal grid - fewer crystals in periphery
                int gridSize = lod < 0.3 ? 3 : (lod < 0.6 ? 2 : 1);
                
                for (int x = -3; x <= 3; x++) {
                    if (abs(x) > gridSize) continue;
                    for (int z = -3; z <= 3; z++) {
                        if (abs(z) > gridSize) continue;
                        
                        float fx = float(x);
                        float fz = float(z);
                        
                        vec3 crystalPos = vec3(fx * 1.5, 0.0, fz * 1.5 - 3.0);
                        
                        // Height variation
                        float h = 0.8 + sin(fx * 1.5 + fz * 0.7 + u_time * 0.3) * 0.3;
                        
                        // Rotation animation
                        float rot = u_time * 0.2 + fx * 0.5 + fz * 0.3;
                        vec3 localP = (p - crystalPos) * rotateY(rot);
                        localP.y -= h * 0.5;
                        
                        float crystal = sdCrystal(localP, h * 0.3, 0.15);
                        
                        if (crystal < res.x) {
                            res = vec2(crystal, 1.0 + mod(fx + fz * 3.0, 5.0));
                        }
                    }
                }
                
                // Central large crystal
                vec3 centerP = p * rotateY(u_time * 0.1);
                centerP.y -= 1.0;
                float centerCrystal = sdCrystal(centerP, 0.6, 0.25);
                if (centerCrystal < res.x) {
                    res = vec2(centerCrystal, 10.0);
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

            vec3 getCrystalColor(float id) {
                if (id >= 10.0) return vec3(0.9, 0.8, 1.0); // Center - white/purple
                if (id < 0.5) return vec3(0.1, 0.1, 0.12); // Ground
                
                vec3 colors[5] = vec3[](
                    vec3(0.3, 0.5, 0.9),  // Blue
                    vec3(0.5, 0.3, 0.9),  // Purple
                    vec3(0.3, 0.9, 0.7),  // Teal
                    vec3(0.9, 0.4, 0.6),  // Pink
                    vec3(0.4, 0.8, 0.9)   // Cyan
                );
                return colors[int(mod(id - 1.0, 5.0))];
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                float distToGaze = length(uv - u_gaze);
                float lod = smoothstep(u_foveaRadius * 0.3, u_foveaRadius * 2.5, distToGaze);
                
                int maxSteps = lod < 0.3 ? 56 : (lod < 0.6 ? 40 : 24);
                float epsilon = mix(0.002, 0.008, lod);
                
                // Camera looking down at grid
                vec3 ro = vec3(0.0, 3.0, 4.0);
                vec3 lookAt = vec3(0.0, 0.0, -1.0);
                vec3 fwd = normalize(lookAt - ro);
                vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
                vec3 up = cross(fwd, right);
                vec3 rd = normalize(fwd * 1.5 + right * p.x + up * p.y);
                
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
                    
                    t += res.x;
                    if (t > 30.0) break;
                }
                
                // Dark background with subtle gradient
                vec3 col = mix(
                    vec3(0.02, 0.02, 0.06),
                    vec3(0.06, 0.03, 0.1),
                    uv.y
                );
                
                if (hit.y >= 0.0) {
                    vec3 pos = ro + rd * hit.x;
                    vec3 nor = getNormal(pos, lod);
                    
                    vec3 matColor = getCrystalColor(hit.y);
                    
                    // Multiple light sources
                    vec3 light1 = normalize(vec3(1.0, 1.0, 0.5));
                    vec3 light2 = normalize(vec3(-0.5, 0.5, -1.0));
                    
                    float diff1 = max(dot(nor, light1), 0.0);
                    float diff2 = max(dot(nor, light2), 0.0);
                    
                    float spec = pow(max(dot(reflect(-light1, nor), -rd), 0.0), 64.0);
                    float fresnel = pow(1.0 - max(dot(nor, -rd), 0.0), 4.0);
                    
                    // Crystal refraction-like effect
                    col = matColor * (0.15 + diff1 * 0.5 + diff2 * 0.2);
                    col += vec3(1.0, 0.95, 0.9) * spec * 0.8;
                    col += matColor * fresnel * 0.6;
                    
                    // Ground reflection
                    if (hit.y < 0.5) {
                        col = vec3(0.05, 0.05, 0.08);
                        col += matColor * fresnel * 0.1;
                    }
                }
                
                if (u_showHeatmap) {
                    vec3 lodColor = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.2, 0.0), lod);
                    col = mix(col, lodColor, 0.6);
                }
                
                // Subtle bloom
                col *= 1.0 + smoothstep(0.5, 1.0, dot(col, vec3(0.3))) * 0.2;
                
                col = pow(col, vec3(0.45));
                
                outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;
    }
}
