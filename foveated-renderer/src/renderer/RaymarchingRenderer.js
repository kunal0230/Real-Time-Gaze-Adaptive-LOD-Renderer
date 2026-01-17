/**
 * Raymarching Renderer using Signed Distance Fields (SDFs)
 * Implements foveated rendering by optimizing the raymarching loop
 * based on the user's gaze direction.
 */

export class RaymarchingRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2'); // Need WebGL2 for performance
        if (!this.gl) {
            console.error('WebGL2 not supported');
            return;
        }

        this.program = null;
        this.gazeX = 0.5; // Normalized 0-1
        this.gazeY = 0.5; // Normalized 0-1
        this.time = 0;

        // Foveated parameters
        this.foveaRadius = 0.15; // Size of high-detail zone

        this._initShaders();
        this._initBuffers();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setHeatmap(show) {
        this.showHeatmap = show;
    }

    setGazePoint(x, y) {
        // x, y are normalized [0, 1]
        this.gazeX = x;
        // Invert Y for shader coord system if needed, but here we'll handle in shader
        this.gazeY = 1.0 - y;
    }

    async loadImage(url) {
        // Not used in raymarching (we generate the scene), but kept for interface compatibility
        console.log('RaymarchingRenderer: Image loading skipped (procedural scene)');
    }

    render() {
        this.time += 0.01;

        this.gl.useProgram(this.program);

        // Update uniforms
        this.gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.uGaze, this.gazeX, this.gazeY);
        this.gl.uniform1f(this.uTime, this.time);
        this.gl.uniform1f(this.uFoveaRadius, this.foveaRadius);
        this.gl.uniform1i(this.uShowHeatmap, this.showHeatmap ? 1 : 0);

        // Draw fullscreen quad
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    _initShaders() {
        const vsSource = `#version 300 es
            in vec4 position;
            void main() {
                gl_Position = position;
            }
        `;

        const fsSource = `#version 300 es
            precision highp float;
            
            uniform vec2 u_resolution;
            uniform vec2 u_gaze;
            uniform float u_time;
            uniform float u_foveaRadius;
            uniform bool u_showHeatmap;
            
            out vec4 outColor;

            // --- FOREST LANDSCAPE - LOD Demo with Trees, Rocks & Water ---
            // Game-style Level of Detail based on Eye Gaze
            // -----------------------------------------------------------
            
            // --- NOISE FUNCTIONS ---
            float hash(float n) { return fract(sin(n) * 43758.5453); }
            float hash2(vec2 p) {
                p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
                return -1.0 + 2.0 * fract(p.x * p.y * (p.x + p.y));
            }
            
            float random(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash2(i + vec2(0.0, 0.0)), hash2(i + vec2(1.0, 0.0)), u.x),
                           mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
            }
            
            // FBM with variable octaves for LOD
            float fbmLOD(vec2 p, int octaves) {
                float f = 0.0;
                float m = 0.5;
                mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
                for(int i = 0; i < 8; i++) {
                    if(i >= octaves) break;
                    f += m * noise(p);
                    p = rot * p * 2.02;
                    m *= 0.5;
                }
                return f;
            }

            // --- SDF PRIMITIVES FOR TREES & ROCKS ---
            
            float sdSphere(vec3 p, float r) {
                return length(p) - r;
            }
            
            float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
                vec3 pa = p - a, ba = b - a;
                float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                return length(pa - ba * h) - r;
            }
            
            float sdCone(vec3 p, float h, float r) {
                vec2 q = vec2(length(p.xz), p.y);
                vec2 tip = q - vec2(0.0, h);
                vec2 mantleDir = normalize(vec2(h, r));
                float mantle = dot(tip, mantleDir);
                float d = max(mantle, -q.y);
                float projected = dot(tip, vec2(mantleDir.y, -mantleDir.x));
                if ((q.y > h) && (projected < 0.0)) d = max(d, length(tip));
                if ((q.x > r) && (projected > length(vec2(h, r)))) d = max(d, length(q - vec2(r, 0.0)));
                return d;
            }
            
            float smin(float a, float b, float k) {
                float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
                return mix(b, a, h) - k*h*(1.0-h);
            }

            // --- LOD TREE - Detail varies with gaze distance ---
            // High LOD: Multiple branches, detailed leaves
            // Low LOD: Simple cone silhouette
            // ----------------------------------------------------
            
            float sdTreeHighDetail(vec3 p, float seed) {
                // Trunk
                float trunk = sdCapsule(p, vec3(0.0), vec3(0.0, 2.5, 0.0), 0.15);
                
                // Main foliage - multiple layered cones
                vec3 fp = p - vec3(0.0, 2.0, 0.0);
                float foliage = sdCone(fp, 2.0, 1.2);
                foliage = smin(foliage, sdCone(fp + vec3(0.0, 0.7, 0.0), 1.6, 1.0), 0.2);
                foliage = smin(foliage, sdCone(fp + vec3(0.0, 1.3, 0.0), 1.2, 0.7), 0.2);
                
                // Branches - add randomness
                float angle1 = seed * 6.28;
                vec3 branch1 = vec3(cos(angle1) * 0.3, 1.5, sin(angle1) * 0.3);
                foliage = smin(foliage, sdCapsule(p, vec3(0.0, 1.5, 0.0), branch1 + vec3(0.0, 1.8, 0.0), 0.08), 0.1);
                
                float angle2 = seed * 6.28 + 2.09;
                vec3 branch2 = vec3(cos(angle2) * 0.4, 1.2, sin(angle2) * 0.4);
                foliage = smin(foliage, sdCapsule(p, vec3(0.0, 1.2, 0.0), branch2 + vec3(0.0, 1.6, 0.0), 0.06), 0.1);
                
                // Leaf clusters (small spheres)
                float leaves = 1e10;
                for(int i = 0; i < 5; i++) {
                    float a = float(i) * 1.256 + seed * 3.14;
                    float r = 0.6 + hash(seed + float(i)) * 0.4;
                    float h = 2.5 + hash(seed + float(i) * 2.0) * 1.0;
                    vec3 lp = vec3(cos(a) * r, h, sin(a) * r);
                    leaves = smin(leaves, sdSphere(p - lp, 0.25 + hash(seed + float(i) * 3.0) * 0.15), 0.2);
                }
                foliage = smin(foliage, leaves, 0.3);
                
                return min(trunk, foliage - 0.1);
            }
            
            float sdTreeLowDetail(vec3 p) {
                // Simple cone + cylinder - LOD 0
                float trunk = sdCapsule(p, vec3(0.0), vec3(0.0, 2.0, 0.0), 0.2);
                float foliage = sdCone(p - vec3(0.0, 1.5, 0.0), 2.5, 1.5);
                return min(trunk, foliage);
            }
            
            // --- LOD ROCK - Detail varies with gaze distance ---
            
            float sdRockHighDetail(vec3 p, float seed) {
                // Deformed sphere with noise displacement
                float d = length(p) - 0.5;
                
                // Add detailed surface bumps
                d += noise(p.xz * 8.0 + seed) * 0.08;
                d += noise(p.xy * 12.0 + seed * 2.0) * 0.04;
                d += noise(p.yz * 16.0 + seed * 3.0) * 0.02;
                
                // Irregular shape
                d += sin(p.x * 5.0 + seed) * sin(p.z * 4.0) * 0.06;
                
                return d;
            }
            
            float sdRockLowDetail(vec3 p) {
                // Simple ellipsoid - LOD 0
                vec3 q = p / vec3(0.6, 0.4, 0.5);
                return (length(q) - 1.0) * 0.4;
            }

            // --- TERRAIN with LOD ---
            
            float sdTerrain(vec3 p, int terrainLOD) {
                float h = fbmLOD(p.xz * 0.1, terrainLOD) * 3.0;
                h += fbmLOD(p.xz * 0.3, max(1, terrainLOD - 1)) * 1.0;
                if(terrainLOD >= 4) {
                    h += noise(p.xz * 2.0) * 0.3;
                }
                if(terrainLOD >= 6) {
                    h += noise(p.xz * 8.0) * 0.08;
                }
                
                // Valley for water
                float valley = smoothstep(0.0, 12.0, abs(p.x));
                h *= 0.2 + valley * 0.8;
                h -= (1.0 - valley) * 2.0;
                
                return p.y - h;
            }

            // --- SCENE MAP - Combines terrain, trees, rocks with LOD ---
            
            // Outputs: distance, material ID (0=terrain, 1=tree trunk, 2=tree foliage, 3=rock)
            vec2 mapScene(vec3 p, float lod) {
                int terrainLOD = int(mix(6.0, 2.0, lod)); // 6 octaves → 2 octaves
                float terrain = sdTerrain(p, terrainLOD);
                vec2 res = vec2(terrain, 0.0);
                
                // Place trees in a grid pattern with jitter
                float treeSpacing = 8.0;
                vec2 treeCell = floor(p.xz / treeSpacing);
                
                for(int dx = -1; dx <= 1; dx++) {
                    for(int dz = -1; dz <= 1; dz++) {
                        vec2 cell = treeCell + vec2(float(dx), float(dz));
                        float cellHash = random(cell);
                        
                        // Skip some cells for natural look
                        if(cellHash < 0.4) continue;
                        
                        // Jittered position within cell
                        vec2 treeXZ = cell * treeSpacing + vec2(
                            random(cell + vec2(1.0, 0.0)) * treeSpacing * 0.7,
                            random(cell + vec2(0.0, 1.0)) * treeSpacing * 0.7
                        );
                        
                        // Skip trees in water
                        if(abs(treeXZ.x) < 8.0) continue;
                        
                        // Get terrain height at tree position
                        float treeH = fbmLOD(treeXZ * 0.1, 4) * 3.0 + fbmLOD(treeXZ * 0.3, 3) * 1.0;
                        float valley = smoothstep(0.0, 12.0, abs(treeXZ.x));
                        treeH *= 0.2 + valley * 0.8;
                        treeH -= (1.0 - valley) * 2.0;
                        
                        // Tree local space
                        vec3 treePos = vec3(treeXZ.x, treeH, treeXZ.y);
                        vec3 localP = p - treePos;
                        
                        // Scale variation
                        float scale = 0.8 + cellHash * 0.5;
                        localP /= scale;
                        
                        // LOD SELECTION FOR TREES
                        float treeDist;
                        if(lod < 0.4) {
                            treeDist = sdTreeHighDetail(localP, cellHash);
                        } else {
                            treeDist = sdTreeLowDetail(localP);
                        }
                        treeDist *= scale;
                        
                        if(treeDist < res.x) {
                            res = vec2(treeDist, localP.y < 2.0 ? 1.0 : 2.0);
                        }
                    }
                }
                
                // Place rocks
                float rockSpacing = 12.0;
                vec2 rockCell = floor(p.xz / rockSpacing);
                
                for(int dx = -1; dx <= 1; dx++) {
                    for(int dz = -1; dz <= 1; dz++) {
                        vec2 cell = rockCell + vec2(float(dx), float(dz));
                        float cellHash = random(cell + vec2(100.0, 50.0));
                        
                        if(cellHash < 0.7) continue; // Fewer rocks
                        
                        vec2 rockXZ = cell * rockSpacing + vec2(
                            random(cell + vec2(5.0, 3.0)) * rockSpacing * 0.6,
                            random(cell + vec2(7.0, 2.0)) * rockSpacing * 0.6
                        );
                        
                        // Skip rocks in water
                        if(abs(rockXZ.x) < 10.0) continue;
                        
                        float rockH = fbmLOD(rockXZ * 0.1, 3) * 3.0;
                        float valley = smoothstep(0.0, 12.0, abs(rockXZ.x));
                        rockH *= 0.2 + valley * 0.8;
                        
                        vec3 rockPos = vec3(rockXZ.x, rockH, rockXZ.y);
                        vec3 localP = p - rockPos;
                        
                        float scale = 0.5 + cellHash * 1.0;
                        localP /= scale;
                        
                        float rockDist;
                        if(lod < 0.5) {
                            rockDist = sdRockHighDetail(localP, cellHash);
                        } else {
                            rockDist = sdRockLowDetail(localP);
                        }
                        rockDist *= scale;
                        
                        if(rockDist < res.x) {
                            res = vec2(rockDist, 3.0);
                        }
                    }
                }
                
                return res;
            }
            
            vec3 getNormal(vec3 p, float lod) {
                vec2 e = vec2(0.01, 0.0);
                return normalize(vec3(
                    mapScene(p + e.xyy, lod).x - mapScene(p - e.xyy, lod).x,
                    mapScene(p + e.yxy, lod).x - mapScene(p - e.yxy, lod).x,
                    mapScene(p + e.yyx, lod).x - mapScene(p - e.yyx, lod).x
                ));
            }

            // --- SKY ---
            
            vec3 getSky(vec3 rd, vec3 sunDir) {
                float sunAmount = max(dot(rd, sunDir), 0.0);
                
                vec3 skyTop = vec3(0.3, 0.5, 0.85);
                vec3 skyMid = vec3(0.5, 0.7, 0.95);
                vec3 horizon = vec3(0.85, 0.75, 0.65);
                
                float y = max(rd.y, 0.0);
                vec3 sky = mix(horizon, skyMid, smoothstep(0.0, 0.15, y));
                sky = mix(sky, skyTop, smoothstep(0.15, 0.5, y));
                
                // Sun
                sky += vec3(1.0, 0.9, 0.7) * pow(sunAmount, 64.0);
                sky += vec3(1.0, 0.85, 0.6) * pow(sunAmount, 256.0) * 2.0;
                
                return sky;
            }

            // --- MAIN RENDER ---
            
            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                float distToGaze = length(uv - u_gaze);
                float radius = u_foveaRadius;
                
                // --- FOVEATED LOD ---
                // Center: High detail (LOD = 0)
                // Periphery: Low detail (LOD = 1)
                // ---------------------
                float foveaFactor = smoothstep(radius * 0.3, radius * 2.5, distToGaze);
                float lod = foveaFactor; // 0.0 = max detail, 1.0 = min detail
                
                // Raymarching parameters also scale with LOD
                int maxSteps = int(mix(80.0, 35.0, lod));
                float epsilon = mix(0.005, 0.025, lod);
                float stepMult = mix(1.0, 1.6, lod);
                
                float MAX_DIST = 150.0;
                const int MAX_STEPS_HARD = 100;

                // --- CAMERA ---
                float camTime = u_time * 0.4;
                
                vec3 ro = vec3(
                    sin(camTime * 0.1) * 20.0,
                    5.0 + sin(camTime * 0.08) * 1.5,
                    camTime * 6.0
                );
                
                vec3 lookAt = ro + vec3(sin(camTime * 0.05) * 4.0, -1.0, 6.0);
                vec3 fwd = normalize(lookAt - ro);
                vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
                vec3 up = cross(fwd, right);
                vec3 rd = normalize(fwd * 1.3 + right * p.x + up * p.y);
                
                vec3 sunDir = normalize(vec3(0.5, 0.4, -0.7));

                // --- RAYMARCHING with LOD ---
                float dither = random(uv + u_time * 0.01) * 0.05;
                float t = 0.2 + dither;
                vec2 hit = vec2(MAX_DIST, -1.0);
                int stepCount = 0;
                
                for(int i = 0; i < MAX_STEPS_HARD; i++) {
                    if(i >= maxSteps) break;
                    if(t > MAX_DIST) break;
                    
                    vec3 pos = ro + rd * t;
                    vec2 res = mapScene(pos, lod);
                    
                    if(res.x < epsilon) {
                        hit = vec2(t, res.y);
                        break;
                    }
                    
                    t += res.x * stepMult;
                    stepCount++;
                }
                
                // Soft landing
                if(hit.y < 0.0) {
                    vec3 pos = ro + rd * t;
                    vec2 res = mapScene(pos, lod);
                    if(res.x < epsilon * 4.0 && t < MAX_DIST) {
                        hit = vec2(t, res.y);
                    }
                }

                // --- SHADING ---
                
                vec3 col = getSky(rd, sunDir);
                
                // Water plane
                float waterLevel = -1.5;
                float tWater = (waterLevel - ro.y) / rd.y;
                bool hitWater = false;
                
                if(tWater > 0.0 && tWater < MAX_DIST) {
                    if(hit.y < 0.0 || tWater < hit.x) {
                        hitWater = true;
                        hit = vec2(tWater, -1.0);
                    }
                }
                
                vec3 pos = ro + rd * hit.x;
                
                if(hitWater) {
                    // Water with reflections
                    vec3 nor = vec3(0.0, 1.0, 0.0);
                    float wave = noise(pos.xz * 1.5 + u_time * 0.6) * 0.05;
                    nor = normalize(vec3(wave, 1.0, wave));
                    
                    vec3 refDir = reflect(rd, nor);
                    float fresnel = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 4.0);
                    
                    vec3 waterCol = mix(vec3(0.02, 0.15, 0.25), vec3(0.1, 0.4, 0.5), 0.5);
                    vec3 refSky = getSky(refDir, sunDir);
                    
                    col = mix(waterCol, refSky, 0.3 + 0.6 * fresnel);
                    
                    float spec = pow(max(dot(refDir, sunDir), 0.0), 200.0);
                    col += vec3(1.0, 0.95, 0.85) * spec * 1.5;
                    
                    float fog = 1.0 - exp(-hit.x * 0.004);
                    col = mix(col, vec3(0.8, 0.85, 0.9), fog);
                }
                else if(hit.y >= 0.0) {
                    vec3 nor = getNormal(pos, lod);
                    float sunLight = max(dot(nor, sunDir), 0.0);
                    float ao = 0.5 + 0.5 * nor.y;
                    
                    vec3 mate;
                    
                    if(hit.y < 0.5) {
                        // TERRAIN - Grass
                        vec3 grass1 = vec3(0.2, 0.45, 0.08);
                        vec3 grass2 = vec3(0.4, 0.6, 0.15);
                        float n = noise(pos.xz * 5.0);
                        mate = mix(grass1, grass2, n);
                        
                        // Dirt on slopes
                        float slope = 1.0 - nor.y;
                        vec3 dirt = vec3(0.35, 0.25, 0.15);
                        mate = mix(mate, dirt, smoothstep(0.5, 0.8, slope));
                    }
                    else if(hit.y < 1.5) {
                        // TREE TRUNK - Bark
                        mate = vec3(0.3, 0.2, 0.1);
                        mate += noise(pos.xy * 10.0) * vec3(0.05, 0.03, 0.02);
                    }
                    else if(hit.y < 2.5) {
                        // TREE FOLIAGE - Leaves
                        vec3 leaf1 = vec3(0.1, 0.35, 0.05);
                        vec3 leaf2 = vec3(0.2, 0.5, 0.1);
                        float n = noise(pos.xz * 8.0 + pos.y * 2.0);
                        mate = mix(leaf1, leaf2, n);
                        
                        // Subsurface scattering
                        float sss = pow(max(dot(rd, -sunDir), 0.0), 3.0);
                        mate += vec3(0.2, 0.4, 0.1) * sss * 0.3;
                    }
                    else {
                        // ROCK - Stone
                        mate = vec3(0.4, 0.38, 0.35);
                        mate += noise(pos.xz * 15.0) * vec3(0.08, 0.06, 0.05);
                    }
                    
                    // Lighting
                    vec3 lin = vec3(0.0);
                    lin += sunLight * vec3(1.4, 1.2, 1.0);
                    lin += ao * vec3(0.4, 0.5, 0.7) * 0.5;
                    
                    col = mate * lin;
                    
                    // Fog
                    float fog = 1.0 - exp(-hit.x * 0.005);
                    col = mix(col, vec3(0.8, 0.8, 0.85), fog);
                }
                
                // --- HEATMAP - Shows computational cost ---
                if(u_showHeatmap) {
                    // Show LOD level as color (Blue=High detail, Red=Low detail)
                    float lodVis = lod;
                    vec3 lodColor = mix(vec3(0.0, 0.4, 1.0), vec3(1.0, 0.2, 0.0), lodVis);
                    col = mix(col, lodColor, 0.7);
                    
                    // Add step count visualization
                    float stepVis = float(stepCount) / float(maxSteps);
                    col = mix(col, vec3(stepVis), 0.2);
                }
                
                // --- POST-PROCESS ---
                
                // Subtle peripheral vignette (darker = less compute = more obvious)
                col *= mix(1.0, 0.85, foveaFactor * 0.5);
                
                // Gamma
                col = pow(col, vec3(0.45));
                
                // Saturation
                float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
                col = mix(vec3(gray), col, 1.1);
                
                // Vignette
                float vig = 1.0 - dot(p * 0.35, p * 0.35);
                col *= 0.5 + 0.5 * vig;
                
                outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;

        const vertexShader = this._createShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, fsSource);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize program:', this.gl.getProgramInfoLog(this.program));
            return;
        }

        this.uResolution = this.gl.getUniformLocation(this.program, 'u_resolution');
        this.uGaze = this.gl.getUniformLocation(this.program, 'u_gaze');
        this.uTime = this.gl.getUniformLocation(this.program, 'u_time');
        this.uFoveaRadius = this.gl.getUniformLocation(this.program, 'u_foveaRadius');
        this.uShowHeatmap = this.gl.getUniformLocation(this.program, 'u_showHeatmap');
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _initBuffers() {
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

        const positions = [
            -1.0, 1.0,
            1.0, 1.0,
            -1.0, -1.0,
            1.0, -1.0,
        ];

        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        const positionAttributeLocation = this.gl.getAttribLocation(this.program, 'position');
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
    }
}
